// In-memory stand-in for services/contractService used by API tests (real chain is covered by scripts/e2e.js)
let elections, nextId;
const reset = () => { elections = {}; nextId = 1; };
reset();
const f = {
  _reset: reset,
  _elections: () => elections,
  _verify: null, // override result of verifyVoteTransaction
  createElection: async ({ startDate, endDate }) => { const id = nextId++; elections[id] = { candidates: 0, voters: new Set(), voted: new Set(), votes: {}, active: true, startDate, endDate }; return { blockchainElectionId: id, txHash: "0x" + "ab".repeat(32) }; },
  updateElection: async () => ({}),
  setElectionActive: async (id, a) => { elections[id].active = a; },
  addCandidate: async (id) => ({ blockchainCandidateId: ++elections[id].candidates, txHash: "0x" + "cd".repeat(32) }),
  registerVoter: async (id, w) => { elections[id].voters.add(w.toLowerCase()); return {}; },
  isRegistered: async (id, w) => elections[id].voters.has(w.toLowerCase()),
  hasVoted: async (id, w) => elections[id].voted.has(w.toLowerCase()),
  getTotalVotes: async (id) => elections[id].voted.size,
  hasEnded: async (id) => new Date(elections[id].endDate) <= new Date(),
  getResults: async () => ({ candidates: [{ blockchainCandidateId: 1, name: "A", votes: 2 }, { blockchainCandidateId: 2, name: "B", votes: 1 }], totalVotes: 3 }),
  verifyVoteTransaction: async (h) => f._verify,
  getContract: () => ({}),
  getAddress: () => "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  getProvider: () => ({}),
};
module.exports = f;
