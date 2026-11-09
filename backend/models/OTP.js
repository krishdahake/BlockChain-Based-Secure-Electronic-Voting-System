const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  hashedOTP: { type: String, required: true }, // bcrypt hash - never plaintext
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  // resend rate-limiting
  resendCount: { type: Number, default: 0 },
  windowStart: { type: Date, default: Date.now },
  lastSentAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  purgeAt: { type: Date, required: true }, // TTL: kept a while after expiry so rate limits survive
});
otpSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("OTP", otpSchema);
