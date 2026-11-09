const crypto = require("crypto");
const { ethers } = require("ethers");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const voterSync = require("../services/voterSync");

const NONCE_TTL_MS = 5 * 60 * 1000;
const buildMessage = (address, nonce) =>
  `Link this wallet to my Smart Voting System account.\n\nWallet: ${address}\nNonce: ${nonce}\n\nThis signature costs no gas and does not authorise any transaction.`;

exports.nonce = asyncHandler(async (req, res) => {
  const address = ethers.getAddress(req.body.walletAddress).toLowerCase();
  const user = await User.findById(req.user._id);
  if (user.walletAddress && user.walletAddress !== address) {
    throw new ApiError(409, "A different wallet is already linked to your account. Ask an administrator to reset it.");
  }
  if (user.walletAddress === address) throw new ApiError(409, "This wallet is already verified for your account");
  if (await User.exists({ walletAddress: address, _id: { $ne: user._id } })) {
    throw new ApiError(409, "This wallet is already linked to another voter");
  }
  const nonce = crypto.randomBytes(16).toString("hex");
  user.walletNonce = nonce;
  user.walletNonceExpires = new Date(Date.now() + NONCE_TTL_MS);
  await user.save();
  res.json({ nonce, message: buildMessage(address, nonce), expiresInSeconds: NONCE_TTL_MS / 1000 });
});

exports.verify = asyncHandler(async (req, res) => {
  const address = ethers.getAddress(req.body.walletAddress).toLowerCase();
  const user = await User.findById(req.user._id).select("+walletNonce +walletNonceExpires");
  if (!user.walletNonce || !user.walletNonceExpires || user.walletNonceExpires < new Date()) {
    throw new ApiError(400, "Challenge expired or missing. Request a new one.");
  }
  let recovered;
  try {
    recovered = ethers.verifyMessage(buildMessage(address, user.walletNonce), req.body.signature).toLowerCase();
  } catch {
    throw new ApiError(400, "Malformed signature");
  }
  if (recovered !== address) throw new ApiError(401, "Signature does not match the wallet address");

  user.walletAddress = address;
  user.walletNonce = undefined; // single use
  user.walletNonceExpires = undefined;
  await user.save(); // unique index guards against races
  const sync = await voterSync.registerVoterEverywhere(user);
  res.json({ message: "Wallet verified and linked", user, sync });
});
