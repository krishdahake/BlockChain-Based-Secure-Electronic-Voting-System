module.exports = {
  notFound: (req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` }),
  errorHandler: (err, _req, res, _next) => {
    if (err.name === "MulterError") return res.status(400).json({ message: err.message });
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || "value";
      return res.status(409).json({ message: `An account with this ${field} already exists` });
    }
    if (err.name === "CastError") return res.status(400).json({ message: "Invalid identifier" });
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({
      message: status >= 500 && process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  },
};
