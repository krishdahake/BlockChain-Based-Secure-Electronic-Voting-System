const connectDB = require("../config/db");
const chain = require("../services/contractService");
const Election = require("../models/Election");
const Candidate = require("../models/Candidate");
const User = require("../models/User");

(async () => {
  await connectDB();
  const admin = await User.findOne({ role: "admin" });
  const ansh = await User.findOne({ email: "ansh@gmail.com" });
  const krish = await User.findOne({ email: "krish.dahake.btech2023@sitnagpur.siu.edu.in" });

  // Start 3 minutes from now
  const start = new Date(Date.now() + 3 * 60 * 1000);
  const end = new Date(Date.now() + 24 * 60 * 60 * 1000);

  console.log("Creating election on-chain...");
  const { blockchainElectionId, txHash } = await chain.createElection({
    name: "Student Council Election 2026",
    description: "Official election for Student Council 2026",
    startDate: start,
    endDate: end,
  });
  console.log("Election created on chain:", blockchainElectionId, "tx:", txHash);

  const election = await Election.create({
    electionName: "Student Council Election 2026",
    description: "Official election for Student Council 2026",
    startDate: start,
    endDate: end,
    status: "active",
    blockchainElectionId,
    createdBy: admin._id,
  });

  console.log("Adding candidate ansh on-chain...");
  const { blockchainCandidateId, txHash: candTx } = await chain.addCandidate(
    blockchainElectionId,
    ansh.name
  );
  console.log("Candidate added on chain:", blockchainCandidateId, "tx:", candTx);

  const candDoc = await Candidate.create({
    userId: ansh._id,
    candidateName: ansh.name,
    electionId: election._id,
    partyName: "Student Voice & Progress",
    manifesto: "Committed to representing all students, enhancing campus facilities, and organizing academic and cultural fests.",
    approvalStatus: "approved",
    blockchainCandidateId,
  });

  await Election.updateOne({ _id: election._id }, { $addToSet: { candidates: candDoc._id } });

  if (krish?.walletAddress) {
    console.log("Registering Krish on-chain allow-list:", krish.walletAddress);
    await chain.registerVoter(blockchainElectionId, krish.walletAddress);
    console.log("Krish registered successfully on-chain!");
  }

  console.log("SUCCESS: Election and candidate are fully prepared on-chain and in DB!");
  process.exit(0);
})().catch((err) => {
  console.error("Setup error:", err);
  process.exit(1);
});
