const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const ApiError = require("../utils/ApiError");

const dir = path.join(__dirname, "..", "uploads");
const ALLOWED = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

module.exports = multer({
  storage: multer.diskStorage({
    destination: dir,
    filename: (_req, file, cb) => cb(null, crypto.randomBytes(16).toString("hex") + ALLOWED[file.mimetype]),
  }),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) =>
    ALLOWED[file.mimetype] ? cb(null, true) : cb(new ApiError(400, "Photo must be a JPG, PNG or WebP image")),
});
