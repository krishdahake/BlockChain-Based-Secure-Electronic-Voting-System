const mongoose = require("mongoose");
const env = require("./env");

module.exports = async function connectDB(uri = env.mongoUri) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  console.log("MongoDB connected");
};
