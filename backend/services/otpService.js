const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const OTP = require("../models/OTP");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");
const mailer = require("./mailer");

const { ttlMs, maxAttempts, maxResends, resendCooldownMs, windowMs } = env.otp;

/** Generates + stores (hashed) + emails a 6-digit OTP, enforcing resend limits. */
exports.issueOtp = async (email, name) => {
  email = email.toLowerCase();
  const now = Date.now();
  let doc = await OTP.findOne({ email });

  if (doc) {
    if (now - doc.lastSentAt.getTime() < resendCooldownMs) {
      const wait = Math.ceil((resendCooldownMs - (now - doc.lastSentAt.getTime())) / 1000);
      throw new ApiError(429, `Please wait ${wait}s before requesting another code`);
    }
    if (now - doc.windowStart.getTime() > windowMs) {
      doc.resendCount = 0;
      doc.windowStart = new Date(now);
    }
    if (doc.resendCount >= maxResends) throw new ApiError(429, "Too many code requests. Try again in an hour.");
  }

  const otp = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  const hashedOTP = await bcrypt.hash(otp, 10);

  if (!doc) doc = new OTP({ email, windowStart: new Date(now), resendCount: 0 });
  else doc.resendCount += 1;
  Object.assign(doc, {
    hashedOTP,
    expiresAt: new Date(now + ttlMs),
    attempts: 0,
    lastSentAt: new Date(now),
    createdAt: new Date(now),
    purgeAt: new Date(now + ttlMs + windowMs),
  });
  await doc.save();

  try {
    await mailer.sendOtpEmail(email, otp, name);
    return otp;
  } catch (e) {
    await OTP.deleteOne({ email }); // do not leave an unusable OTP / burn rate limit
    throw e;
  }
};

/** Verifies an OTP. Consumes it on success; locks it after too many wrong attempts. */
exports.verifyOtp = async (email, otp) => {
  email = email.toLowerCase();
  const doc = await OTP.findOne({ email });
  if (!doc) throw new ApiError(400, "No active verification code. Please request a new one.");
  if (doc.expiresAt.getTime() < Date.now()) throw new ApiError(400, "Verification code has expired. Request a new one.");
  if (doc.attempts >= maxAttempts) throw new ApiError(429, "Too many incorrect attempts. Request a new code.");

  const ok = await bcrypt.compare(String(otp), doc.hashedOTP);
  if (!ok) {
    doc.attempts += 1;
    await doc.save();
    const left = maxAttempts - doc.attempts;
    throw new ApiError(400, left > 0 ? `Incorrect code. ${left} attempt(s) left.` : "Too many incorrect attempts. Request a new code.");
  }
  await OTP.deleteOne({ email });
};
