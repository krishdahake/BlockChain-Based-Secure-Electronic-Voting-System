require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const { SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY } = process.env;

// When running `hardhat node` (local dev server), mine a block every 2s even when idle. Without this the
// chain's block.timestamp freezes between transactions, so time-gated reads such as getResults() would
// keep reporting "election not ended" after the end time. (Real networks mine continuously.)
// Not applied to `hardhat test`, which controls time itself.
const isDevNode = process.argv.includes("node");

module.exports = {
  solidity: { version: "0.8.24", settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: {
    hardhat: { chainId: 31337, ...(isDevNode ? { mining: { auto: true, interval: 2000 } } : {}) },
    localhost: { url: "http://127.0.0.1:8545", chainId: 31337 },
    ...(SEPOLIA_RPC_URL && DEPLOYER_PRIVATE_KEY
      ? { sepolia: { url: SEPOLIA_RPC_URL, accounts: [DEPLOYER_PRIVATE_KEY], chainId: 11155111 } }
      : {}),
  },
};
