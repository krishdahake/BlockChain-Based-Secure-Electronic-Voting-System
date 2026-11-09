const { validationResult } = require("express-validator");
const ApiError = require("../utils/ApiError");

module.exports = (req, _res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  const list = errors.array().map((e) => ({ field: e.path, message: e.msg }));
  next(new ApiError(400, list[0].message, list));
};
