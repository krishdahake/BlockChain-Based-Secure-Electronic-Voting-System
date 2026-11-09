const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const voterSync = require("../services/voterSync");

exports.profile = asyncHandler(async (req, res) => res.json({ user: req.user }));

exports.list = asyncHandler(async (req, res) => {
  const filter = { role: "voter", isEmailVerified: true };
  if (req.query.status) filter.approvalStatus = req.query.status;
  const voters = await User.find(filter).sort({ createdAt: -1 });
  res.json({ voters });
});

async function setStatus(req, res, status) {
  const user = await User.findOne({ _id: req.params.id, role: "voter" });
  if (!user) throw new ApiError(404, "Voter not found");
  if (!user.isEmailVerified) throw new ApiError(400, "Voter has not verified their email");
  user.approvalStatus = status;
  user.isApproved = status === "approved";
  await user.save();
  let sync;
  if (status === "approved") sync = await voterSync.registerVoterEverywhere(user);
  res.json({ message: `Voter ${status}`, user, sync });
}
exports.approve = asyncHandler((req, res) => setStatus(req, res, "approved"));
exports.reject = asyncHandler((req, res) => setStatus(req, res, "rejected"));

/** Admin can unlink a voter's wallet (e.g. lost device). They must re-verify a new one. */
exports.resetWallet = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, role: "voter" });
  if (!user) throw new ApiError(404, "Voter not found");
  user.walletAddress = undefined;
  await user.save();
  res.json({ message: "Wallet unlinked", user });
});
