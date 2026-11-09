const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const env = require("./config/env");
const routes = require("./routes");
const { notFound, errorHandler } = require("./middleware/error");

const app = express();
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: env.clientUrl.split(","), credentials: true }));
app.use(express.json({ limit: "100kb" }));
if (env.nodeEnv !== "test") app.use(morgan("dev"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api", routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
