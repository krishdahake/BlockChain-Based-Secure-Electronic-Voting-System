import { BrowserProvider, Contract } from "ethers";
import artifact from "../contracts/Voting.json";

export const CONTRACT_ADDRESS = artifact.address;
export const CHAIN_ID = artifact.chainId;
export const ABI = artifact.abi;

export const CHAINS = {
  31337: { name: "Hardhat Local", params: { chainId: "0x7a69", chainName: "Hardhat Local", rpcUrls: ["http://127.0.0.1:8545"], nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 } } },
  11155111: { name: "Sepolia Testnet", params: { chainId: "0xaa36a7", chainName: "Sepolia", rpcUrls: ["https://rpc.sepolia.org"], nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 }, blockExplorerUrls: ["https://sepolia.etherscan.io"] } },
};
export const chainName = (id) => CHAINS[id]?.name || `Chain ${id}`;
export const explorerTxUrl = (hash) => (CHAIN_ID === 11155111 ? `https://sepolia.etherscan.io/tx/${hash}` : null);

export const hasMetaMask = () => typeof window !== "undefined" && !!window.ethereum;
export const getBrowserProvider = () => new BrowserProvider(window.ethereum);
export const shortAddr = (a) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "");

export async function getVotingContract(signerOrProvider) {
  return new Contract(CONTRACT_ADDRESS, ABI, signerOrProvider);
}

/** Pulls a human-readable reason out of an ethers / MetaMask error. */
export function txError(e) {
  if (e?.code === "ACTION_REJECTED" || e?.code === 4001) return "You rejected the request in MetaMask.";
  const reason = e?.revert?.args?.[0] || e?.reason || e?.info?.error?.message || e?.shortMessage || e?.message;
  return reason ? String(reason).slice(0, 220) : "Transaction failed";
}
