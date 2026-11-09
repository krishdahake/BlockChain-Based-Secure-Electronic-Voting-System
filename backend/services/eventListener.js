/**
 * Listens for VoteCast events and reconciles VoteTransaction records
 * (covers cases where the voter's browser closed before reporting the tx hash).
 */
const Election = require("../models/Election");
const User = require("../models/User");
const VoteTransaction = require("../models/VoteTransaction");
const chain = require("./contractService");

async function handleVoteCast({ electionBcId, voter, txHash, blockNumber }) {
  const election = await Election.findOne({ blockchainElectionId: electionBcId });
  if (!election) return;
  const wallet = voter.toLowerCase();
  const user = await User.findOne({ walletAddress: wallet });
  await VoteTransaction.findOneAndUpdate(
    { transactionHash: txHash.toLowerCase() },
    {
      $set: { transactionStatus: "confirmed", blockNumber },
      $setOnInsert: { electionId: election._id, voterId: user?._id, walletAddress: wallet },
    },
    { upsert: true }
  );
}

exports.start = async () => {
  const contract = chain.getContract();

  // catch up on anything missed while the server was down
  try {
    const last = await VoteTransaction.findOne({ blockNumber: { $exists: true } }).sort({ blockNumber: -1 });
    const past = await contract.queryFilter(contract.filters.VoteCast(), last?.blockNumber ?? 0);
    for (const ev of past) {
      await handleVoteCast({ electionBcId: Number(ev.args.electionId), voter: ev.args.voter, txHash: ev.transactionHash, blockNumber: ev.blockNumber });
    }
    if (past.length) console.log(`Event listener: reconciled ${past.length} past VoteCast event(s)`);
  } catch (e) {
    console.error("Event catch-up failed:", e.message);
  }

  contract.on("VoteCast", async (electionId, _candidateId, voter, _ts, payload) => {
    try {
      await handleVoteCast({
        electionBcId: Number(electionId),
        voter,
        txHash: payload.log.transactionHash,
        blockNumber: payload.log.blockNumber,
      });
    } catch (e) {
      console.error("VoteCast handler error:", e.message);
    }
  });
  console.log("Listening for VoteCast events on", chain.getAddress());
};
