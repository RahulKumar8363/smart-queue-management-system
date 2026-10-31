
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  }
});

// ================= 1. TOKEN BOOKING EMAIL =================
async function sendBookingEmail(email, token) {
  return transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Smart Queue - Token Booking Confirmation",

    // QR Code Attachment
    attachments: [
      {
        filename: "smart-queue-qr.png",
        content: token.qr_code.split(",")[1],
        encoding: "base64",
        cid: "tokenqr"
      }
    ],

    html: `
      <h2>Token Booked Successfully!</h2>

      <p>Hello ${token.user_name},</p>
      <p>Your token has been generated successfully.</p>

      <h3>Token Details</h3>

      <p><b>Token:</b> ${token.token_number}</p>
      <p><b>Department:</b> ${token.department_name}</p>
      <p><b>Status:</b> ${token.status}</p>
      <p><b>Estimated Wait:</b> ${token.estimated_wait_mins} minutes</p>

      <h3>Your QR Code</h3>

      <p>Please keep this QR code for token verification.</p>

      <img
        src="cid:tokenqr"
        alt="Token QR Code"
        width="200"
        height="200"
      >

      <p>Thank you for using Smart Queue Management System.</p>
    `
  });
}

// ================= 2. YOUR TURN EMAIL =================
async function sendTurnEmail(email, token) {
  return transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Smart Queue - It's Your Turn!",

    html: `
      <h2>Your Turn Has Arrived!</h2>

      <p>Hello ${token.user_name},</p>

      <p>
        Your token <b>${token.token_number}</b> has been called.
      </p>

      <p><b>Department:</b> ${token.department_name}</p>

      <p>
        <b>Counter:</b>
        ${token.counter_id || "Please check the counter display"}
      </p>

      <p>Please proceed to your assigned counter.</p>
    `
  });
}

// ================= 3. TOKEN COMPLETED EMAIL =================
async function sendCompletionEmail(email, token) {
  return transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Smart Queue - Service Completed",

    html: `
      <h2>Service Completed!</h2>

      <p>Hello ${token.user_name},</p>

      <p>
        Your service for token
        <b>${token.token_number}</b> has been completed.
      </p>

      <p>Thank you for visiting us!</p>

      <p>Smart Queue Management System</p>
    `
  });
}

// ================= EXPORT FUNCTIONS =================
module.exports = {
  sendBookingEmail,
  sendTurnEmail,
  sendCompletionEmail
};
