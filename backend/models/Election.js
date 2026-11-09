const mongoose = require("mongoose");

const electionSchema = new mongoose.Schema(
  {
    electionName: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, default: "", maxlength: 2000 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    // admin activation switch (mirrors on-chain `active`). Timing is derived -> `phase`.
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    candidates: [{ type: mongoose.Schema.Types.ObjectId, ref: "Candidate" }], // approved candidates
    blockchainElectionId: { type: Number, required: true, unique: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

electionSchema.virtual("phase").get(function () {
  if (!this.startDate || !this.endDate) return undefined; // partial projection (e.g. populate("electionId", "electionName"))
  const now = Date.now();
  if (now < this.startDate.getTime()) return "upcoming";
  if (now >= this.endDate.getTime()) return "ended";
  return "live";
});

module.exports = mongoose.model("Election", electionSchema);
