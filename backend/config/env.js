require("dotenv").config();

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
  },
  chain: {
    rpcUrl: process.env.RPC_URL || "http://127.0.0.1:8545",
    contractAddress: process.env.CONTRACT_ADDRESS,
    adminPrivateKey: process.env.ADMIN_PRIVATE_KEY, // signs ADMIN actions only (never votes)
  },
  otp: { ttlMs: 5 * 60 * 1000, maxAttempts: 5, maxResends: 5, resendCooldownMs: 60 * 1000, windowMs: 60 * 60 * 1000 },
};

/** Throws if mandatory secrets are missing (called by server.js, not by tests). */
env.assertRequired = () => {
  const missing = [];
  if (!env.mongoUri) missing.push("MONGODB_URI");
  if (!env.jwtSecret || env.jwtSecret.length < 32) missing.push("JWT_SECRET (min 32 chars)");
  if (!env.chain.adminPrivateKey) missing.push("ADMIN_PRIVATE_KEY");
  if (missing.length) {
    throw new Error("Missing/invalid environment variables: " + missing.join(", ") + ". See backend/.env.example");
  }
};

module.exports = env;
