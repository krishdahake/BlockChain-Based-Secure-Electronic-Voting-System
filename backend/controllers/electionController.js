const Election = require("../models/Election");
const Candidate = require("../models/Candidate");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const chain = require("../services/contractService");
const voterSync = require("../services/voterSync");

async function enrich(e) {
  const obj = e.toJSON();
  obj.approvedCandidates = await Candidate.countDocuments({ electionId: e._id, approvalStatus: "approved" });
  try { obj.totalVotes = await chain.getTotalVotes(e.blockchainElectionId); } catch { obj.totalVotes = null; }
  return obj;
}

exports.create = asyncHandler(async (req, res) => {
  const { electionName, description = "", startDate, endDate } = req.body;
  const start = new Date(startDate), end = new Date(endDate);
  if (end <= start) throw new ApiError(400, "End date must be after start date");
  if (end <= new Date()) throw new ApiError(400, "End date must be in the future");

  const { blockchainElectionId, txHash } = await chain.createElection({ name: electionName, description, startDate: start, endDate: end });
  const election = await Election.create({
    electionName, description, startDate: start, endDate: end, blockchainElectionId, createdBy: req.user._id,
  });
  const sync = await voterSync.registerAllVotersForElection(election);
  res.status(201).json({ election: await enrich(election), txHash, sync });
});

exports.list = asyncHandler(async (req, res) => {
  const filter = req.user.role === "admin" ? {} : { status: "active" };
  const elections = await Election.find(filter).sort({ startDate: -1 });
  res.json({ elections: await Promise.all(elections.map(enrich)) });
});

exports.get = asyncHandler(async (req, res) => {
  const e = await Election.findById(req.params.id);
  if (!e || (req.user.role !== "admin" && e.status !== "active")) throw new ApiError(404, "Election not found");
  const candidates = await Candidate.find({ electionId: e._id, approvalStatus: "approved" }).select("-userId");
  res.json({ election: await enrich(e), candidates });
});

exports.update = asyncHandler(async (req, res) => {
  const e = await Election.findById(req.params.id);
  if (!e) throw new ApiError(404, "Election not found");
  const { electionName, description, startDate, endDate, status } = req.body;

  const detailsChanged = [electionName, description, startDate, endDate].some((v) => v !== undefined);
  if (detailsChanged) {
    if (e.phase !== "upcoming") throw new ApiError(409, "Details of an election that has started cannot be edited");
    const next = {
      name: electionName ?? e.electionName,
      description: description ?? e.description,
      startDate: startDate ? new Date(startDate) : e.startDate,
      endDate: endDate ? new Date(endDate) : e.endDate,
    };
    if (next.endDate <= next.startDate) throw new ApiError(400, "End date must be after start date");
    if (next.endDate <= new Date()) throw new ApiError(400, "End date must be in the future");
    await chain.updateElection(e.blockchainElectionId, next);
    Object.assign(e, { electionName: next.name, description: next.description, startDate: next.startDate, endDate: next.endDate });
  }
  if (status && status !== e.status) {
    await chain.setElectionActive(e.blockchainElectionId, status === "active");
    e.status = status;
  }
  await e.save();
  res.json({ election: await enrich(e) });
});

/** Only elections that have not started can be removed. The on-chain record is deactivated (chains are immutable). */
exports.remove = asyncHandler(async (req, res) => {
  const e = await Election.findById(req.params.id);
  if (!e) throw new ApiError(404, "Election not found");
  if (e.phase !== "upcoming") throw new ApiError(409, "Only elections that have not started can be deleted");
  await chain.setElectionActive(e.blockchainElectionId, false);
  await Candidate.deleteMany({ electionId: e._id });
  await e.deleteOne();
  res.json({ message: "Election deleted (on-chain record deactivated)" });
});
