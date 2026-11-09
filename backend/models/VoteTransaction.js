const mongoose = require("mongoose");

/**
 * Reference record for a vote transaction.
 * PRIVACY: the chosen candidate is deliberately NOT stored here. The contract is the
 * only authoritative record of vote choices and counts.
 */
const voteTxSchema = new mongoose.Schema({
  electionId: { type: mongoose.Schema.Types.ObjectId, ref: "Election", required: true },
  voterId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  walletAddress: { type: String, required: true, lowercase: true },
  transactionHash: { type: String, required: true, unique: true, lowercase: true },
  blockNumber: { type: Number },
  transactionStatus: { type: String, enum: ["pending", "confirmed", "failed"], default: "pending" },
  createdAt: { type: Date, default: Date.now },
});
voteTxSchema.index({ electionId: 1, walletAddress: 1 });

module.exports = mongoose.model("VoteTransaction", voteTxSchema);
