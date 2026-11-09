const mongoose = require("mongoose");

const candidateSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    candidateName: { type: String, required: true, trim: true },
    partyName: { type: String, required: true, trim: true },
    manifesto: { type: String, required: true, maxlength: 5000 },
    profileImage: { type: String, default: "" },
    electionId: { type: mongoose.Schema.Types.ObjectId, ref: "Election", required: true },
    approvalStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    blockchainCandidateId: { type: Number }, // set once registered on-chain
  },
  { timestamps: true }
);
candidateSchema.index({ userId: 1, electionId: 1 }, { unique: true });

module.exports = mongoose.model("Candidate", candidateSchema);
