// Deploys Voting.sol and writes the address + ABI into backend/ and frontend/.
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const admin = process.env.CONTRACT_ADMIN_ADDRESS || deployer.address;
  console.log("Deployer:", deployer.address, "| contract admin:", admin);

  const voting = await (await hre.ethers.getContractFactory("Voting")).deploy(admin);
  await voting.waitForDeployment();
  const address = await voting.getAddress();
  const net = await hre.ethers.provider.getNetwork();
  console.log("Voting deployed to:", address, "chainId:", net.chainId.toString());

  const artifact = await hre.artifacts.readArtifact("Voting");
  const payload = JSON.stringify(
    { address, chainId: Number(net.chainId), abi: artifact.abi }, null, 2);

  const root = path.join(__dirname, "..", "..");
  for (const dir of ["backend/config", "frontend/src/contracts"]) {
    const d = path.join(root, dir);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, "Voting.json"), payload);
    console.log("Wrote", path.join(dir, "Voting.json"));
  }
  console.log("\nSet in backend/.env:  CONTRACT_ADDRESS=" + address);
}
main().catch((e) => { console.error(e); process.exit(1); });
