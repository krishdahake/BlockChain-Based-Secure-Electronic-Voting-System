const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false }, // bcrypt hash
    voterId: { type: String, trim: true, unique: true, sparse: true },
    role: { type: String, enum: ["admin", "voter", "candidate"], required: true },
    isEmailVerified: { type: Boolean, default: false },
    isApproved: { type: Boolean, default: false },
    approvalStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    walletAddress: { type: String, lowercase: true, unique: true, sparse: true },
    // wallet ownership challenge (one-time)
    walletNonce: { type: String, select: false },
    walletNonceExpires: { type: Date, select: false },
    tokenVersion: { type: Number, default: 0, select: false }, // bump to invalidate JWTs (logout)
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.walletNonce;
    delete ret.walletNonceExpires;
    delete ret.tokenVersion;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("User", userSchema);
