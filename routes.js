const express = require("express");
const router = express.Router();
const userDao = require("./server/Dao/usersDao.js");
const multer = require("multer");
const path = require("path");

// Set up multer storage
// const storage = multer.memoryStorage(); // You can adjust storage as per your requirements

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "./server/uploads/"));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

//multi image upload code testing 
const storage2 = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "./server/uploads/"));
  },
  filename: function (req, file, cb) { 
    console.log('rew sadf' , req.body);
    cb(null, Date.now() + "-"  + path.extname(file.originalname));
  },
});

const testingUpload = multer({ storage: storage2 });

const existingUpload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 5, // 5 MB limit (adjust as needed)
  },
});

/////////////////////////////////////////
//--------- S3 Bucket-----------------
/////////////////////////////////////////

router.post(
  "/upload-profile-image/:userId",
  existingUpload.single("image"),
  async (req, res) => {
    console.log("Received request to /upload-profile-image/:userId");

    try {
      // Extract the userId from the URL parameters
      const userId = req.params.userId;
      console.log("User ID:", userId);

      // Call the uploadProfileImage function in userDao.js
      await userDao.uploadProfileImage(req, res);
    } catch (error) {
      console.error("Error uploading profile image:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

router.put(
  "/update-profile-image/:userId",
  existingUpload.single("image"),
  async (req, res) => {
    console.log("Received request to /update-profile-image/:userId");

    try {
      // Extract the userId from the URL parameters
      const userId = req.params.userId;
      console.log("User ID:", userId);

      // Call the updateProfileImage function in userDao.js
      await userDao.updateProfileImage(req, res);
    } catch (error) {
      console.error("Error updating profile image:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

router.get("/retrieve-profile-image/:userId", async (req, res) => {
  console.log("Received request to /retrieve-profile-image/:userId");

  try {
    // Extract the userId from the URL parameters
    const userId = req.params.userId;
    console.log("User ID:", userId);

    // Call the retrieveProfileImage function in userDao.js
    await userDao.retrieveProfileImage(req, res);
  } catch (error) {
    console.error("Error retrieving profile image:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/delete-profile-image/:userId", async (req, res) => {
  console.log("Received request to /delete-profile-image/:userId");

  try {
    // Extract the userId from the URL parameters
    const userId = req.params.userId;
    console.log("User ID:", userId);

    // Call the deleteProfileImage function in userDao.js
    await userDao.deleteProfileImage(req, res);
  } catch (error) {
    console.error("Error deleting profile image:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/check-email-exists", async (req, res) => {
  try {
    // const { email } = req.body;
    // const exists = await userDao.checkEmailExists(email);

    console.log("CHECK EMAIL ROUTER");
    const email = req.body.email;
    console.log("EMAIL:", email);
    const exists = await userDao.checkEmailExists(email);
    res.json({ exists });
  } catch (error) {
    console.error("Error checking email exists:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/send-otp", async (req, res) => {
  try {
    const { email, contactNumber } = req.body;
    await userDao.sendOTP(email, contactNumber);
    res.json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/verify-otp", async (req, res) => {
  try {
    console.log("Received OTP verification request:", req.body);
    const { email, enteredOTP } = req.body;

    // Call the function to verify OTP
    const result = await userDao.verifyOTP(email, enteredOTP);

    // Check if OTP is valid
    if (result.isValidOTP) {
      // Access the email from the result and use it if needed
      const { email: userEmail } = result;
      res.json({
        isValidOTP: true,
        message: "OTP verification successful",
        userEmail,
      });
    } else {
      res
        .status(401)
        .json({ isValidOTP: false, message: "Invalid OTP or OTP expired" });
    }
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    // Call the function to update the password
    await userDao.resetPassword(email, newPassword);

    res.json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// New route for fetching user data
router.post("/fetch-user-data", async (req, res) => {
  console.log("Received request to /fetch-user-data");
  try {
    await userDao.fetchUserData(req, res);
  } catch (error) {
    console.error("Error fetching user data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// New route for fetching school data
router.get("/fetch-school-data", async (req, res) => {
  console.log("Received request to /fetch-school-data");
  try {
    await userDao.fetchSchoolData(req, res);
  } catch (error) {
    console.error("Error fetching school data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// routes.js (backend)
router.get("/fetch-school-data/:schoolId", async (req, res) => {
  console.log("Received request to /fetch-school-data/:schoolId");
  try {
    await userDao.fetchSchoolDetails(req, res);
  } catch (error) {
    console.error("Error fetching school details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// New route for fetching user counts for a specific school
router.get("/fetch-user-counts/:schoolId", async (req, res) => {
  console.log("Received request to /fetch-user-counts/:schoolId");
  try {
    await userDao.fetchUserCounts(req, res);
  } catch (error) {
    console.error("Error fetching user counts:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// New route for adding a new school
router.post("/add-school", async (req, res) => {
  console.log("Received request to /add-school");
  try {
    await userDao.addSchool(req, res);
  } catch (error) {
    console.error("Error adding school:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Add new routes for fetching teachers and students for a specific school
router.get("/fetch-teachers/:schoolId", async (req, res) => {
  console.log("Received request to /fetch-teachers/:schoolId");
  try {
    await userDao.fetchTeachersForSchool(req, res);
  } catch (error) {
    console.error("Error fetching teachers data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/fetch-students/:schoolId", async (req, res) => {
  console.log("Received request to /fetch-students/:schoolId");
  try {
    await userDao.fetchStudentsForSchool(req, res);
  } catch (error) {
    console.error("Error fetching students data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


router.post("/add-teacher/:schoolId", async (req, res) => {
  console.log("Received request to /add-teacher/:schoolId");
  try {
    // Extract the schoolId from the URL parameters
    const { schoolId } = req.params;

    // Attach the schoolId to the request body
    req.body.schoolId = schoolId;

    // Call the addTeacher function in userDao.js
    await userDao.addTeacher(req, res);
  } catch (error) {
    console.error("Error adding teacher:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Route to add a student to a specific school
router.post("/add-student/:schoolId", async (req, res) => {
  console.log("Received request to /add-student/:schoolId");
  try {
    // Extract the schoolId from the URL parameters
    const { schoolId } = req.params;

    // Attach the schoolId to the request body
    req.body.schoolId = schoolId;

    // Call the addStudent function in userDao.js
    await userDao.addStudent(req, res);
  } catch (error) {
    console.error("Error adding student:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// Add a new route for fetching teacher details
router.get("/fetch-teacher-details/:schoolId/:userId", async (req, res) => {
  console.log("Received request to /fetch-teacher-details/:schoolId/:userId");
  try {
    // Extract the schoolId and userId from the URL parameters
    const { userId, schoolId } = req.params;

    // Attach the schoolId , userId to the request body
    req.body.userId = userId;
    req.body.schoolId = schoolId;

    // Call the fetchTeacherDetails function in userDao.js
    await userDao.fetchTeacherDetails(req, res);
  } catch (error) {
    console.error("Error fetching teacher details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// Add a new route for fetching student details
router.get("/fetch-student-details/:schoolId/:userId", async (req, res) => {
  console.log("Received request to /fetch-student-details/:schoolId/:userId");
  try {
    // Extract the schoolId and userId from the URL parameters
    const { userId, schoolId } = req.params;

    // Attach the schoolId , userId to the request body
    req.body.userId = userId;
    req.body.schoolId = schoolId;

    // Call the fetchStudentDetails function in userDao.js
    await userDao.fetchStudentDetails(req, res);
  } catch (error) {
    console.error("Error fetching student details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// New route for fetching subjects
router.get('/get-subjects', async (req, res) => {
  console.log('Received request to /api/get-subjects');
  try {
    await userDao.fetchSubjects(req, res);
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// New route for fetching classes
router.get('/get-classes', async (req, res) => {
  console.log('Received request to /api/get-classes');
  try {
    await userDao.fetchClasses(req, res);
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


/////////////////////////////////////////
//---------Testing Code-----------------
/////////////////////////////////////////


router.post('/create-course', async (req, res) => {
  console.log('Received request to /api/create-course');
  try {
    await userDao.createCourse(req, res);
  } catch (error) {
    console.error('Error creating course:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/save-course', testingUpload.array('images') , async (req, res) => {
  console.log('Received request to /api/save-course');
  try {
    await userDao.finalSaveCourse(req, res);
  } catch (error) {
    console.error('Error saving course:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


router.get('/fetch-sidebar-data', async (req, res) => {
  console.log('Received request to /api/fetch sidebar data');
  try {
    await userDao.getSidebarData(req, res);
  } catch (error) {
    console.error('Error saving course:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/fetch-course-creator-data', async (req, res) => {
  console.log('Received request to /api/fetch course creator data');
  try {
    await userDao.getCourseCreatorData(req, res);
  } catch (error) {
    console.error('Error saving course:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/add-semester', async (req, res) => {
  console.log('Received request to /api/add-semester');
  try {
    await userDao.addSemester(req, res);
  } catch (error) {
    console.error('Error saving course:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/add-chapter', async (req, res) => {
  console.log('Received request to /api/add-chapter');
  try {
    await userDao.addChapter(req, res);
  } catch (error) {
    console.error('Error saving course:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/add-section', async (req, res) => {
  console.log('Received request to /api/add-section');
  try {
    await userDao.addSection(req, res);
  } catch (error) {
    console.error('Error saving course:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/add-chapter-test', async (req, res) => {
  console.log('Received request to /api/add-chapter-test');
  try {
    await userDao.addChapterTest(req, res);
  } catch (error) {
    console.error('Error saving course:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/add-semester-test', async (req, res) => {
  console.log('Received request to /api/add-semester-test');
  try {
    await userDao.addSemesterTest(req, res);
  } catch (error) {
    console.error('Error saving course:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


router.get('/get-parent-data', async (req, res) => {
  console.log('Received request to /api/fetch parent data');
  try {
    await userDao.getParentData(req, res);
  } catch (error) {
    console.error('Error saving course:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/fetch-course-info', async (req, res) => {
  console.log('Received request to /api/fetch course info');
  try {
    await userDao.getCourseInfo(req, res);
  } catch (error) {
    console.error('Error saving course:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/edit-semester-name', async (req, res) => {
  console.log('Received request to /api/edit semester name ');
  try {
    await userDao.editSemesterName(req, res);
  } catch (error) {
    console.error('Error saving course:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/edit-chapter-name', async (req, res) => {
  console.log('Received request to /api/edit chapter name ');
  try {
    await userDao.editChapterName(req, res);
  } catch (error) {
    console.error('Error saving course:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


router.put('/edit-section-name', async (req, res) => {
  console.log('Received request to /api/edit section name ');
  try {
    await userDao.editSectionName(req, res);
  } catch (error) {
    console.error('Error saving course:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/edit-chapterTest-name', async (req, res) => {
  console.log('Received request to /api/edit chapterTest name ');
  try {
    await userDao.editChapterTestName(req, res);
  } catch (error) {
    console.error('Error saving course:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/edit-semesterTest-name', async (req, res) => {
  console.log('Received request to /api/edit semesterTest name ');
  try {
    await userDao.editSemesterTestName(req, res);
  } catch (error) {
    console.error('Error saving course:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


router.delete('/delete-semesterTest', async (req, res) => {
  console.log('Received request to /api/delete semesterTest');
  try {
    await userDao.deleteSemesterTest(req, res);
  } catch (error) {
    console.error('Error saving course:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/delete-chapterTest', async (req, res) => {
  console.log('Received request to /api/delete chapterTest');
  try {
    await userDao.deleteChapterTest(req, res);
  } catch (error) {
    console.error('Error saving course:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/delete-section', async (req, res) => {
  console.log('Received request to /api/delete chapterTest');
  try {
    await userDao.deleteSection(req, res);
  } catch (error) {
    console.error('Error saving course:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/delete-semester',userDao.deleteSemesterImages ,async (req, res) => {
  console.log('Received request to /api/delete semester');
  try {
    await userDao.deleteSemester(req, res);
  } catch (error) {
    console.error('Error saving course:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/delete-chapter', userDao.deleteChapterImages ,async (req, res) => {
  console.log('Received request to /api/delete chapter');
  try {
    await userDao.deleteChapter(req, res);
  } catch (error) {
    console.error('Error saving course:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/delete-course', userDao.deleteCourseImages,async (req, res) => {
  console.log('Received request to /api/delete course');
  try {
    await userDao.deleteCourse(req, res);
  } catch (error) {
    console.error('Error saving course:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
 
router.get('/get-image' , async (req, res) => {
  console.log('Received request to /api/delete course');
  try {
    await userDao.retrieveImage(req, res);
  } catch (error) {
    console.error('Error saving course:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})

router.delete('/delete-image', async (req, res) => {
  console.log('Received request to /api/delete image');
  try {
    await userDao.deleteImage(req, res);
  } catch (error) {
    console.error('Error saving course:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
 
router.post('/delete-image-bulk', async (req, res) => {
  console.log('Received request to /api/delete image bulk');
  try {
    await userDao.bulkImageDelete(req, res);
  } catch (error) {
    console.error('Error saving course:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
// Export the router
module.exports = router;