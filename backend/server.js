const env = require("./config/env");
const connectDB = require("./config/db");
const app = require("./app");
const eventListener = require("./services/eventListener");
const chain = require("./services/contractService");

(async () => {
  env.assertRequired();
  await connectDB();
  chain.getContract(); // fail fast if the contract is not configured
  const code = await chain.getProvider().getCode(chain.getAddress());
  if (code === "0x") throw new Error(`No contract at ${chain.getAddress()} on ${env.chain.rpcUrl}. Is the Hardhat node running and the contract deployed?`);
  await eventListener.start();
  app.listen(env.port, () => console.log(`API listening on http://localhost:${env.port}`));
})().catch((e) => {
  console.error("Startup failed:", e.message);
  process.exit(1);
});
