const nodeoutlook = require("nodejs-nodemailer-outlook");

function sendEmail(recipient, subject, content) {
  const recipients = Array.isArray(recipient) ? recipient : [recipient];

  nodeoutlook.sendEmail({
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    auth: {
      user: "notifications@diacto.com",
      pass: "2z66f$7e+Y4DFtr",
    },
    from: "notifications@diacto.com",
    to: recipients,
    subject: subject,
    html: content,
    onError: (e) => console.log("Error:", e),
    onSuccess: (i) => console.log("Email sent successfully:", i),
  });
}

module.exports = sendEmail;
