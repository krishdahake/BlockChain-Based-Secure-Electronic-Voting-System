const Election = require("../models/Election");
const VoteTransaction = require("../models/VoteTransaction");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const chain = require("../services/contractService");

const loadElection = async (id) => {
  const e = await Election.findById(id);
  if (!e) throw new ApiError(404, "Election not found");
  return e;
};

exports.status = asyncHandler(async (req, res) => {
  const e = await loadElection(req.params.electionId);
  const user = req.user;
  const out = {
    electionId: e._id, blockchainElectionId: e.blockchainElectionId, phase: e.phase, electionActive: e.status === "active",
    walletLinked: !!user.walletAddress, walletAddress: user.walletAddress || null,
    registeredOnChain: false, hasVoted: false, canVote: false, transaction: null,
  };
  if (user.walletAddress) {
    let registered = await chain.isRegistered(e.blockchainElectionId, user.walletAddress);
    if (!registered && e.phase !== "ended") {
      // self-heal: approved + verified voter missing from the on-chain allow-list
      try { await chain.registerVoter(e.blockchainElectionId, user.walletAddress); registered = true; }
      catch (err) { console.error("auto-register failed:", err.message); }
    }
    out.registeredOnChain = registered;
    out.hasVoted = await chain.hasVoted(e.blockchainElectionId, user.walletAddress);
    out.canVote = registered && !out.hasVoted && e.phase === "live" && e.status === "active";
    out.transaction = await VoteTransaction.findOne({ electionId: e._id, voterId: user._id }).sort({ createdAt: -1 });
  }
  res.json(out);
});

/**
 * Called by the frontend after MetaMask broadcasts the vote tx. The backend does NOT trust the
 * client: it checks the transaction on-chain (sender, target contract, receipt status, VoteCast
 * event) before marking it confirmed.
 */
exports.record = asyncHandler(async (req, res) => {
  const { electionId, transactionHash } = req.body;
  const hash = transactionHash.toLowerCase();
  const user = req.user;
  if (!user.walletAddress) throw new ApiError(400, "Link and verify your wallet first");
  const election = await loadElection(electionId);

  const owned = await VoteTransaction.findOne({ transactionHash: hash });
  if (owned && owned.voterId && !owned.voterId.equals(user._id)) throw new ApiError(403, "This transaction belongs to another voter");
  if (owned?.transactionStatus === "confirmed") return res.json({ transaction: owned });

  const v = await chain.verifyVoteTransaction(hash);
  if (!v.found) throw new ApiError(404, "Transaction not found on the blockchain");
  if (v.from !== user.walletAddress) throw new ApiError(403, "Transaction was not sent from your verified wallet");
  if (v.to !== v.contract) throw new ApiError(400, "Transaction does not target the voting contract");

  let status = v.status;
  if (status === "confirmed") {
    if (!v.vote || v.vote.electionId !== election.blockchainElectionId || v.vote.voter !== user.walletAddress) {
      throw new ApiError(400, "Transaction is not a valid vote for this election");
    }
  }
  const tx = await VoteTransaction.findOneAndUpdate(
    { transactionHash: hash },
    { $set: { transactionStatus: status, blockNumber: v.blockNumber },
      $setOnInsert: { electionId: election._id, voterId: user._id, walletAddress: user.walletAddress } },
    { upsert: true, returnDocument: "after" }
  );
  res.json({ transaction: tx });
});

/** Admin: all transactions for an election. Voter: only their own. */
exports.transactions = asyncHandler(async (req, res) => {
  const e = await loadElection(req.params.electionId);
  const filter = { electionId: e._id };
  if (req.user.role !== "admin") filter.voterId = req.user._id;
  let q = VoteTransaction.find(filter).sort({ createdAt: -1 });
  if (req.user.role === "admin") q = q.populate("voterId", "name email voterId");
  res.json({ transactions: await q, contractAddress: chain.getAddress() });
});
