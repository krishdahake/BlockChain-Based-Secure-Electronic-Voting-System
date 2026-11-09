const Election = require("../models/Election");
const Candidate = require("../models/Candidate");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const chain = require("../services/contractService");
const { eligibleFilter } = require("../services/voterSync");

/** Results come exclusively from the smart contract - nothing is cached or editable in MongoDB. */
exports.get = asyncHandler(async (req, res) => {
  const e = await Election.findById(req.params.electionId);
  if (!e) throw new ApiError(404, "Election not found");
  if (!(await chain.hasEnded(e.blockchainElectionId))) {
    throw new ApiError(403, "Results are available only after the election has ended");
  }
  const onchain = await chain.getResults(e.blockchainElectionId);
  const profiles = await Candidate.find({ electionId: e._id, approvalStatus: "approved" });
  const byChainId = new Map(profiles.map((c) => [c.blockchainCandidateId, c]));

  const candidates = onchain.candidates.map((c) => {
    const p = byChainId.get(c.blockchainCandidateId);
    return {
      blockchainCandidateId: c.blockchainCandidateId,
      candidateName: c.name,
      partyName: p?.partyName || "",
      profileImage: p?.profileImage || "",
      votes: c.votes,
      percentage: onchain.totalVotes ? +((c.votes / onchain.totalVotes) * 100).toFixed(2) : 0,
    };
  });
  const top = Math.max(0, ...candidates.map((c) => c.votes));
  const winners = top > 0 ? candidates.filter((c) => c.votes === top).map((c) => c.candidateName) : [];
  const eligibleVoters = await User.countDocuments(eligibleFilter);

  res.json({
    election: { id: e._id, electionName: e.electionName, startDate: e.startDate, endDate: e.endDate, blockchainElectionId: e.blockchainElectionId },
    totalVotes: onchain.totalVotes,
    eligibleVoters,
    turnoutPercentage: eligibleVoters ? +((onchain.totalVotes / eligibleVoters) * 100).toFixed(2) : 0,
    winners,
    isTie: winners.length > 1,
    candidates,
    source: "smart-contract",
    contractAddress: chain.getAddress(),
  });
});
