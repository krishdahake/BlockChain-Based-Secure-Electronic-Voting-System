const User = require("../models/User");
const Candidate = require("../models/Candidate");
const Election = require("../models/Election");
const VoteTransaction = require("../models/VoteTransaction");
const asyncHandler = require("../utils/asyncHandler");
const chain = require("../services/contractService");

exports.stats = asyncHandler(async (_req, res) => {
  const [voters, pendingVoters, approvedVoters, walletLinked, candidatesPending, candidatesApproved, txCount, elections] = await Promise.all([
    User.countDocuments({ role: "voter", isEmailVerified: true }),
    User.countDocuments({ role: "voter", isEmailVerified: true, approvalStatus: "pending" }),
    User.countDocuments({ role: "voter", approvalStatus: "approved" }),
    User.countDocuments({ role: "voter", walletAddress: { $exists: true, $ne: null } }),
    Candidate.countDocuments({ approvalStatus: "pending" }),
    Candidate.countDocuments({ approvalStatus: "approved" }),
    VoteTransaction.countDocuments({ transactionStatus: "confirmed" }),
    Election.find().sort({ startDate: -1 }),
  ]);
  const participation = await Promise.all(
    elections.map(async (e) => {
      let totalVotes = null;
      try { totalVotes = await chain.getTotalVotes(e.blockchainElectionId); } catch { /* chain offline */ }
      return { id: e._id, electionName: e.electionName, phase: e.phase, status: e.status, totalVotes,
        approvedCandidates: await Candidate.countDocuments({ electionId: e._id, approvalStatus: "approved" }) };
    })
  );
  res.json({
    voters: { total: voters, pending: pendingVoters, approved: approvedVoters, walletLinked },
    candidates: { pending: candidatesPending, approved: candidatesApproved },
    elections: {
      total: elections.length,
      live: elections.filter((e) => e.phase === "live" && e.status === "active").length,
      upcoming: elections.filter((e) => e.phase === "upcoming").length,
      ended: elections.filter((e) => e.phase === "ended").length,
    },
    confirmedVoteTransactions: txCount,
    participation,
    contractAddress: chain.getAddress(),
  });
});

/** All recorded vote transactions across elections (admin blockchain-transactions page). */
exports.transactions = asyncHandler(async (_req, res) => {
  const transactions = await VoteTransaction.find().sort({ createdAt: -1 }).limit(500)
    .populate("voterId", "name email voterId").populate("electionId", "electionName");
  res.json({ transactions, contractAddress: chain.getAddress() });
});
