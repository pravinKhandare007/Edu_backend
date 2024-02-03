const connectionProvider = require("../mySqlConnectionStringProvider.js");
const jwt = require("jsonwebtoken");
const XLSX = require("xlsx");
const fs = require("fs");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const bcrypt = require("bcrypt");
const { promisify } = require("util");
const nodemailer = require("nodemailer");
const { query } = require("express");
const sendEmail = require("./emailSender");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
// const AWS = require('aws-sdk');

const pool = require("../mySqlConnectionString.js"); // Assuming you have a separate file for creating a connection pool

const unlinkAsync = promisify(fs.unlink);

// const unlinkAsync = promisify(fs.unlink);

exports.uploadOrgIcon = async function (req, res) {
  const path = req.file.path;
  const fileContent = fs.readFileSync(path);
  const params = {
    Bucket: "embed-app-bucket",
    Key: "OrgIcon-" + req.params.orgId,
    Body: fileContent,
  };

  const command = new PutObjectCommand(params);

  try {
    const response = await s3Client.send(command);
    console.log("Image uploaded successfully. Location:", response);
    await unlinkAsync(path);
    res.status(200).send({ message: "uploaded successfully" });
  } catch (error) {
    console.error("Error uploading image:", error);
  }
};

exports.uploadProfileImage = async function (req, res) {
  const path = req.file.path;
  const fileContent = fs.readFileSync(path);
  const params = {
    Bucket: "embed-app-bucket",
    Key: "Image-" + req.body.userDetails.adminId,
    Body: fileContent,
  };

  const command = new PutObjectCommand(params);

  try {
    const response = await s3Client.send(command);
    console.log("Image uploaded successfully. Location:", response);
    await unlinkAsync(path);
    res.status(200).send({ message: "uploaded successfully" });
  } catch (error) {
    console.error("Error uploading image:", error);
  }
};

exports.retrieveOrgIcon = async function (req, res) {
  const params = {
    Bucket: "embed-app-bucket",
    Key: "OrgIcon-" + req.params.orgId,
    ResponseContentType: "image/jpeg",
  };

  const command = new GetObjectCommand(params);

  try {
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    console.log("Image retrieved successfully.", url);
    res.status(200).send({ dataUrl: url });
  } catch (error) {
    console.error("Error retrieving image:", error);
  }
};

exports.retrieveProfileImage = async function (req, res) {
  const params = {
    Bucket: "embed-app-bucket",
    Key: "Image-" + req.body.userDetails.adminId,
    ResponseContentType: "image/jpeg",
  };

  const command = new GetObjectCommand(params);

  try {
    // const response = await s3Client.send(command);
    // const imageFile = response.Body;
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    console.log("Image retrieved successfully.", url);
    res.status(200).send({ dataUrl: url });
  } catch (error) {
    console.error("Error retrieving image:", error);
  }
};

exports.deleteProfileImage = async function (req, res) {
  const deleteParams = {
    Bucket: "embed-app-bucket",
    Key: "testImage.jpg",
  };

  const deleteCommand = new DeleteObjectCommand(deleteParams);

  try {
    const data = await s3Client.send(deleteCommand);
    console.log("Object deleted successfully");
    res.status(200).send({ message: "uploaded successfully" });
  } catch (error) {
    console.error("Error deleting object:", error);
  }
};

// ------------------------ Working Code ---------------------------------------

exports.adminLogin = function (request, response) {
  const connection =
    connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

  const selectQuery = "SELECT * FROM admin_info WHERE email=?";
  const selectQueryPayload = [request.body.email];

  console.log("email:", request.body.email);
  console.log("password:", request.body.password);

  connection.query(
    selectQuery,
    selectQueryPayload,
    function (err, rows, fields) {
      if (err) {
        console.log("ERROR", err);
        response.status(500).send({ error: err });
        connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
          connection
        );
        return;
      }

      console.log("Rows from the Database:", rows);

      if (rows.length === 1) {
        const storedPassword = rows[0].password;

        // Check if the entered password matches the stored password
        if (request.body.password === storedPassword) {
          // Password matches, proceed with authentication
          proceedWithAuthentication(response, rows[0]);
        } else {
          // Passwords do not match
          console.log("Invalid password");
          response.status(401).send("Invalid credentials");
          connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
            connection
          );
        }
      } else if (rows.length === 0) {
        console.log("Admin not found");
        response.status(404).send("Admin not found");
        connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
          connection
        );
      } else {
        console.log("Unexpected number of rows:", rows.length);
        response.status(500).send("Internal Server Error");
        connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
          connection
        );
      }
    }
  );
};

exports.userLogin = function (request, response) {
  const connection =
    connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();
  const selectQuery = "SELECT * FROM login WHERE sap_id=? ";
  const selectQueryPayload = [request.body.sap_id];

  console.log("sap_id:", request.body.sap_id);
  console.log("password:", request.body.password);

  connection.query(
    selectQuery,
    selectQueryPayload,
    function (err, rows, fields) {
      if (err) {
        console.log("ERROR", err);
        response.status(500).send({ error: err });
        connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
          connection
        );
        return;
      }

      console.log("Rows from the Database:", rows);

      if (rows.length === 1) {
        const storedPassword = rows[0].password;

        // Check if the entered password matches the stored password
        if (
          !rows[0].is_password_hashed &&
          request.body.password === storedPassword
        ) {
          // Password matches the original numeric password, proceed with authentication
          proceedWithAuthentication(response, rows[0], rows[0].role);
        } else if (bcrypt.compareSync(request.body.password, storedPassword)) {
          // Password matches the hashed password, proceed with authentication
          proceedWithAuthentication(response, rows[0], rows[0].role);
        } else {
          // Passwords do not match
          console.log("Invalid password");
          response.status(401).send("Invalid credentials");
          connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
            connection
          );
        }
      } else if (rows.length === 0) {
        console.log("User not found");
        response.status(404).send("User not found");
        connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
          connection
        );
      } else {
        console.log("Unexpected number of rows:", rows.length);
        response.status(500).send("Internal Server Error");
        connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
          connection
        );
      }
    }
  );
};

// function proceedWithAuthentication(response, user) {
//   // Continue with authentication logic

//   const role = user.role; // Extract user role

//   // Generate JWT token with data from login table
//   const resToSend = {
//     user_id: user.user_id,
//     school_id: user.school_id,
//     sap_id: user.sap_id,
//     school_name: user.school_name,
//     role: role,
//     first_name: user.first_name,
//     last_name: user.last_name,
//     middle_name: user.middle_name,
//     email: user.email,
//     birthdate: user.birthdate,
//     contact_number: user.contact_number,
//     alternative_contact_number: user.alternative_contact_number,
//     permanent_address: user.permanent_address,
//     city: user.city,
//     state: user.state,
//   };

//   // If the user is a teacher, fetch additional data from teachers_info
//   if (role === "teacher") {
//     const additionalDataQuery = `SELECT * FROM teachers_info WHERE user_id = ${user.user_id}`;
//     const connection =
//       connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

//     connection.query(additionalDataQuery, function (err, rows, fields) {
//       if (err) {
//         console.log("Error fetching additional data:", err);
//         response.status(500).send("Internal Server Error");
//         connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
//           connection
//         );
//         return;
//       }

//       if (rows.length === 1) {
//         // Include additional data in the JWT token
//         Object.assign(resToSend, rows[0]);

//         // Update the redirect URL
//         const redirectUrl = `/home/schoolId=${resToSend.school_id}/teacherId=${resToSend.teacher_id}`;
//         resToSend.redirectUrl = redirectUrl;
//       }

//       // Assuming 'token' is the JWT token
//       const token = jwt.sign(resToSend, process.env.SECRET_KEY, {
//         expiresIn: "50m",
//       });

//       const responsePayload = {
//         success: true,
//         message: "Authentication Successful",
//         token: token,
//         redirectUrl: resToSend.redirectUrl, // Add the redirect URL to the response
//       };

//       response.json(responsePayload);
//       connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
//         connection
//       );
//     });
//   } else if (role === "student") {
//     // If the user is a student, fetch additional data from students_info
//     const additionalDataQuery = `SELECT * FROM students_info WHERE user_id = ${user.user_id}`;
//     const connection =
//       connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

//     connection.query(additionalDataQuery, function (err, rows, fields) {
//       if (err) {
//         console.log("Error fetching additional data:", err);
//         response.status(500).send("Internal Server Error");
//         connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
//           connection
//         );
//         return;
//       }

//       if (rows.length === 1) {
//         // Include additional data in the JWT token
//         Object.assign(resToSend, rows[0]);

//         // Update the redirect URL
//         const redirectUrl = `/home/schoolId=${resToSend.school_id}/studentId=${resToSend.student_id}`;
//         resToSend.redirectUrl = redirectUrl;
//       }

//       // Assuming 'token' is the JWT token
//       const token = jwt.sign(resToSend, process.env.SECRET_KEY, {
//         expiresIn: "50m",
//       });

//       const responsePayload = {
//         success: true,
//         message: "Authentication Successful",
//         token: token,
//         redirectUrl: resToSend.redirectUrl, // Add the redirect URL to the response
//       };

//       response.json(responsePayload);
//       connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
//         connection
//       );
//     });
//   } else {
//     // If the role is neither teacher nor student, generate JWT token directly
//     const token = jwt.sign(resToSend, process.env.SECRET_KEY, {
//       expiresIn: "50m",
//     });

//     const responsePayload = {
//       success: true,
//       message: "Authentication Successful",
//       token: token,
//     };

//     response.json(responsePayload);
//   }
// }


function proceedWithAuthentication(response, user) {
  // Continue with authentication logic

  const role = user.role; // Extract user role

  // Generate JWT token with data from login table
  const resToSend = {
    user_id: user.user_id,
    school_id: user.school_id,
    sap_id: user.sap_id,
    school_name: user.school_name,
    role: role,
    first_name: user.first_name,
    last_name: user.last_name,
    middle_name: user.middle_name,
    email: user.email,
    birthdate: user.birthdate,
    contact_number: user.contact_number,
    alternative_contact_number: user.alternative_contact_number,
    permanent_address: user.permanent_address,
    city: user.city,
    state: user.state,
  };

  // If the user is a teacher, fetch additional data from teachers_info
  if (role === "teacher") {
    const additionalDataQuery = `SELECT * FROM teachers_info WHERE user_id = ${user.user_id}`;
    const connection =
      connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

    connection.query(additionalDataQuery, function (err, rows, fields) {
      if (err) {
        console.log("Error fetching additional data:", err);
        response.status(500).send("Internal Server Error");
        connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
          connection
        );
        return;
      }

      if (rows.length === 1) {
        // Include additional data in the JWT token
        Object.assign(resToSend, rows[0]);
      }

      // Assuming 'token' is the JWT token
      const token = jwt.sign(resToSend, process.env.SECRET_KEY, {
        expiresIn: "50m",
      });

      const responsePayload = {
        success: true,
        message: "Authentication Successful",
        token: token,
      };

      response.json(responsePayload);
      connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
        connection
      );
    });
  } else if (role === "student") {
    // If the user is a student, fetch additional data from students_info
    const additionalDataQuery = `SELECT * FROM students_info WHERE user_id = ${user.user_id}`;
    const connection =
      connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

    connection.query(additionalDataQuery, function (err, rows, fields) {
      if (err) {
        console.log("Error fetching additional data:", err);
        response.status(500).send("Internal Server Error");
        connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
          connection
        );
        return;
      }

      if (rows.length === 1) {
        // Include additional data in the JWT token
        Object.assign(resToSend, rows[0]);
      }

      // Assuming 'token' is the JWT token
      const token = jwt.sign(resToSend, process.env.SECRET_KEY, {
        expiresIn: "50m",
      });

      const responsePayload = {
        success: true,
        message: "Authentication Successful",
        token: token,
      };

      response.json(responsePayload);
      connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
        connection
      );
    });
  } else {
    // If the role is neither teacher nor student, generate JWT token directly
    const token = jwt.sign(resToSend, process.env.SECRET_KEY, {
      expiresIn: "50m",
    });

    const responsePayload = {
      success: true,
      message: "Authentication Successful",
      token: token,
    };

    response.json(responsePayload);
  }
}

// Function to check if an email exists in the database
exports.checkEmailExists = async function (email) {
  const connection =
    connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

  return new Promise((resolve, reject) => {
    const query = "SELECT COUNT(user_id) AS count FROM login WHERE email = ?";
    connection.query(query, [email], (error, results) => {
      if (error) {
        console.error("Error executing query:", error);
        reject(
          "An error occurred while processing your request. Please try again."
        );
      } else {
        console.log("SQL Query:", query, "email:", email);
        const exists = results[0].count > 0;
        resolve({ exists });
      }
    });

    connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
      connection
    );
  });
};

// Helper function to send OTP to the user's email
async function sendOTPByEmail(email, otp) {
  const subject = "Reset Password OTP"; // Specify the subject of the email
  const content = `Your OTP to reset the password is: ${otp}`; // Specify the content of the email

  // Call the `sendEmail` function from `emailSender.js` to send the email
  await sendEmail(email, subject, content);
}

// Helper function to store OTP in the database
async function storeOTPInDatabase(email, otp, expiryTime) {
  const connection =
    connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

  return new Promise(async (resolve, reject) => {
    // Fetch Contact_Number from the login database
    const contactNumberQuery =
      "SELECT contact_number FROM login WHERE email = ?";
    const contactNumberResults = await queryDatabase(contactNumberQuery, [
      email,
    ]);

    if (contactNumberResults.length === 1) {
      const contactNumber = contactNumberResults[0].Contact_Number;

      // Store the OTP, email, expiry time, and contact number in the otps database
      const query =
        "INSERT INTO otps (email, otp, expiry_time, contact_number) VALUES (?, ?, ?, ?)";
      const queryPayload = [email, otp, expiryTime, contactNumber];

      connection.query(query, queryPayload, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    } else {
      reject(new Error("Contact_Number not found for the given email"));
    }

    connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
      connection
    );
  });
}

// Helper function to execute a query on the database
async function queryDatabase(query, params) {
  const connection =
    connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

  return new Promise((resolve, reject) => {
    connection.query(query, params, (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });

    connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
      connection
    );
  });
}

// Function to store OTP in the database and send it to the user's email
exports.sendOTP = async function (email) {
  try {
    // Generate a 5-digit plain/text OTP
    const plainOTP = Math.floor(10000 + Math.random() * 90000);

    // Store the hashed OTP in the database with an expiry time (e.g., 5 minutes)
    // const hashedOTP = await bcrypt.hash(plainOTP.toString(), 10);
    const expiryTime = Date.now() + 5 * 60 * 1000; // 5 minutes in milliseconds

    // Store the hashed OTP, expiry time, and contact number in the database
    await storeOTPInDatabase(email, plainOTP, expiryTime);

    // Send the plain OTP to the user's email
    await sendOTPByEmail(email, plainOTP);

    // Delete expired OTPs from the database
    // await deleteExpiredOTPs();

    console.log("OTP successfully sent and stored.");
  } catch (error) {
    console.error("Error sending OTP:", error);
    // Handle error, e.g., log the error or throw it for further handling
    throw new Error(
      "An error occurred while processing your request. Please try again."
    );
  }
};

// Function to verify OTP
exports.verifyOTP = async function (email, enteredOTP) {
  const connection =
    connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

  return new Promise((resolve, reject) => {
    const current_Time = new Date().getTime();
    const query = `SELECT * FROM otps WHERE email = ? AND expiry_time > ${current_Time}`;

    connection.query(query, [email], async (error, results) => {
      if (error) {
        console.error("Error executing query:", error);
        reject(error);
      } else {
        console.log("SQL Query:", query, "email:", email);

        // Check if there are any valid OTPs
        if (results.length > 0) {
          const storedOTP = results[0].otp;

          // Compare the entered OTP with the stored OTP
          const isValidOTP = enteredOTP === storedOTP;
          console.log("ISVALIDOTP ===", isValidOTP);

          resolve({ isValidOTP, email });
        } else {
          // No valid OTP found
          resolve({ isValidOTP: false, email });
        }
      }
    });

    connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
      connection
    );
  });
};

// Function to update the password in the login database
exports.resetPassword = async function (email, newPassword) {
  // hash the new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  const connection =
    connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

  return new Promise((resolve, reject) => {
    const query = "UPDATE login SET password = ? WHERE email = ?";
    connection.query(query, [hashedPassword, email], (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });

    connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
      connection
    );
  });
};

// Function to fetch teacher portal's all courses / publish courses details
exports.fetchUserData = function (request, response) {
  try {
    // Get the token from the request body
    const token = request.body.user_id;

    // Verify the token
    jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
      if (err) {
        // Token verification failed
        console.error("Token verification failed:", err);
        return response.status(401).json({ message: "Unauthorized" });
      }

      // Token verified successfully, extract user_id
      const userId = decoded.user_id;

      // Use userId to fetch user-specific data from the database
      const connection =
        connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

      // SQL query to fetch user data, course information, and total chapters
      const selectQuery = `
      SELECT
      login.user_id,
      courses_info.course_id,
      courses_info.course_name,
      courses_info.status,
      subjects_info.subject_name,
      COUNT(chapters_info.chapter_id) AS total_chapters
      FROM login
      LEFT JOIN courses_info ON login.user_id = courses_info.user_id
      LEFT JOIN chapters_info ON courses_info.course_id = chapters_info.course_id
      LEFT JOIN subjects_info ON courses_info.subject_id = subjects_info.subject_id
      WHERE login.user_id = ?
      GROUP BY courses_info.course_id;
      `;
      const selectQueryPayload = [userId];

      connection.query(selectQuery, selectQueryPayload, (err, rows, fields) => {
        connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
          connection
        );

        if (err) {
          console.error("Error executing database query:", err);
          return response.status(500).json({ error: err.message });
        }

        console.log("User Data:", rows);
        response.json({ userData: rows });
      });
    });
  } catch (error) {
    console.error("Error fetching user data:", error);
    response.status(500).json({ error: "Internal Server Error" });
  }
};

// Function to fetch all subjects
exports.fetchSubjects = function (request, response) {
  try {
    const connection = connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();
    const selectQuery = 'SELECT subject_id, subject_name FROM subjects_info';

    connection.query(selectQuery, (err, rows, fields) => {
      connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(connection);

      if (err) {
        console.error('Error executing database query:', err);
        return response.status(500).json({ error: err.message });
      }

      response.json({ subjects: rows });
    });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    response.status(500).json({ error: 'Internal Server Error' });
  }
};

// Function to fetch all classes
exports.fetchClasses = function (request, response) {
  try {
    const connection = connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();
    const selectQuery = 'SELECT class_id, class_name FROM classes_info';

    connection.query(selectQuery, (err, rows, fields) => {
      connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(connection);

      if (err) {
        console.error('Error executing database query:', err);
        return response.status(500).json({ error: err.message });
      }

      response.json({ classes: rows });
    });
  } catch (error) {
    console.error('Error fetching classes:', error);
    response.status(500).json({ error: 'Internal Server Error' });
  }
};

///////////////////////////
//------Admin Portal ------
///////////////////////////

exports.fetchSchoolData = function (request, response) {
  try {
    const connection =
      connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

    const selectQuery = `
      SELECT
        schools_info.school_id,
        schools_info.school_name,
        COUNT(login.user_id) AS total_users,
        SUM(CASE WHEN login.role = 'teacher' THEN 1 ELSE 0 END) AS total_teachers,
        SUM(CASE WHEN login.role = 'student' THEN 1 ELSE 0 END) AS total_students
      FROM schools_info
      LEFT JOIN login ON schools_info.school_id = login.school_id
      GROUP BY schools_info.school_id;
    `;

    connection.query(selectQuery, (err, rows, fields) => {
      connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
        connection
      );

      if (err) {
        console.error("Error executing database query:", err);
        return response.status(500).json({ error: err.message });
      }

      console.log("School Data:", rows);
      response.json({ schoolData: rows });
    });
  } catch (error) {
    console.error("Error fetching school data:", error);
    response.status(500).json({ error: "Internal Server Error" });
  }
};

exports.addSchool = function (request, response) {
  try {
    const {
      schoolName,
      schoolAddress,
      schoolDocumentNumber,
      principalName,
      city,
      state,
      zipCode,
      contactNumber,
      alternativeNumber,
    } = request.body;

    const connection =
      connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

    const insertQuery = `
      INSERT INTO schools_info (
        school_name,
        school_address,
        school_document_number,
        principal_name,
        city,
        state,
        zip_code,
        contact_number,
        alternative_number
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    const insertQueryPayload = [
      schoolName,
      schoolAddress,
      schoolDocumentNumber,
      principalName,
      city,
      state,
      zipCode,
      contactNumber,
      alternativeNumber,
    ];

    connection.query(insertQuery, insertQueryPayload, (err, result) => {
      connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
        connection
      );

      if (err) {
        console.error("Error executing database query:", err);
        return response.status(500).json({ error: err.message });
      }

      console.log("School added successfully");
      response.json({ message: "School added successfully" });
    });
  } catch (error) {
    console.error("Error adding school:", error);
    response.status(500).json({ error: "Internal Server Error" });
  }
};

exports.fetchSchoolDetails = function (request, response) {
  const schoolId = request.params.schoolId;

  const connection =
    connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

  const selectQuery = `
    SELECT *
    FROM schools_info
    WHERE school_id = ?;
  `;

  connection.query(selectQuery, [schoolId], (err, rows, fields) => {
    connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
      connection
    );

    if (err) {
      console.error("Error executing database query:", err);
      return response.status(500).json({ error: err.message });
    }

    console.log("School Details:", rows[0]);
    response.json({ schoolDetails: rows[0] });
  });
};

// Function to fetch user counts for a specific school
exports.fetchUserCounts = function (request, response) {
  const schoolId = request.params.schoolId;

  try {
    const connection =
      connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

    const selectQuery = `
      SELECT
        COUNT(login.user_id) AS total_users,
        SUM(CASE WHEN login.role = 'teacher' THEN 1 ELSE 0 END) AS total_teachers,
        SUM(CASE WHEN login.role = 'student' THEN 1 ELSE 0 END) AS total_students
      FROM login
      WHERE login.school_id = ?;
    `;

    connection.query(selectQuery, [schoolId], (err, rows, fields) => {
      connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
        connection
      );

      if (err) {
        console.error("Error executing database query:", err);
        return response.status(500).json({ error: err.message });
      }

      console.log("User Counts:", rows[0]);
      response.json({ userCounts: rows[0] });
    });
  } catch (error) {
    console.error("Error fetching user counts:", error);
    response.status(500).json({ error: "Internal Server Error" });
  }
};

exports.fetchTeachersForSchool = function (request, response) {
  const schoolId = request.params.schoolId;

  const connection =
    connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

  const selectQuery = `
  SELECT
  login.user_id,
  login.school_id,
  login.sap_id,
  
  login.school_name,
  
  teachers_info.first_name,
  teachers_info.last_name,
  teachers_info.contact_number,
  GROUP_CONCAT(DISTINCT subjects_info.subject_name) AS subjects_taught,
  GROUP_CONCAT(DISTINCT classes_info.class_name) AS classes_taught
FROM
  login
LEFT JOIN teachers_info ON login.user_id = teachers_info.user_id
LEFT JOIN courses_info ON login.user_id = courses_info.user_id
LEFT JOIN subjects_info ON courses_info.subject_id = subjects_info.subject_id
LEFT JOIN chapters_info ON courses_info.course_id = chapters_info.course_id
LEFT JOIN classes_info ON chapters_info.class_id = classes_info.class_id
WHERE
  login.school_id = ? AND login.role = 'teacher'
GROUP BY
  login.user_id, 
  login.school_id,
  login.sap_id,
  
  login.school_name,
  
  teachers_info.first_name,
  teachers_info.last_name,
  teachers_info.contact_number;
  
  `;

  connection.query(selectQuery, [schoolId], (err, rows, fields) => {
    connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
      connection
    );

    if (err) {
      console.error("Error executing database query:", err);
      return response.status(500).json({ error: err.message });
    }

    console.log("Teachers for School:", rows);
    response.json({ teachersData: rows });
  });
};

// exports.fetchStudentsForSchool = function (request, response) {
//   const schoolId = request.params.schoolId;

//   const connection =
//     connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

//   const selectQuery = `
//     SELECT
//       login.user_id,
//       login.sap_id,
//       students_info.first_name,
//       students_info.last_name,
//       students_info.contact_number,
//       students_info.father_name,
//       students_info.mother_name,
//       students_info.guardian_name,
//       students_info.email,
//       students_info.aadhar_card_number,
//       students_info.permanent_address,
//       students_info.city,
//       students_info.state
//     FROM
//       login
//     LEFT JOIN students_info ON login.user_id = students_info.user_id
//     WHERE
//       login.school_id = ? AND login.role = 'student';
//   `;

//   connection.query(selectQuery, [schoolId], (err, rows, fields) => {
//     connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
//       connection
//     );

//     if (err) {
//       console.error("Error executing database query:", err);
//       return response.status(500).json({ error: err.message });
//     }

//     console.log("Students for School:", rows);
//     response.json({ studentsData: rows });
//   });
// };

exports.addTeacher = function (request, response) {
  const connection =
    connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

  connection.beginTransaction(function (err) {
    if (err) {
      console.error("Error starting transaction:", err);
      return response.status(500).json({ error: "Internal Server Error" });
    }

    try {
      // ... (unchanged code)
      const {
        // teacher details from the form
        firstName,
        middleName,
        lastName,
        gender,
        birthday,
        email,
        contactNumber,
        alternativeNumber,
        aadharCardNumber,
        panCard,
        // address details
        permanentAddress,
        city,
        state,
        // family details
        fatherName,
        motherName,
        emergencyContactName,
        emergencyContactNumber,
      } = request.body;

      const schoolId = request.params.schoolId;

      const connection =
        connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

      // Generate sap_id and password
      const sapId = generateRandomSapId();
      const password = sapId; // Assuming password should be the same as sap_id
      console.log("Generated SAP ID:", sapId);
      console.log("Generated Password:", password);

      const role = "teacher";

      const insertLoginQuery = `
          INSERT INTO login (school_id, sap_id, password, school_name, role)
          VALUES (?, ?, ?, (SELECT school_name FROM schools_info WHERE school_id = ?), ?);
        `;

      const insertLoginPayload = [schoolId, sapId, password, schoolId, role];

      connection.query(insertLoginQuery, insertLoginPayload, (err, result) => {
        if (err) {
          console.error("Error executing login query:", err);
          return connection.rollback(function () {
            connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
              connection
            );
            response.status(500).json({ error: err.message });
          });
        }

        const insertTeacherQuery = `
            INSERT INTO teachers_info (
              user_id,
              first_name,
              middle_name,
              last_name,
              gender,
              birthday,
              email,
              contact_number,
              alternative_number,
              aadhar_card_number,
              pan_card,
              permanent_address,
              city,
              state,
              father_name,
              mother_name,
              emergency_contact_name,
              emergency_contact_number
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
          `;

        const insertTeacherPayload = [
          result.insertId, // Use the ID generated in the login query
          firstName,
          middleName,
          lastName,
          gender,
          birthday,
          email,
          contactNumber,
          alternativeNumber,
          aadharCardNumber,
          panCard,
          permanentAddress,
          city,
          state,
          fatherName,
          motherName,
          emergencyContactName,
          emergencyContactNumber,
        ];

        connection.query(
          insertTeacherQuery,
          insertTeacherPayload,
          (err, result) => {
            if (err) {
              console.error("Error executing teacher query:", err);
              return connection.rollback(function () {
                connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
                  connection
                );
                response.status(500).json({ error: err.message });
              });
            }

            connection.commit(function (err) {
              if (err) {
                console.error("Error committing transaction:", err);
                return connection.rollback(function () {
                  connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
                    connection
                  );
                  response.status(500).json({ error: err.message });
                });
              }

              console.log("Transaction completed successfully");
              connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
                connection
              );
              response.json({ message: "Teacher added successfully" });
            });
          }
        );
      });
    } catch (error) {
      console.error("Error adding teacher:", error);
      connection.rollback(function () {
        connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
          connection
        );
        response.status(500).json({ error: "Internal Server Error" });
      });
    }
  });
};

exports.fetchStudentsForSchool = function (request, response) {
  const schoolId = request.params.schoolId;

  const connection =
    connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

  const selectQuery = `
    SELECT
      login.user_id,
      login.sap_id,
      students_info.first_name,
      students_info.last_name,
      students_info.contact_number,
      students_info.father_name,
      students_info.mother_name,
      students_info.guardian_name,
      students_info.email,
      students_info.aadhar_card_number,
      students_info.permanent_address,
      students_info.city,
      students_info.state,
      students_info.account_number
    FROM
      login
    LEFT JOIN students_info ON login.user_id = students_info.user_id
    WHERE
      login.school_id = ? AND login.role = 'student';
  `;

  connection.query(selectQuery, [schoolId], (err, rows, fields) => {
    connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
      connection
    );

    if (err) {
      console.error("Error executing database query:", err);
      return response.status(500).json({ error: err.message });
    }

    console.log("Students for School:", rows);
    response.json({ studentsData: rows });
  });
};

exports.addStudent = function (request, response) {
  const connection =
    connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

  connection.beginTransaction(function (err) {
    if (err) {
      console.error("Error starting transaction:", err);
      return response.status(500).json({ error: "Internal Server Error" });
    }

    try {
      const {
        // student details from the form
        firstName,
        middleName,
        lastName,
        gender,
        birthday,
        email,
        contactNumber,
        alternativeNumber,
        aadharCardNumber,
        // address details
        permanentAddress,
        city,
        state,
        // family details
        fatherName,
        fatherContactNumber,
        fatherEmail,
        motherName,
        motherContactNumber,
        motherEmail,
        guardianName,
        guardianNumber,
        guardianEmail,
        //account details
        accountHolderName,
        bankName,
        accountNumber,
        ifscCode,
        accountType

      } = request.body;

      const schoolId = request.params.schoolId;

      const connection =
        connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

      // Generate sap_id and password
      const sapId = generateRandomSapId();
      const password = sapId; // Assuming password should be the same as sap_id
      console.log("Generated SAP ID:", sapId);
      console.log("Generated Password:", password);

      const role = "student";

      const insertLoginQuery = `
        INSERT INTO login (school_id, sap_id, password, school_name, role)
        VALUES (?, ?, ?, (SELECT school_name FROM schools_info WHERE school_id = ?), ?);
      `;

      const insertLoginPayload = [schoolId, sapId, password, schoolId, role];

      connection.query(insertLoginQuery, insertLoginPayload, (err, result) => {
        if (err) {
          console.error("Error executing login query:", err);
          return connection.rollback(function () {
            connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
              connection
            );
            response.status(500).json({ error: err.message });
          });
        }

        const insertStudentQuery = `
          INSERT INTO students_info (
            user_id,
            first_name,
            middle_name,
            last_name,
            gender,
            birthday,
            email,
            contact_number,
            alternative_number,
            aadhar_card_number,
            permanent_address,
            city,
            state,
            father_name,
            father_contact_number,
            father_email,
            mother_name,
            mother_contact_number,
            mother_email,
            guardian_name,
            guardian_number,
            guardian_email,
            account_holder_name,
            bank_name,
            account_number,
            ifsc_code,
            account_type
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? , ?, ?, ?, ?, ?);
        `;

        const insertStudentPayload = [
          result.insertId, // Use the ID generated in the login query
          firstName,
          middleName,
          lastName,
          gender,
          birthday,
          email,
          contactNumber,
          alternativeNumber,
          aadharCardNumber,
          permanentAddress,
          city,
          state,
          fatherName,
          fatherContactNumber,
          fatherEmail,
          motherName,
          motherContactNumber,
          motherEmail,
          guardianName,
          guardianNumber,
          guardianEmail,
          accountHolderName,
          bankName,
          accountNumber,
          ifscCode,
          accountType

        ];

        connection.query(
          insertStudentQuery,
          insertStudentPayload,
          (err, result) => {
            if (err) {
              console.error("Error executing student query:", err);
              return connection.rollback(function () {
                connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
                  connection
                );
                response.status(500).json({ error: err.message });
              });
            }

            connection.commit(function (err) {
              if (err) {
                console.error("Error committing transaction:", err);
                return connection.rollback(function () {
                  connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
                    connection
                  );
                  response.status(500).json({ error: err.message });
                });
              }

              console.log("Transaction completed successfully");
              connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
                connection
              );
              response.json({ message: "Student added successfully" });
            });
          }
        );
      });
    } catch (error) {
      console.error("Error adding student:", error);
      connection.rollback(function () {
        connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
          connection
        );
        response.status(500).json({ error: "Internal Server Error" });
      });
    }
  });
};

exports.fetchTeacherDetails = function (request, response) {
  const userId = request.params.userId; // Updated parameter name to userId
  const schoolId = request.params.schoolId; // Extract schoolId from URL

  const connection =
    connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

  const selectQuery = `
    SELECT
      login.*,
      teachers_info.*
    FROM login
    LEFT JOIN teachers_info ON login.user_id = teachers_info.user_id
    WHERE login.user_id = ? AND login.school_id = ?;
  `;

  connection.query(selectQuery, [userId, schoolId], (err, rows, fields) => {
    connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
      connection
    );

    if (err) {
      console.error("Error executing database query:", err);
      return response.status(500).json({ error: err.message });
    }

    console.log("Teacher Details:", rows[0]);
    response.json({ teacherDetails: rows[0] });
  });
};

exports.fetchStudentDetails = function (request, response) {
  const userId = request.params.userId;
  const schoolId = request.params.schoolId;

  const connection =
    connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

  const selectQuery = `
    SELECT
      login.*,
      students_info.*
    FROM login
    LEFT JOIN students_info ON login.user_id = students_info.user_id
    WHERE login.user_id = ? AND login.school_id = ?;
  `;

  connection.query(selectQuery, [userId, schoolId], (err, rows, fields) => {
    connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
      connection
    );

    if (err) {
      console.error("Error executing database query:", err);
      return response.status(500).json({ error: err.message });
    }

    console.log("Student Details:", rows[0]);
    response.json({ studentDetails: rows[0] });
  });
};

function generateRandomSapId() {
  const length = 10;
  const characters = "0123456789";
  let result = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters.charAt(randomIndex);
  }

  return result;
}



// ------------------------Working Code ---------------------------------------

// ------------------------Testing Code ---------------------------------------


// Function to create a new course and insert into the database
exports.createCourse = async function (request, response) {
  try {
    const { courseName, courseDescription, subjectId, classId } = request.body;
    console.log('Received Data:', { courseName, courseDescription, subjectId, classId });

    // Get the token from the request headers
    const token = request.headers.authorization.split(' ')[1]; // Assuming the token is sent in the Authorization header

    // Verify the token
    jwt.verify(token, process.env.SECRET_KEY, async (err, decoded) => {
      if (err) {
        // Token verification failed
        console.error("Token verification failed:", err);
        return response.status(401).json({ message: "Unauthorized" });
      }

      // Token verified successfully, extract user_id
      const userId = decoded.user_id;

      // Insert into the database
      const connection = connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();
      const insertQuery = `
        INSERT INTO courses_info (user_id, course_name, course_description, subject_id, class_id)
        VALUES (?, ?, ?, ?, ?)
      `;
      const insertQueryPayload = [userId, courseName, courseDescription, subjectId, classId];

      connection.query(insertQuery, insertQueryPayload, (err, result) => {
        console.log('result: ', result.insertId);
        connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(connection);

        if (err) {
          console.error('Error executing database query:', err);
          return response.status(500).json({ error: err.message });
        }

        // Send a success response

        response.json({ success: true, message: 'Course created successfully', courseId: result.insertId });
      });
    });
  } catch (error) {
    console.error('Error creating course:', error);
    response.status(500).json({ error: 'Internal Server Error' });
  }
};
//chatgpt generated api.  
exports.saveCoursegpt = function handleRequest(req, res) {
  const data = req.body;
  let connection;

  mysqlConnectionStringProvider.getMysqlConnection((err, conn) => {
    if (err) {
      return handleError(err);
    }

    connection = conn;

    connection.beginTransaction((err) => {
      if (err) {
        return handleError(err);
      }

      for (const semester of data.semesters) {
        let contentString = JSON.stringify(semester.content);
        let values = [semester.id, semester.name, contentString];

        connection.query('INSERT INTO semesters ( semester_id, name, content) VALUES (?,?,?)', values, (err, result) => {
          if (err) {
            return handleError(err);
          }

          console.log("response: ", result, "ResultSetHeader", result.insertId);

          for (const semesterTest of semester.semesterTest) {
            contentString = JSON.stringify(semesterTest.content);
            values = [semesterTest.id, result.insertId, semesterTest.name, semesterTest.timeLimit.hours, semesterTest.timeLimit.minutes, semesterTest.numberOfQuestions, contentString];

            connection.query('INSERT INTO semester_tests ( test_id, semester_id , name , time_limit_hours , time_limit_minutes , number_of_questions , content) VALUES (?,?,?,?,?,?,?)', values, handleQueryCallback);
          }

          for (const chapter of semester.chapters) {
            contentString = JSON.stringify(chapter.content);
            values = [chapter.id, result.insertId, chapter.name, contentString];

            connection.query('INSERT INTO chapters ( chapter_id, semester_id ,name, content) VALUES (?,?,?,?)', values, (err, chapterRes) => {
              if (err) {
                return handleError(err);
              }

              for (const chapterTest of chapter.chapterTest) {
                contentString = JSON.stringify(chapterTest.content);
                values = [chapterTest.id, chapterRes.insertId, chapterTest.name, chapterTest.timeLimit.hours, chapterTest.timeLimit.minutes, chapterTest.numberOfQuestions, contentString];

                connection.query('INSERT INTO chapter_tests ( chapter_test_id, chapter_id , name , time_limit_hours , time_limit_minutes , number_of_questions , content) VALUES (?,?,?,?,?,?,?)', values, handleQueryCallback);
              }

              for (const section of chapter.sections) {
                contentString = JSON.stringify(section.content);
                values = [section.id, chapterRes.insertId, section.name, contentString];

                connection.query('INSERT INTO sections (section_id, chapter_id ,name, content) VALUES (?,?,?,?)', values, handleQueryCallback);
              }
            });
          }
        });
      }

      connection.commit((err) => {
        if (err) {
          return handleError(err);
        }

        mysqlConnectionStringProvider.closeMysqlConnection(connection, () => {
          res.status(200).json({ message: 'data added successfully' });
        });
      });
    });

    const handleQueryCallback = (err) => {
      if (err) {
        return handleError(err);
      }
    };

    const handleError = (err) => {
      if (connection) {
        connection.rollback(() => {
          mysqlConnectionStringProvider.closeMysqlConnection(connection, () => {
            console.error("Rollback error:", err);
            res.status(500).json({ error: 'An error occurred while processing the request' });
          });
        });
      } else {
        console.error("Error:", err);
        res.status(500).json({ error: 'An error occurred while processing the request' });
      }
    };
  });
};

// save course api 

// exports.saveCourse = async function (request, response) {
//   try {
//     const { courseId, semesterId, chapterId, semesterTestId, sectionId, chapterTestId, content, timeLimitHours, timeLimitMinutes, numberOfQuestions } = request.body;
//     // Get the token from the request headers
//     const contentString = JSON.stringify(content);
//     // const token = request.headers.authorization.split(' ')[1]; // Assuming the token is sent in the Authorization header

//     // Verify the token


//       // Token verified successfully, extract user_id
//       //we have the course id we need to check if data exists for this course id if it does we update if not we insert

//       // Insert into the database
//       const connection = connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();
//       // ------------------------------------------------------------------------------
//       // if (!semesterId && !chapterId && !semesterTestId && !sectionId && !chapterTestId) {
//       //   //initial mount

//       //   return response.json({ status: 'select content to save' });
//       // }
//       //if section is selected.
//       if (semesterId && chapterId && sectionId) {
//         //stringfy content.
//         const updateQuery = `
//         UPDATE sections
//         SET content = ?
//         WHERE section_id = ? AND chapter_id = ?;
//         `
//         connection.query(updateQuery, [contentString, sectionId, chapterId], (err, result, fields) => {
//           connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
//             connection
//           );

//           // if (err) {
//           //   console.error("Error executing database query:", err);
//           //   return response.status(500).json({ error: err.message });
//           // }

//           // // Check if any rows were affected
//           // if (result.affectedRows === 0) {
//           //   return response.status(404).json({ message: 'No section found or no data updated' });
//           // }

//           response.json({ status:'success' })

//         })
//       } else if (semesterId && chapterId && chapterTestId) {
//         const selectQuery = `SELECT 
//           chapter_tests.chapter_tests_content 
//           FROM
//           chapter_tests
//           WHERE 
//           chapter_tests.chapter_tests_id = ? AND chapter_tests.chapter_id = ?
//           `
//         connection.query(selectQuery, [chapterTestId, chapterId], (err, rows, fields) => {
//           connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
//             connection
//           );

//           if (err) {
//             console.error("Error executing database query:", err);
//             return response.status(500).json({ error: err.message });
//           }


//           if (rows.length === 0) {
//             return response.json({ status: 'no data' });
//           }

//           if (rows.length === 1) {
//             console.log("rows : ", rows, "and ", rows[0]);
//             const content = rows[0].chapter_tests_content;
//             response.json({ content: content });
//           }

//         })
//       } else if (semesterId && chapterId) {
//         const selectQuery = `SELECT 
//           chapters.chapter_content 
//           FROM
//           chapters
//           WHERE 
//           chapters.chapter_id = ? AND chapters.semester_id = ?
//           `
//         connection.query(selectQuery, [chapterId, semesterId], (err, rows, fields) => {
//           connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
//             connection
//           );

//           if (err) {
//             console.error("Error executing database query:", err);
//             return response.status(500).json({ error: err.message });
//           }

//           if (rows.length === 0) {
//             return response.json({ status: 'no data' });
//           }

//           if (rows.length === 1) {
//             console.log("rows : ", rows, "and ", rows[0]);
//             const content = rows[0].chapter_content;
//             response.json({ content: content });
//           }

//         })
//       } else if (semesterId && semesterTestId) {
//         const selectQuery = `SELECT 
//           semester_tests.semester_tests_content
//           FROM
//           semester_tests
//           WHERE 
//           semester_tests.semester_tests_id = ? AND semester_tests.semester_id = ?
//           `
//         connection.query(selectQuery, [semesterTestId, semesterId], (err, rows, fields) => {
//           connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
//             connection
//           );

//           if (err) {
//             console.error("Error executing database query:", err);
//             return response.status(500).json({ error: err.message });
//           }

//           if (rows.length === 0) {
//             return response.json({ status: 'no data' });
//           }

//           if (rows.length === 1) {
//             console.log("rows : ", rows, "and ", rows[0]);
//             const content = rows[0].semester_tests_content;
//             response.json({ content: content });
//           }

//         })
//       } else {
//         const selectQuery = `SELECT 
//           semesters.semester_content
//           FROM
//           semesters
//           WHERE 
//           semesters.semester_id = ? AND semesters.course_id = ?
//           `
//         connection.query(selectQuery, [semesterId, courseId], (err, rows, fields) => {
//           connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
//             connection
//           );

//           if (err) {
//             console.error("Error executing database query:", err);
//             return response.status(500).json({ error: err.message });
//           }


//           if (rows.length === 0) {
//             return response.json({ status: 'no data' });
//           }

//           if (rows.length === 1) {
//             console.log("rows : ", rows, "and ", rows[0]);
//             const content = rows[0].semester_content;
//             if (!content) {
//               return response.json({ status: 'no data' });
//             } else {
//               response.json({ content: content });
//             }
//           }
//         })
//       }
//       // ------------------------------------------------------------------------------
//       const insertQuery = `
//         INSERT INTO courses_info (user_id, course_name, course_description, subject_id, class_id)
//         VALUES (?, ?, ?, ?, ?)
//       `;
//       const insertQueryPayload = [userId, courseName, courseDescription, subjectId, classId];

//       connection.query(insertQuery, insertQueryPayload, (err, result) => {
//         console.log('result: ', result.insertId);
//         connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(connection);

//         if (err) {
//           console.error('Error executing database query:', err);
//           return response.status(500).json({ error: err.message });
//         }

//         // Send a success response

//         response.json({ success: true, message: 'Course created successfully', courseId: result.insertId });
//       });

//   } catch (error) {
//     console.error('Error creating course:', error);
//     response.status(500).json({ error: 'Internal Server Error' });
//   }
// };

exports.saveCourse = async function (request, response) {
  try {
    const { courseId, semesterId, chapterId, semesterTestId, sectionId, chapterTestId, content, timeLimitHours, timeLimitMinutes, numberOfQuestions } = request.body;
    const contentString = JSON.stringify(content);
    const connection = connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

    if (semesterId && chapterId && sectionId) {
      const updateQuery = `
        UPDATE sections
        SET content = ?
        WHERE section_id = ? AND chapter_id = ?;
      `;
      connection.query(updateQuery, [contentString, sectionId, chapterId], (err, result, fields) => {
        connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(connection);
        if (err) {
          console.error("Error executing database query:", err);
          return response.status(500).json({ error: err.message });
        }
        response.json({ status: 'success' });
      });
    } else if (semesterId && chapterId && chapterTestId) {
      const updateQuery = `
        UPDATE chapter_tests
        SET chapter_tests_content = ?,
            time_limit_hours = ?,
            time_limit_minutes = ?,
            number_of_questions = ?
        WHERE chapter_tests_id = ? AND chapter_id = ?;
      `;
      connection.query(updateQuery, [contentString, timeLimitHours, timeLimitMinutes, numberOfQuestions, chapterTestId, chapterId], (err, result, fields) => {
        connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(connection);
        if (err) {
          console.error("Error executing database query:", err);
          return response.status(500).json({ error: err.message });
        }
        response.json({ status: 'success' });
      });
    } else if (semesterId && chapterId) {
      const updateQuery = `
      UPDATE chapters
      SET chapter_content = ?
      WHERE chapter_id = ? AND semester_id = ?;
      `;
      connection.query(updateQuery, [contentString, chapterId, semesterId], (err, result, fields) => {
        connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(connection);
        if (err) {
          console.error("Error executing database query:", err);
          return response.status(500).json({ error: err.message });
        }
        response.json({ status: 'success' });
      });
    } else if (semesterId && semesterTestId) {
      const updateQuery = `
        UPDATE semester_tests
        SET semester_tests_content = ?,
            time_limit_hours = ?,
            time_limit_minutes = ?,
            number_of_questions = ?
        WHERE semester_tests_id = ? AND semester_id = ?;
      `;
      connection.query(updateQuery, [contentString, timeLimitHours, timeLimitMinutes, numberOfQuestions, semesterTestId, semesterId], (err, result, fields) => {
        connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(connection);
        if (err) {
          console.error("Error executing database query:", err);
          return response.status(500).json({ error: err.message });
        }
        response.json({ status: 'success' });
      });
    } else if (semesterId) {
      const updateQuery = `
      UPDATE semesters
      SET semester_content = ?
      WHERE course_id = ? AND semester_id = ?;
      `;
      connection.query(updateQuery, [contentString, courseId, semesterId], (err, result, fields) => {
        connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(connection);
        if (err) {
          console.error("Error executing database query:", err);
          return response.status(500).json({ error: err.message });
        }
        response.json({ status: 'success' });
      });
    }
  } catch (error) {
    console.error("Error:", error);
    response.status(500).json({ error: error.message });
  }
};

exports.getSidebarData = function (request, response) {

  const courseId = request.query.courseId;

  console.log("body ", courseId);

  const connection =
    connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

  const selectQuery = `
  SELECT 
  semesters.semester_id,
  semesters.name AS semester_name,
  chapters.chapter_id,
  chapters.name AS chapter_name,
  semester_tests.semester_tests_id,
  semester_tests.name AS semester_test_name,
  sections.section_id,
  sections.name AS section_name,
  chapter_tests.chapter_tests_id,
  chapter_tests.name AS chapter_tests_name
FROM 
  courses_info
LEFT JOIN 
  semesters ON courses_info.course_id = semesters.course_id
LEFT JOIN 
  chapters ON semesters.semester_id = chapters.semester_id
LEFT JOIN 
  semester_tests ON semesters.semester_id = semester_tests.semester_id
LEFT JOIN 
  sections ON chapters.chapter_id = sections.chapter_id
LEFT JOIN 
  chapter_tests ON chapters.chapter_id = chapter_tests.chapter_id
WHERE 
  courses_info.course_id = ?
ORDER BY
  semesters.semester_id ASC,
  chapters.chapter_id ASC,
  semester_tests.semester_tests_id ASC,
  sections.section_id ASC,
  chapter_tests.chapter_tests_id ASC;
  `;

  connection.query(selectQuery, [courseId], (err, rows, fields) => {
    connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
      connection
    );

    if (err) {
      console.error("Error executing database query:", err);
      return response.status(500).json({ error: err.message });
    }
    console.log("rows : ", rows);
    if (rows.length === 1 && !rows[0].semester_id) {
      return response.json({ status: 'no data' });
    }
    // ------------------------------------------------------------------------------
    const semesters = {};
    rows.forEach(row => {
      const { semester_id, semester_name, chapter_id, chapter_name, semester_tests_id, semester_test_name, section_id, section_name, chapter_tests_id, chapter_tests_name } = row;

      if (!semesters[semester_id] && semester_id) {
        semesters[semester_id] = {
          id: semester_id,
          name: semester_name,
          chapters: {},
          semesterTest: {}
        };
      }

      if (!semesters[semester_id].chapters[chapter_id] && chapter_id) {
        console.log("chapter condition:")
        semesters[semester_id].chapters[chapter_id] = {
          id: chapter_id,
          name: chapter_name,
          sections: {},
          chapterTest: {}
        };
      }

      if (!semesters[semester_id].semesterTest[semester_tests_id] && semester_tests_id) {
        semesters[semester_id].semesterTest[semester_tests_id] = {
          id: semester_tests_id,
          name: semester_test_name,
        };
      }

      if (semesters[semester_id].chapters[chapter_id] && chapter_id) {
        if (!semesters[semester_id].chapters[chapter_id].sections[section_id] && section_id) {
          semesters[semester_id].chapters[chapter_id].sections[section_id] = {
            id: section_id,
            name: section_name
          }
          console.log("section added", semesters[semester_id].chapters[chapter_id].sections[section_id]);
        }
      }

      if (semesters[semester_id].chapters[chapter_id] && chapter_id) { //if chapter is not present dont check to add tests
        if (!semesters[semester_id].chapters[chapter_id].chapterTest[chapter_tests_id] && chapter_tests_id) {
          semesters[semester_id].chapters[chapter_id].chapterTest[chapter_tests_id] = {
            id: chapter_tests_id,
            name: chapter_tests_name
          }
        }
      }
    });
    console.log("final semesters", semesters);
    // Convert semesters object into an array
    const result = Object.values(semesters).map(semester => {
      semester.chapters = Object.values(semester.chapters).map(chapter => {
        console.log("sections:", chapter.sections);
        chapter.sections = Object.values(chapter.sections);
        chapter.chapterTest = Object.values(chapter.chapterTest);
        return chapter
      })
      semester.semesterTest = Object.values(semester.semesterTest);
      return semester;
    });

    // ------------------------------------------------------------------------------
    response.json({ semesters: result });
  });
};

exports.getParentData = function (request, response) {

  const { courseId, semesterId } = request.query;

  console.log("body ", courseId);

  const connection =
    connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

  const selectQuery = `
  SELECT 
  semesters.semester_id,
  semesters.name AS semester_name,
  semesters.semester_content AS semester_content,
  chapters.chapter_id,
  chapters.name AS chapter_name,
  chapters.chapter_content AS chapter_content,
  semester_tests.semester_tests_id,
  semester_tests.name AS semester_test_name,
  semester_tests.time_limit_hours AS semester_tests_time_limit_hours,
  semester_tests.time_limit_minutes AS semester_tests_time_limit_minutes,
  semester_tests.number_of_questions AS semester_tests_number_of_questions,
  semester_tests.semester_tests_content AS semester_tests_content,
  sections.section_id,
  sections.name AS section_name,
  sections.content AS section_content,
  chapter_tests.chapter_tests_id,
  chapter_tests.name AS chapter_tests_name,
  chapter_tests.time_limit_hours AS chapter_tests_time_limit_hours,
  chapter_tests.time_limit_minutes AS chapter_tests_time_limit_minutes,
  chapter_tests.number_of_questions AS chapter_tests_number_of_questions,
  chapter_tests.chapter_tests_content AS chapter_tests_content
FROM 
  semesters
LEFT JOIN 
  chapters ON semesters.semester_id = chapters.semester_id
LEFT JOIN 
  semester_tests ON semesters.semester_id = semester_tests.semester_id
LEFT JOIN 
  sections ON chapters.chapter_id = sections.chapter_id
LEFT JOIN 
  chapter_tests ON chapters.chapter_id = chapter_tests.chapter_id
WHERE 
semesters.semester_id = ?
ORDER BY
  chapters.chapter_id ASC,
  semester_tests.semester_tests_id ASC,
  sections.section_id ASC,
  chapter_tests.chapter_tests_id ASC;
  `;

  connection.query(selectQuery, [semesterId], (err, rows, fields) => {
    connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
      connection
    );

    if (err) {
      console.error("Error executing database query:", err);
      return response.status(500).json({ error: err.message });
    }
    console.log("rows : ", rows);
    if (rows.length === 1 && !rows[0].semester_id) {
      return response.json({ status: 'no data' });
    }
    // ------------------------------------------------------------------------------
    const semesters = {};
    rows.forEach(row => {
      const { semester_id, semester_name, semester_content, chapter_id, chapter_name, chapter_content, semester_tests_id, semester_test_name, 
        semester_tests_time_limit_hours,semester_tests_time_limit_minutes,semester_tests_number_of_questions,semester_tests_content, section_id, section_name, section_content, 
        chapter_tests_id, chapter_tests_name,chapter_tests_time_limit_hours,chapter_tests_time_limit_minutes,chapter_tests_number_of_questions, chapter_tests_content } = row;

      if (!semesters[semester_id] && semester_id) {
        semesters[semester_id] = {
          id: semester_id,
          name: semester_name,
          content: semester_content,
          chapters: {},
          semesterTest: {}
        };
      }

      if (!semesters[semester_id].chapters[chapter_id] && chapter_id) {
        semesters[semester_id].chapters[chapter_id] = {
          id: chapter_id,
          name: chapter_name,
          content: chapter_content,
          sections: [],
          chapterTest: []
        };
      }

      if (!semesters[semester_id].semesterTest[semester_tests_id] && semester_tests_id) {
        semesters[semester_id].semesterTest[semester_tests_id] = {
          id: semester_tests_id,
          name: semester_test_name,
          timeLimit:{
            hours:semester_tests_time_limit_hours || 1,
            minutes:semester_tests_time_limit_minutes || 30
          },
          numberOfQuestions:semester_tests_number_of_questions || 5,
          content: semester_tests_content || {slides:[{id:1234 , content:[{id:23 , type:'Quiz' , data:null}]}]}
        };
      }

      if (semesters[semester_id].chapters[chapter_id] && chapter_id) {
        if (!semesters[semester_id].chapters[chapter_id].sections[section_id] && section_id) {
          semesters[semester_id].chapters[chapter_id].sections[section_id] = {
            id: section_id,
            name: section_name,
            content: section_content
          }
          console.log("section added", semesters[semester_id].chapters[chapter_id].sections[section_id]);
        }
      }

      // if (section_id && section_name) {
      //   semesters[semester_id].chapters[chapter_id].sections.push({
      //     id: section_id,
      //     name: section_name,
      //     content: section_content
      //   });
      // }

      if (semesters[semester_id].chapters[chapter_id] && chapter_id) { //if chapter is not present dont check to add tests
        if (!semesters[semester_id].chapters[chapter_id].chapterTest[chapter_tests_id] && chapter_tests_id) {
          semesters[semester_id].chapters[chapter_id].chapterTest[chapter_tests_id] = {
            id: chapter_tests_id,
            name: chapter_tests_name,
            timeLimit:{
              hours:chapter_tests_time_limit_hours || 1,
              minutes:chapter_tests_time_limit_minutes || 30
            },
            numberOfQuestions:chapter_tests_number_of_questions || 5,
            content: chapter_tests_content
          }
        }
      }
      // if (chapter_tests_id && chapter_tests_name) {
      //   semesters[semester_id].chapters[chapter_id].chapterTest.push({
      //     id: chapter_tests_id,
      //     name: chapter_tests_name,
      //     content: chapter_tests_content
      //   });
      // }
    });

    // Convert semesters object into an array
    const result = Object.values(semesters).map(semester => {
      semester.chapters = Object.values(semester.chapters).map(chapter => {
        console.log("sections:", chapter.sections);
        chapter.sections = Object.values(chapter.sections);
        chapter.chapterTest = Object.values(chapter.chapterTest);
        return chapter
      })
      semester.semesterTest = Object.values(semester.semesterTest);
      return semester;
    });
    
    // const result = Object.values(semesters).map(semester => {
    //   semester.chapters = Object.values(semester.chapters);
    //   semester.semesterTest = Object.values(semester.semesterTest);
    //   return semester;
    // });

    // ------------------------------------------------------------------------------
    if (result.length === 0) {
      return response.json({ status: "no data" });
    }
    response.json({ semesters: result });
  });
};

exports.getCourseCreatorData = function (request, response) {

  const { courseId, semesterId, chapterId, semesterTestId, sectionId, chapterTestId } = request.query;

  console.log("body ", courseId);

  const connection =
    connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

  if (!semesterId && !chapterId && !semesterTestId && !sectionId && !chapterTestId) {
    //initial mount
    return response.json({ status: 'initial mount' });
  }

  if (semesterId && chapterId && sectionId) {
    const selectQuery = `SELECT 
      sections.content 
      FROM
      sections
      WHERE 
      sections.section_id = ? AND sections.chapter_id = ?
      `
    connection.query(selectQuery, [sectionId, chapterId], (err, rows, fields) => {
      connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
        connection
      );

      if (err) {
        console.error("Error executing database query:", err);
        return response.status(500).json({ error: err.message });
      }

      if (rows.length === 0) {
        return response.json({ status: 'no data' });
      }

      if (rows.length === 1) {
        console.log("rows : ", rows, "and ", rows[0]);
        const content = rows[0].content;
        response.json({ content: content });
      }

    })
  } else if (semesterId && chapterId && chapterTestId) {
    const selectQuery = `SELECT 
      chapter_tests.chapter_tests_content 
      FROM
      chapter_tests
      WHERE 
      chapter_tests.chapter_tests_id = ? AND chapter_tests.chapter_id = ?
      `
    connection.query(selectQuery, [chapterTestId, chapterId], (err, rows, fields) => {
      connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
        connection
      );

      if (err) {
        console.error("Error executing database query:", err);
        return response.status(500).json({ error: err.message });
      }


      if (rows.length === 0) {
        return response.json({ status: 'no data' });
      }

      if (rows.length === 1) {
        console.log("rows : ", rows, "and ", rows[0]);
        const content = rows[0].chapter_tests_content;
        response.json({ content: content });
      }

    })
  } else if (semesterId && chapterId) {
    const selectQuery = `SELECT 
      chapters.chapter_content 
      FROM
      chapters
      WHERE 
      chapters.chapter_id = ? AND chapters.semester_id = ?
      `
    connection.query(selectQuery, [chapterId, semesterId], (err, rows, fields) => {
      connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
        connection
      );

      if (err) {
        console.error("Error executing database query:", err);
        return response.status(500).json({ error: err.message });
      }

      if (rows.length === 0) {
        return response.json({ status: 'no data' });
      }

      if (rows.length === 1) {
        console.log("rows : ", rows, "and ", rows[0]);
        const content = rows[0].chapter_content;
        response.json({ content: content });
      }

    })
  } else if (semesterId && semesterTestId) {
    const selectQuery = `SELECT 
      semester_tests.semester_tests_content
      FROM
      semester_tests
      WHERE 
      semester_tests.semester_tests_id = ? AND semester_tests.semester_id = ?
      `
    connection.query(selectQuery, [semesterTestId, semesterId], (err, rows, fields) => {
      connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
        connection
      );

      if (err) {
        console.error("Error executing database query:", err);
        return response.status(500).json({ error: err.message });
      }

      if (rows.length === 0) {
        return response.json({ status: 'no data' });
      }

      if (rows.length === 1) {
        console.log("rows : ", rows, "and ", rows[0]);
        const content = rows[0].semester_tests_content;
        response.json({ content: content });
      }

    })
  } else {
    const selectQuery = `SELECT 
      semesters.semester_content
      FROM
      semesters
      WHERE 
      semesters.semester_id = ? AND semesters.course_id = ?
      `
    connection.query(selectQuery, [semesterId, courseId], (err, rows, fields) => {
      connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
        connection
      );

      if (err) {
        console.error("Error executing database query:", err);
        return response.status(500).json({ error: err.message });
      }


      if (rows.length === 0) {
        return response.json({ status: 'no data' });
      }

      if (rows.length === 1) {
        console.log("rows : ", rows, "and ", rows[0]);
        const content = rows[0].semester_content;
        if (!content) {
          return response.json({ status: 'no data' });
        } else {
          response.json({ content: content });
        }
      }
    })
  }
};

exports.addSemester = function (request, response) {
  try {
    const { name, courseId } = request.body;
    const connection =
      connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

    const insertQuery = `
    INSERT INTO semesters (course_id, name)
    VALUES (?, ?);
    `
    connection.query(insertQuery, [courseId, name], (err, result) => {
      if (err) {
        console.error("Error executing database query:", err);
        return response.status(500).json({ error: err.message });
      }

      console.log("result : ", result);
      response.json({ status: 'success', insertId: result.insertId });
    })

  } catch (error) {
    console.log(error);
  }
}

exports.addChapter = function (request, response) {
  try {
    const { name, courseId, semesterId } = request.body;
    const connection =
      connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

    const insertQuery = `
    INSERT INTO chapters (semester_id, name)
    VALUES (?, ?);
    `
    connection.query(insertQuery, [semesterId, name], (err, result) => {
      if (err) {
        console.error("Error executing database query:", err);
        return response.status(500).json({ error: err.message });
      }

      console.log("result : ", result);
      response.json({ status: 'success', insertId: result.insertId });
    })

  } catch (error) {
    console.log(error);
  }
}

exports.addSection = function (request, response) {
  try {
    const { name, chapterId } = request.body;
    const connection =
      connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

    const insertQuery = `
    INSERT INTO sections (chapter_id, name)
    VALUES (?, ?);
    `
    connection.query(insertQuery, [chapterId, name], (err, result) => {
      if (err) {
        console.error("Error executing database query:", err);
        return response.status(500).json({ error: err.message });
      }

      console.log("result : ", result);
      response.json({ status: 'success', insertId: result.insertId });
    })

  } catch (error) {
    console.log(error);
  }
}

exports.addChapterTest = function (request, response) {
  try {
    const { name, chapterId } = request.body;

    const connection =
      connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

    const insertQuery = `
    INSERT INTO chapter_tests (chapter_id, name , time_limit_hours , time_limit_minutes , number_of_questions)
    VALUES (?, ? , ?,?,?);
    `
    //by default we will populate the time limit columns and the no. of questions to display.
    const time_limit_hours = 1;
    const time_limit_minutes = 30;
    const number_of_questions = 5;

    connection.query(insertQuery, [chapterId, name, time_limit_hours, time_limit_minutes, number_of_questions], (err, result) => {
      if (err) {
        console.error("Error executing database query:", err);
        return response.status(500).json({ error: err.message });
      }

      console.log("result : ", result);
      response.json({ status: 'success', insertId: result.insertId });
    })

  } catch (error) {
    console.log(error);
  }
}

exports.addSemesterTest = function (request, response) {
  try {
    const { name, semesterId, content } = request.body;

    const connection =
      connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

    const insertQuery = `
    INSERT INTO semester_tests (semester_id, name , time_limit_hours , time_limit_minutes , number_of_questions , semester_tests_content)
    VALUES (?, ? , ?,?,? , ?);
    `
    //by default we will populate the time limit columns and the no. of questions to display.
    const time_limit_hours = 1;
    const time_limit_minutes = 30;
    const number_of_questions = 5;
    const semester_tests_content = JSON.stringify(content);
    connection.query(insertQuery, [semesterId, name, time_limit_hours, time_limit_minutes, number_of_questions , semester_tests_content], (err, result) => {
      if (err) {
        console.error("Error executing database query:", err);
        return response.status(500).json({ error: err.message });
      }

      console.log("result : ", result);
      response.json({ status: 'success', insertId: result.insertId });
    })

  } catch (error) {
    console.log(error);
  }
}

// exports.newSaveCourse = async function (request, response) {
//   try {
//     const data = request.body;
//     const connection = connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();
//     let contentString;
//     for(semester of data.semesters){
//       contentString = json.stringfy(semester.content);
//       const updateQuery = `
//         UPDATE semesters
//         SET semester_content = ?
//         WHERE semester_id = ?;
//       `;
//       connection.query(updateQuery, [contentString, semester.id], (err, result, fields) => {
//         connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(connection);
//         if (err) {
//           console.error("Error executing database query:", err);
//           return response.status(500).json({ error: err.message });
//         }
//         response.json({ status: 'success' });
//       });
//     }

//   } catch (error) {
//     console.error("Error:", error);
//     response.status(500).json({ error: error.message });
//   }
// };


// //semester save 
      // connection.query(updateSemesterQuery, [contentString, semester.id], function (err, result) {
      //   console.log("semester query called");
      //   if (err) {
      //     console.error("Error updating semester content:", err);
      //     connection.rollback(function () {
      //       connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(connection);
      //       response.status(500).json({ error: err.message });
      //     });
      //     return;
      //   }else{
      //     //bulk update 
      //     //loop semester.chapters get all chapter content in array [content , content]; [[id ,content ]; [id ,content]];
      //     data.semesters
      //     connection.query(updateSemesterQuery, [contentString, semester.id], function (err, result) {
      //       console.log("semester query called");
      //       if (err) {
      //         console.error("Error updating semester content:", err);
      //         connection.rollback(function () {
      //           connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(connection);
      //           response.status(500).json({ error: err.message });
      //         });
      //         return;
      //       }else{

      //       }
      //     })
      //   }
      // })
exports.newSaveCourse = function (request, response) {
  try {
    const data = request.body.data;
    const connection = connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

    // Start transaction
    connection.beginTransaction(function (err) {
      if (err) {
        console.error("Error starting transaction:", err);
        return response.status(500).json({ error: err.message });
      }
      // Iterate through semesters
      data.semesters.forEach(function (semester) {
        const contentString = JSON.stringify(semester.content);

        // Update semester content
        const updateSemesterQuery = `
          UPDATE semesters
          SET semester_content = ?
          WHERE semester_id = ?;
        `;

        // Execute update query for semester
        connection.query(updateSemesterQuery, [contentString, semester.id], function (err, result) {
          console.log("semester query called");
          if (err) {
            console.error("Error updating semester content:", err);
            connection.rollback(function () {
              connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(connection);
              response.status(500).json({ error: err.message });
            });
            return;
          }

          // Iterate through chapters within the semester
          semester.chapters.forEach(function (chapter) {
            console.log("chapter query called");
            const chapterContentString = JSON.stringify(chapter.content);

            // Update chapter content
            const updateChapterQuery = `
              UPDATE chapters
              SET chapter_content = ?
              WHERE chapter_id = ?;
            `;

            // Execute update query for chapter
            connection.query(updateChapterQuery, [chapterContentString, chapter.id], function (err, result) {
              if (err) {
                console.error("Error updating chapter content:", err);
                connection.rollback(function () {
                  connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(connection);
                  response.status(500).json({ error: err.message });
                });
                return;
              }

              // Iterate through sections within the chapter

              chapter.sections.forEach(function (section) {
                console.log("semester query called");
                console.log("section", section);
                const sectionContentString = JSON.stringify(section.content);

                // Update section content
                const updateSectionQuery = `
                  UPDATE sections
                  SET content = ?
                  WHERE section_id = ?;
                `;

                // Execute update query for section
                connection.query(updateSectionQuery, [sectionContentString, section.id], function (err, result) {
                  if (err) {
                    console.error("Error updating section content:", err);
                    connection.rollback(function () {
                      console.log("inside rollback section")
                      connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(connection);
                      response.status(500).json({ error: err.message });
                    });
                    return;
                  }
                });
              });
            });
          });
        });
        console.log("loop finished");
      });

      // Commit transaction
      connection.commit(function (err) {
        console.log("commit called")
        if (err) {
          console.error("Error committing transaction:", err);
          connection.rollback(function () {
            connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(connection);
            response.status(500).json({ error: err.message });
          });
          return;
        }
        connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(connection);
        response.json({ status: 'success' });
      });
    });
  } catch (error) {
    console.error("Error:", error);
    response.status(500).json({ error: error.message });
  }
};

exports.getCourseInfo = function (request, response) {
  const { courseId } = request.query;
  console.log("body ", courseId);
  const connection = connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

  const selectQuery = `
  SELECT
  c.course_name,
  c.course_description,
  s.subject_name
  FROM
    courses_info AS c
  INNER JOIN
    subjects_info AS s ON c.subject_id = s.subject_id
  WHERE
    c.course_id = ?;
    `
  connection.query(selectQuery, [courseId], (err, rows, fields) => {
    connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
      connection
    );

    if (err) {
      console.error("Error executing database query:", err);
      return response.status(500).json({ error: err.message });
    }

    if (rows.length === 1) {
      console.log("rows : ", rows, "and ", rows[0]);
      response.json({ rows: rows[0] });
    }

  })
};

exports.finalSaveCourse = function (request, response) {
  try {
    const data = request.body.data;
    const connection = connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();
    //data that we get in body
    /*
      {
        semesters: [
          {
            id:,
            name:,
            content:,
            chapters:[{ id,name,content,sections:[],chapterTest:[] },{ id,name,content,sections:[],chapterTest:[] },],
            semesterTest:[]
          } , {} , {}
        ]
      }
      
      for each object in chapters array 
      we have multiple sections we want all those sections to be in an array 
      [ { id,name,chapterId,content } , {section 2} , {section 3}].forEach( save all the sections with their respective foreign key i.e chapterId)
      const finalSectionArray = [];
      chapters.forEach((chapter)=>{
        chapter.sections.forEach((section)=>{
          let newSectionObj = {...section};
          newSectionObj[chapterId] = chapter.id;
          //append the above obj in the final array
        })
      })

    */
    const semester = data.semesters[0];
    const contentString = JSON.stringify(semester.content);
    const updateSemesterQuery = `
      UPDATE semesters
      SET semester_content = ?
      WHERE semester_id = ?;
    `;
    connection.query(updateSemesterQuery, [contentString, semester.id], function (err, result) {
      if (err) {
        console.error("Error updating semester:", err);
        connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(connection);
        return response.status(500).json({ error: err.message });
      }
      semester.chapters.forEach(function (chapter) {
        const chapterContentString = JSON.stringify(chapter.content);
        const updateChapterQuery = `
            UPDATE chapters
            SET chapter_content = ?
            WHERE chapter_id = ?;
          `;
        connection.query(updateChapterQuery, [chapterContentString, chapter.id], function (err, result) {
          if (err) {
            console.error("Error updating chapter:", err);
            connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(connection);
            return response.status(500).json({ error: err.message });
          }
        });
      });

      semester.semesterTest.forEach((semesterTest) => {
        const semesterTestContentString = JSON.stringify(semesterTest.content);
        const updateChapterQuery = `
            UPDATE semester_tests
            SET 
            semester_tests_content = ?,
            time_limit_hours = ?,
            time_limit_minutes = ?,
            number_of_questions = ?
            WHERE semester_tests_id = ?;
          `;
        connection.query(updateChapterQuery, [semesterTestContentString, semesterTest.timeLimit.hours, semesterTest.timeLimit.minutes, semesterTest.numberOfQuestionToShow, semesterTest.id], function (err, result) {
          if (err) {
            console.error("Error updating chapter:", err);
            connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(connection);
            return response.status(500).json({ error: err.message });
          }
        });
      })

      semester.chapters.forEach((chapter) => {
        chapter.sections.forEach((section) => {
          const sectionContentString = JSON.stringify(section.content);
          const updateSectionQuery = `
              UPDATE sections
              SET content = ?
              WHERE section_id = ?;
            `;
          connection.query(updateSectionQuery, [sectionContentString, section.id], function (err, result) {
            if (err) {
              console.error("Error updating chapter:", err);
              connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(connection);
              return response.status(500).json({ error: err.message });
            }
          });
        })
      })

      semester.chapters.forEach((chapter) => {
        chapter.chapterTest.forEach((chapterTest) => {
          const chapterTestContentString = JSON.stringify(chapterTest.content);
          const updateChapterTestQuery = `
              UPDATE chapter_tests
              SET chapter_tests_content = ?
              WHERE chapter_tests_id = ?;
            `;
          connection.query(updateChapterTestQuery, [chapterTestContentString, chapterTest.id], function (err, result) {
            if (err) {
              console.error("Error updating chapter:", err);
              connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(connection);
              return response.status(500).json({ error: err.message });
            }
          });
        })
      })
      //both chapters and semesteTests will be saved at this point or not  
      // Update sections for the current chapter sequentially
      response.json({status:'success'});
    });
  } catch (error) {
    console.error("Error:", error);
  }
};

