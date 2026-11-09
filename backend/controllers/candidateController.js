const Candidate = require("../models/Candidate");
const Election = require("../models/Election");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const chain = require("../services/contractService");

const imagePath = (file) => (file ? `/uploads/${file.filename}` : undefined);

exports.apply = asyncHandler(async (req, res) => {
  const { electionId, partyName, manifesto } = req.body;
  const election = await Election.findById(electionId);
  if (!election || election.status !== "active") throw new ApiError(404, "Election not found");
  if (election.phase !== "upcoming") throw new ApiError(409, "Applications are closed - the election has already started");
  if (await Candidate.exists({ userId: req.user._id, electionId })) {
    throw new ApiError(409, "You have already applied for this election");
  }
  const candidate = await Candidate.create({
    userId: req.user._id, candidateName: req.user.name, partyName, manifesto, electionId,
    profileImage: imagePath(req.file) || "",
  });
  res.status(201).json({ message: "Application submitted. Awaiting admin approval.", candidate });
});

exports.list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.electionId) filter.electionId = req.query.electionId;
  if (req.user.role === "admin") {
    if (req.query.status) filter.approvalStatus = req.query.status;
  } else if (req.user.role === "candidate" && req.query.mine === "true") {
    filter.userId = req.user._id;
  } else {
    filter.approvalStatus = "approved";
  }
  let q = Candidate.find(filter).sort({ createdAt: -1 }).populate("electionId", "electionName startDate endDate status");
  if (req.user.role === "admin") q = q.populate("userId", "email name");
  else if (!(req.user.role === "candidate" && req.query.mine === "true")) q = q.select("-userId");
  res.json({ candidates: await q });
});

/** Candidate edits their own application while it is still pending. */
exports.update = asyncHandler(async (req, res) => {
  const c = await Candidate.findOne({ _id: req.params.id, userId: req.user._id });
  if (!c) throw new ApiError(404, "Application not found");
  if (c.approvalStatus === "approved") throw new ApiError(409, "Approved profiles are locked (already registered on-chain)");
  const election = await Election.findById(c.electionId);
  if (election && election.phase !== "upcoming") throw new ApiError(409, "The election has already started");
  if (req.body.partyName) c.partyName = req.body.partyName;
  if (req.body.manifesto) c.manifesto = req.body.manifesto;
  if (req.file) c.profileImage = imagePath(req.file);
  if (c.approvalStatus === "rejected") c.approvalStatus = "pending"; // resubmission
  await c.save();
  res.json({ message: "Application updated", candidate: c });
});

exports.approve = asyncHandler(async (req, res) => {
  const c = await Candidate.findById(req.params.id);
  if (!c) throw new ApiError(404, "Application not found");
  if (c.approvalStatus === "approved") throw new ApiError(409, "Already approved");
  const election = await Election.findById(c.electionId);
  if (!election) throw new ApiError(404, "Election not found");
  if (election.phase !== "upcoming") throw new ApiError(409, "Candidates can only be approved before the election starts");

  const { blockchainCandidateId } = await chain.addCandidate(election.blockchainElectionId, c.candidateName);
  c.blockchainCandidateId = blockchainCandidateId;
  c.approvalStatus = "approved";
  await c.save();
  await Election.updateOne({ _id: election._id }, { $addToSet: { candidates: c._id } });
  res.json({ message: "Candidate approved and registered on-chain", candidate: c });
});

exports.reject = asyncHandler(async (req, res) => {
  const c = await Candidate.findById(req.params.id);
  if (!c) throw new ApiError(404, "Application not found");
  if (c.approvalStatus === "approved") throw new ApiError(409, "Approved candidates are already on-chain and cannot be rejected");
  c.approvalStatus = "rejected";
  await c.save();
  res.json({ message: "Candidate rejected", candidate: c });
});
