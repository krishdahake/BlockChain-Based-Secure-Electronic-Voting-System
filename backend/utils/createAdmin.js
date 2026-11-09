// Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_NAME=... npm run create-admin
const bcrypt = require("bcryptjs");
const connectDB = require("../config/db");
const env = require("../config/env");
const User = require("../models/User");

(async () => {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME = "System Administrator" } = process.env;
  if (!env.mongoUri || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error("Set MONGODB_URI, ADMIN_EMAIL and ADMIN_PASSWORD (min 8 chars) in the environment.");
    process.exit(1);
  }
  if (ADMIN_PASSWORD.length < 8) { console.error("ADMIN_PASSWORD must be at least 8 characters"); process.exit(1); }
  await connectDB();
  const email = ADMIN_EMAIL.toLowerCase();
  const password = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const existing = await User.findOne({ email });
  if (existing) {
    Object.assign(existing, { password, role: "admin", isEmailVerified: true, isApproved: true, approvalStatus: "approved" });
    await existing.save();
    console.log("Updated existing user to admin:", email);
  } else {
    await User.create({ name: ADMIN_NAME, email, password, role: "admin", isEmailVerified: true, isApproved: true, approvalStatus: "approved" });
    console.log("Admin created:", email);
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
