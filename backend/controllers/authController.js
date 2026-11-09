const bcrypt = require("bcryptjs");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { sign } = require("../utils/jwt");
const otpService = require("../services/otpService");

const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 10);

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, voterId, role } = req.body;
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing?.isEmailVerified) throw new ApiError(409, "An account with this email already exists");

  const hashed = await bcrypt.hash(password, 12);
  const data = { name, email, password: hashed, role, ...(role === "voter" ? { voterId } : {}) };
  if (existing) {
    // an abandoned, never-verified registration: allow it to be redone
    Object.assign(existing, data);
    if (role !== "voter") existing.voterId = undefined;
    await existing.save();
  } else {
    await User.create(data);
  }
  const otp = await otpService.issueOtp(email, name);
  const isDev = process.env.NODE_ENV === "development" && (!process.env.SMTP_USER || !process.env.SMTP_PASS);
  res.status(201).json({
    message: isDev
      ? `Registration successful! Verification code: ${otp}`
      : "Registration successful. A 6-digit verification code was sent to your email.",
    email: email.toLowerCase(),
    ...(isDev ? { devOtp: otp } : {}),
  });
});

exports.sendOtp = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email.toLowerCase() });
  let otp;
  // Same response whether or not the account exists (prevents account enumeration)
  if (user && !user.isEmailVerified) otp = await otpService.issueOtp(user.email, user.name);
  const isDev = process.env.NODE_ENV === "development" && (!process.env.SMTP_USER || !process.env.SMTP_PASS);
  res.json({
    message: isDev && otp
      ? `New verification code generated: ${otp}`
      : "If this email has a pending registration, a new code has been sent.",
    ...(isDev && otp ? { devOtp: otp } : {}),
  });
});

exports.verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw new ApiError(400, "Invalid verification request");
  if (user.isEmailVerified) throw new ApiError(400, "Email is already verified. Please log in.");
  await otpService.verifyOtp(email, otp);
  user.isEmailVerified = true;
  await user.save();
  res.json({ message: "Email verified successfully. You can now log in." });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select("+password +tokenVersion");
  const ok = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);
  if (!user || !ok) throw new ApiError(401, "Invalid email or password");
  if (!user.isEmailVerified) {
    return res.status(403).json({ message: "Please verify your email before logging in.", code: "EMAIL_NOT_VERIFIED", email: user.email });
  }
  res.json({ token: sign(user), user });
});

exports.logout = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } }); // revokes all issued tokens
  res.json({ message: "Logged out" });
});
