const jwt = require("jsonwebtoken");
const env = require("../config/env");

exports.sign = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.role, tv: user.tokenVersion || 0 }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
exports.verify = (token) => jwt.verify(token, env.jwtSecret);
