const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { verify } = require("../utils/jwt");

/** Verifies the Bearer JWT, loads the user and rejects revoked (logged-out) tokens. */
exports.authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new ApiError(401, "Authentication required");
  let payload;
  try {
    payload = verify(token);
  } catch {
    throw new ApiError(401, "Invalid or expired token");
  }
  const user = await User.findById(payload.sub).select("+tokenVersion");
  if (!user || (user.tokenVersion || 0) !== payload.tv) throw new ApiError(401, "Session is no longer valid");
  if (!user.isEmailVerified) throw new ApiError(403, "Email not verified");
  req.user = user;
  next();
});

/** Role-based access control. Usage: authorize("admin") */
exports.authorize =
  (...roles) =>
  (req, _res, next) =>
    roles.includes(req.user?.role) ? next() : next(new ApiError(403, "You do not have permission to perform this action"));

/** Voters must be admin-approved before they can use voting features. */
exports.requireApproved = (req, _res, next) =>
  req.user.isApproved ? next() : next(new ApiError(403, "Your account has not been approved by an administrator yet"));
