const nodemailer = require("nodemailer");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");

let transporter;
function getTransporter() {
  if (!transporter) {
    if (!env.smtp.host || !env.smtp.user || !env.smtp.pass) {
      throw new ApiError(500, "Email service is not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS)");
    }
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    });
  }
  return transporter;
}

exports.sendOtpEmail = async (to, otp, name = "") => {
  const minutes = env.otp.ttlMs / 60000;
  // If SMTP is not yet configured in development mode, log the OTP to the console
  if (!env.smtp.host || !env.smtp.user || !env.smtp.pass) {
    if (env.nodeEnv === "development") {
      console.log("\n=======================================================");
      console.log(`[DEV MODE - OTP] For: ${to} | Code: ${otp} | Expires in: ${minutes}m`);
      console.log("=======================================================\n");
      return;
    }
  }
  try {
    await getTransporter().sendMail({
      from: `"Smart Voting System" <${env.smtp.from}>`,
      to,
      subject: "Your Smart Voting verification code",
      text: `Hello ${name},\n\nYour verification code is ${otp}. It expires in ${minutes} minutes.\nIf you did not request this, ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
        <h2 style="color:#0f1b4d">Smart Voting System</h2>
        <p>Hello ${String(name).replace(/[<>&"]/g, "")},</p>
        <p>Your verification code is:</p>
        <p style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#6d28d9">${otp}</p>
        <p style="color:#6b7280">It expires in ${minutes} minutes. If you did not request this, you can ignore this email.</p></div>`,
    });
  } catch (e) {
    if (e instanceof ApiError) throw e;
    console.error("SMTP error:", e.message);
    throw new ApiError(502, "Could not send verification email. Check SMTP settings.");
  }
};

exports.sendContactEmail = async ({ name, email, message }) => {
  const to = process.env.CONTACT_EMAIL || env.smtp.user || "admin@example.com";
  if (!env.smtp.host || !env.smtp.user || !env.smtp.pass) {
    if (env.nodeEnv === "development") {
      console.log("\n=======================================================");
      console.log(`[DEV MODE - CONTACT MSG] From: ${name} <${email}>: ${message}`);
      console.log("=======================================================\n");
      return;
    }
  }
  try {
    await getTransporter().sendMail({
      from: `"Smart Voting System" <${env.smtp.from}>`, to, replyTo: email,
      subject: `Contact form: ${String(name).slice(0, 80)}`,
      text: `From: ${name} <${email}>\n\n${message}`,
    });
  } catch (e) {
    if (e instanceof ApiError) throw e;
    console.error("SMTP error:", e.message);
    throw new ApiError(502, "Could not send your message right now. Please try again later.");
  }
};
