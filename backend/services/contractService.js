/**
 * Contract interaction service (ethers v6).
 *
 * The backend signer holds ADMIN_ROLE and is used ONLY for administrative setup:
 * createElection / updateElection / setElectionActive / addCandidate / registerVoter.
 * Votes are cast by voters from MetaMask; the backend can never cast or alter votes.
 */
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");

const ARTIFACT_PATH = path.join(__dirname, "..", "config", "Voting.json");

let state; // { provider, signer, read, write, address, iface }

function init() {
  if (state) return state;
  if (!fs.existsSync(ARTIFACT_PATH)) {
    throw new ApiError(500, "config/Voting.json missing. Deploy the contract first (npm run deploy:local in /blockchain).");
  }
  const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, "utf8"));
  const address = env.chain.contractAddress || artifact.address;
  if (!address) throw new ApiError(500, "CONTRACT_ADDRESS is not configured");
  if (!env.chain.adminPrivateKey) throw new ApiError(500, "ADMIN_PRIVATE_KEY is not configured");

  const provider = // cacheTimeout:-1 disables ethers' ~250ms response cache; otherwise two admin txs sent in quick
  // succession can read a stale eth_getTransactionCount and collide ("nonce has already been used").
  new ethers.JsonRpcProvider(env.chain.rpcUrl, undefined, { cacheTimeout: -1 });
  const signer = new ethers.Wallet(env.chain.adminPrivateKey, provider);
  state = {
    provider,
    signer,
    address,
    iface: new ethers.Interface(artifact.abi),
    read: new ethers.Contract(address, artifact.abi, provider),
    write: new ethers.Contract(address, artifact.abi, signer),
  };
  return state;
}

// Serialise admin transactions so nonces never collide.
let queue = Promise.resolve();
const enqueue = (fn) => {
  const run = queue.then(fn);
  queue = run.catch(() => {});
  return run;
};

const reason = (e) => e?.revert?.args?.[0] || e?.reason || e?.shortMessage || e?.message || "Blockchain error";
const wrap = (e) => (e instanceof ApiError ? e : new ApiError(502, `Blockchain error: ${reason(e)}`));

async function sendAdminTx(method, args, eventName) {
  return enqueue(async () => {
    try {
      const { write, iface } = init();
      const tx = await write[method](...args);
      const receipt = await tx.wait();
      let parsed;
      if (eventName) {
        for (const log of receipt.logs) {
          try {
            const p = iface.parseLog(log);
            if (p?.name === eventName) { parsed = p; break; }
          } catch { /* not ours */ }
        }
      }
      return { txHash: receipt.hash, blockNumber: receipt.blockNumber, event: parsed };
    } catch (e) {
      throw wrap(e);
    }
  });
}

const toSec = (d) => Math.floor(new Date(d).getTime() / 1000);

exports.createElection = async ({ name, description, startDate, endDate }) => {
  const r = await sendAdminTx("createElection", [name, description || "", toSec(startDate), toSec(endDate)], "ElectionCreated");
  if (!r.event) throw new ApiError(502, "ElectionCreated event not found in receipt");
  return { blockchainElectionId: Number(r.event.args.electionId), txHash: r.txHash };
};

exports.updateElection = (id, { name, description, startDate, endDate }) =>
  sendAdminTx("updateElection", [id, name, description || "", toSec(startDate), toSec(endDate)]);

exports.setElectionActive = (id, active) => sendAdminTx("setElectionActive", [id, active]);

exports.addCandidate = async (electionId, name) => {
  const r = await sendAdminTx("addCandidate", [electionId, name], "CandidateAdded");
  if (!r.event) throw new ApiError(502, "CandidateAdded event not found in receipt");
  return { blockchainCandidateId: Number(r.event.args.candidateId), txHash: r.txHash };
};

/** Idempotent: skips the transaction if the wallet is already registered. */
exports.registerVoter = async (electionId, wallet) => {
  try {
    if (await init().read.isRegisteredVoter(electionId, wallet)) return { skipped: true };
  } catch (e) {
    throw wrap(e);
  }
  return sendAdminTx("registerVoter", [electionId, wallet]);
};

// ---------------------------- reads ----------------------------

exports.isRegistered = async (electionId, wallet) => {
  try { return await init().read.isRegisteredVoter(electionId, wallet); } catch (e) { throw wrap(e); }
};
exports.hasVoted = async (electionId, wallet) => {
  try { return await init().read.hasVoted(electionId, wallet); } catch (e) { throw wrap(e); }
};
exports.getTotalVotes = async (electionId) => {
  try { return Number(await init().read.getTotalVotes(electionId)); } catch (e) { throw wrap(e); }
};
exports.hasEnded = async (electionId) => {
  try { return await init().read.hasElectionEnded(electionId); } catch (e) { throw wrap(e); }
};

/** Authoritative results straight from the contract (reverts before the election ends). */
exports.getResults = async (electionId) => {
  try {
    const r = await init().read.getResults(electionId);
    return {
      candidates: r.ids.map((id, i) => ({ blockchainCandidateId: Number(id), name: r.names[i], votes: Number(r.votes[i]) })),
      totalVotes: Number(r.totalVotes),
    };
  } catch (e) {
    throw wrap(e);
  }
};

/**
 * Verifies a vote transaction on-chain. Returns:
 *  { found:false } | { found:true, status:'pending'|'confirmed'|'failed', blockNumber, from, to, vote? }
 */
exports.verifyVoteTransaction = async (txHash) => {
  try {
    const { provider, iface, address } = init();
    const tx = await provider.getTransaction(txHash);
    if (!tx) return { found: false };
    const base = { found: true, from: tx.from.toLowerCase(), to: (tx.to || "").toLowerCase(), contract: address.toLowerCase() };
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) return { ...base, status: "pending" };
    if (receipt.status !== 1) return { ...base, status: "failed", blockNumber: receipt.blockNumber };
    let vote;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== address.toLowerCase()) continue;
      try {
        const p = iface.parseLog(log);
        if (p?.name === "VoteCast") vote = { electionId: Number(p.args.electionId), voter: p.args.voter.toLowerCase() };
      } catch { /* ignore */ }
    }
    return { ...base, status: "confirmed", blockNumber: receipt.blockNumber, vote };
  } catch (e) {
    throw wrap(e);
  }
};

exports.getContract = () => init().read;
exports.getAddress = () => init().address;
exports.getProvider = () => init().provider;
exports._reset = () => { state = undefined; };
