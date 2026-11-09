/** Keeps the on-chain voter allow-list in sync with admin-approved, wallet-verified voters. */
const User = require("../models/User");
const Election = require("../models/Election");
const chain = require("./contractService");

const eligibleFilter = { role: "voter", isApproved: true, walletAddress: { $exists: true, $ne: null } };

/** Register one voter's wallet in every election that has not ended. */
exports.registerVoterEverywhere = async (user) => {
  if (!user || user.role !== "voter" || !user.isApproved || !user.walletAddress) return { registered: 0, failed: 0 };
  const elections = await Election.find({ endDate: { $gt: new Date() } });
  let registered = 0, failed = 0;
  for (const e of elections) {
    try {
      await chain.registerVoter(e.blockchainElectionId, user.walletAddress);
      registered++;
    } catch (err) {
      failed++;
      console.error(`voterSync: ${user.email} -> election ${e.blockchainElectionId}: ${err.message}`);
    }
  }
  return { registered, failed };
};

/** Register every eligible voter wallet for one election. */
exports.registerAllVotersForElection = async (election) => {
  const users = await User.find(eligibleFilter);
  let registered = 0, failed = 0;
  for (const u of users) {
    try {
      await chain.registerVoter(election.blockchainElectionId, u.walletAddress);
      registered++;
    } catch (err) {
      failed++;
      console.error(`voterSync: ${u.email} -> election ${election.blockchainElectionId}: ${err.message}`);
    }
  }
  return { registered, failed };
};

exports.eligibleFilter = eligibleFilter;
