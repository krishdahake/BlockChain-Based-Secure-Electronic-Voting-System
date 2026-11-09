/**
 * End-to-end test: real Hardhat chain + real MongoDB + real SMTP (local sink) + real backend + built frontend,
 * driven through the browser UI with Playwright.
 *
 * MetaMask cannot be automated headlessly, so the browser gets an injected EIP-1193 `window.ethereum`
 * that forwards requests to the Hardhat node (whose default accounts are unlocked). The application code
 * path (BrowserProvider -> signer -> personal_sign / eth_sendTransaction) is exactly what MetaMask would drive.
 *
 * Usage: node scripts/e2e.js
 */
const { spawn, execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const { createRequire } = require("module");

const root = path.resolve(__dirname, "..");
const be = path.join(root, "backend"), bc = path.join(root, "blockchain"), fe = path.join(root, "frontend");
const beReq = createRequire(path.join(be, "package.json"));
const { MongoMemoryServer } = beReq("mongodb-memory-server");
const { SMTPServer } = beReq("smtp-server");
const { simpleParser } = beReq("mailparser");
const { ethers } = beReq("ethers");
const { chromium } = require("playwright");

const RPC = "http://127.0.0.1:8545", API = "http://localhost:5000", FE = "http://localhost:4173";
// Hardhat's well-known dev account #0 (public, worthless key) - holds ADMIN_ROLE on the local chain.
const HARDHAT_KEY0 = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const PW = "Sup3rSecret!";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const shots = process.env.SHOT_DIR || "/tmp";

const procs = [];
const allPages = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

function startProc(name, cmd, args, opts, ready) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { ...opts, stdio: ["ignore", "pipe", "pipe"] });
    procs.push(p); p.procName = name;
    let buf = "";
    const onData = (d) => { buf += d.toString(); p.tail = buf.slice(-3000); if (ready.test(buf)) resolve(p); };
    p.stdout.on("data", onData); p.stderr.on("data", onData);
    p.on("exit", (c) => { if (!ready.test(buf)) reject(new Error(`${name} exited (${c}): ${buf.slice(-500)}`)); });
    setTimeout(() => reject(new Error(`${name} not ready in 90s: ${buf.slice(-500)}`)), 90000);
  });
}
async function cleanup() { for (const p of procs) { try { p.kill("SIGTERM"); } catch {} } }

let passed = 0; const failures = [];
async function step(name, fn) {
  const t = Date.now();
  try { await fn(); passed++; log(`PASS  ${name} (${Date.now() - t}ms)`); }
  catch (e) { failures.push([name, e]); log(`FAIL  ${name}: ${e.message}`); throw e; }
}
const assert = (c, m) => { if (!c) throw new Error("Assertion failed: " + m); };
const expectRevert = async (p, text) => {
  try { await p; } catch (e) {
    const msg = (e.reason || "") + " " + (e.shortMessage || "") + " " + (e.message || "");
    assert(msg.includes(text), `expected revert "${text}" but got: ${msg.slice(0, 200)}`); return;
  }
  throw new Error(`expected revert "${text}" but call succeeded`);
};

// ---- SMTP sink: the backend sends real Nodemailer mail here ----
const inbox = {};
const smtp = new SMTPServer({
  authOptional: true, disabledCommands: ["STARTTLS"], allowInsecureAuth: true,
  onAuth: (_a, _s, cb) => cb(null, { user: "x" }),
  onData(stream, _s, cb) {
    simpleParser(stream).then((m) => {
      const to = m.to.value[0].address.toLowerCase();
      const code = (m.text.match(/\b(\d{6})\b/) || [])[1];
      (inbox[to] ||= []).push({ code, at: Date.now() }); cb();
    }).catch(cb);
  },
});
async function getOtp(email, after = 0) {
  for (let i = 0; i < 60; i++) {
    const m = (inbox[email.toLowerCase()] || []).filter((x) => x.at >= after).at(-1);
    if (m) return m.code;
    await sleep(250);
  }
  throw new Error("OTP email not received for " + email);
}

// ---- injected wallet ----
const walletScript = (account) => `
(() => {
  const ACCOUNT = ${JSON.stringify(account)};
  const rpc = async (method, params) => {
    const r = await fetch(${JSON.stringify(RPC)}, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params: params || [] }) });
    const j = await r.json();
    if (j.error) { const e = new Error(j.error.message); e.code = j.error.code; throw e; }
    return j.result;
  };
  window.__walletCalls = [];
  window.ethereum = {
    isMetaMask: true,
    on() {}, removeListener() {},
    async request({ method, params }) {
      window.__walletCalls.push(method);
      // Like MetaMask: no accounts are exposed until the user approves the site; the approval persists.
      if (method === "eth_requestAccounts") { sessionStorage.setItem("__mm_connected", "1"); return [ACCOUNT]; }
      if (method === "eth_accounts") return sessionStorage.getItem("__mm_connected") === "1" ? [ACCOUNT] : [];
      if (method === "wallet_revokePermissions") { sessionStorage.removeItem("__mm_connected"); return null; }
      if (method === "wallet_switchEthereumChain") return null;
      return rpc(method, params);
    },
  };
})();`;

(async () => {
  const t0 = Date.now();
  let browser, mongod;
  try {
    // ================= infrastructure =================
    log("Starting Hardhat node...");
    await startProc("hardhat", "npx", ["hardhat", "node"], { cwd: bc }, /Started HTTP and WebSocket JSON-RPC server/);
    execFileSync("npx", ["hardhat", "run", "scripts/deploy.js", "--network", "localhost"], { cwd: bc, stdio: "pipe" });
    const artifact = JSON.parse(fs.readFileSync(path.join(be, "config", "Voting.json"), "utf8"));
    log("Contract deployed at", artifact.address);

    mongod = await MongoMemoryServer.create();
    await new Promise((r) => smtp.listen(2525, "127.0.0.1", r));
    const env = {
      ...process.env, NODE_ENV: "development", PORT: "5000", MONGODB_URI: mongod.getUri("smart-voting-e2e"),
      JWT_SECRET: "e2e-secret-e2e-secret-e2e-secret-e2e-secret", CLIENT_URL: FE,
      SMTP_HOST: "127.0.0.1", SMTP_PORT: "2525", SMTP_USER: "noreply@e2e.test", SMTP_PASS: "unused", EMAIL_FROM: "noreply@e2e.test",
      RPC_URL: RPC, ADMIN_PRIVATE_KEY: HARDHAT_KEY0, CONTRACT_ADDRESS: artifact.address,
      ADMIN_EMAIL: "admin@e2e.test", ADMIN_PASSWORD: PW, ADMIN_NAME: "E2E Admin",
    };
    execFileSync("node", ["utils/createAdmin.js"], { cwd: be, env, stdio: "pipe" });
    await startProc("backend", "node", ["server.js"], { cwd: be, env }, /API listening/);
    execFileSync("npx", ["vite", "build"], { cwd: fe, stdio: "pipe" });
    await startProc("frontend", "npx", ["vite", "preview", "--port", "4173", "--strictPort", "--host", "localhost"], { cwd: fe }, /Local:/);
    log("Infrastructure up");

    const provider = new ethers.JsonRpcProvider(RPC);
    const accounts = (await provider.listAccounts()).map((a) => a.address.toLowerCase());
    const [, V1, V2, V3, , , , , OUTSIDER] = accounts;
    const voting = new ethers.Contract(artifact.address, artifact.abi, provider);
    const asSigner = async (addr) => voting.connect(await provider.getSigner(addr));

    browser = await chromium.launch();
    const newPage = async (account) => {
      const ctx = await browser.newContext({ timezoneId: "UTC", viewport: { width: 1300, height: 900 } });
      if (account) await ctx.addInitScript(walletScript(account));
      const page = await ctx.newPage();
      page.setDefaultTimeout(20000);
      page.errors = []; allPages.push(page);
      page.on("pageerror", (e) => page.errors.push(e.message));
      return page;
    };
    const shot = (page, n) => page.screenshot({ path: path.join(shots, `e2e-${n}.png`) }).catch(() => {});

    const registerAndVerify = async (page, role, u) => {
      await page.goto(`${FE}/register/${role}`);
      const inp = page.locator("form input");
      await inp.nth(0).fill(u.name); await inp.nth(1).fill(u.email);
      if (role === "voter") { await inp.nth(2).fill(u.voterId); await inp.nth(3).fill(PW); await inp.nth(4).fill(PW); }
      else { await inp.nth(2).fill(PW); await inp.nth(3).fill(PW); }
      const before = Date.now();
      await page.getByRole("button", { name: /Create account/ }).click();
      await page.waitForURL(/verify-otp/);
      await page.getByLabel("6-digit code").fill(await getOtp(u.email, before - 1000));
      await page.getByRole("button", { name: "Verify email" }).click();
      await page.waitForURL(/\/login/);
    };
    const login = async (page, email, pw = PW) => {
      await page.goto(`${FE}/login`);
      await page.locator("form input").nth(0).fill(email); await page.locator("form input").nth(1).fill(pw);
      await page.getByRole("button", { name: "Log in" }).click();
      await page.waitForURL(/\/(voter|admin|candidate)/);
    };

    const U = {
      v1: { name: "Vera Voter", email: "vera@e2e.test", voterId: "VOTER-0001" },
      v2: { name: "Victor Voter", email: "victor@e2e.test", voterId: "VOTER-0002" },
      v3: { name: "Rita Rejected", email: "rita@e2e.test", voterId: "VOTER-0003" },
      c1: { name: "Alice Candidate", email: "alice@e2e.test", party: "Unity Party" },
      c2: { name: "Bob Candidate", email: "bob@e2e.test", party: "Progress Alliance" },
    };

    // ================= 1. admin creates election (UI -> backend -> chain) =================
    const admin = await newPage();
    let electionStart, electionEnd;
    await step("admin logs in and creates an election (on-chain)", async () => {
      await login(admin, "admin@e2e.test");
      await admin.goto(`${FE}/admin/elections/new`);
      const startMs = Math.ceil((Date.now() + 110000) / 60000) * 60000; // minute resolution in datetime-local
      electionStart = startMs; electionEnd = startMs + 120000;
      const fmt = (ms) => new Date(ms).toISOString().slice(0, 16);
      const inp = admin.locator("form input");
      await inp.nth(0).fill("Student Council 2026");
      await admin.locator("form textarea").fill("Annual student council election.");
      await inp.nth(1).fill(fmt(electionStart)); await inp.nth(2).fill(fmt(electionEnd));
      await admin.getByRole("button", { name: "Create election" }).click();
      await admin.waitForURL(/\/admin\/elections$/);
      await admin.getByTestId("election-row").filter({ hasText: "Student Council 2026" }).waitFor();
      const e = await voting.getElection(1);
      assert(e.name === "Student Council 2026", "election exists on-chain with correct name");
      assert(Number(e.startTime) * 1000 === electionStart && Number(e.endTime) * 1000 === electionEnd, "on-chain schedule matches");
      log(`   election window ${new Date(electionStart).toISOString()} -> ${new Date(electionEnd).toISOString()}`);
    });

    // ================= 2. registration + email OTP (real SMTP) =================
    const pages = {};
    await step("voters and candidates register via UI and verify email OTP", async () => {
      for (const k of ["v1", "v2", "v3"]) { pages[k] = await newPage(k === "v1" ? V1 : k === "v2" ? V2 : V3); await registerAndVerify(pages[k], "voter", U[k]); }
      for (const k of ["c1", "c2"]) { pages[k] = await newPage(); await registerAndVerify(pages[k], "candidate", U[k]); }
    });
    await step("wrong OTP is rejected in the UI", async () => {
      const p = await newPage();
      await p.goto(`${FE}/register/voter`);
      const inp = p.locator("form input");
      await inp.nth(0).fill("Wrong Otp"); await inp.nth(1).fill("wrongotp@e2e.test"); await inp.nth(2).fill("VOTER-9000"); await inp.nth(3).fill(PW); await inp.nth(4).fill(PW);
      await p.getByRole("button", { name: /Create account/ }).click(); await p.waitForURL(/verify-otp/);
      await p.getByLabel("6-digit code").fill("000000".replace(/0/g, (await getOtp("wrongotp@e2e.test")) === "000000" ? "1" : "0"));
      await p.getByRole("button", { name: "Verify email" }).click();
      await p.getByText(/Incorrect code/).waitFor();
      // login blocked until verified -> redirected to OTP page
      await p.goto(`${FE}/login`);
      await p.locator("form input").nth(0).fill("wrongotp@e2e.test"); await p.locator("form input").nth(1).fill(PW);
      await p.getByRole("button", { name: "Log in" }).click(); await p.waitForURL(/verify-otp/);
      await p.context().close();
    });

    // ================= 3. candidates apply =================
    await step("candidates log in and apply with photo + manifesto", async () => {
      for (const k of ["c1", "c2"]) {
        const p = pages[k]; await login(p, U[k].email);
        await p.locator("form select").selectOption({ index: 1 });
        const inp = p.locator("form input");
        await inp.nth(0).fill(U[k].party);
        await p.locator("input[type=file]").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: PNG });
        await p.locator("form textarea").fill(`${U[k].name}'s manifesto: better facilities, transparent budgets, and student-led events.`);
        await p.getByRole("button", { name: "Submit application" }).click();
        await p.getByText(/Application submitted/).waitFor();
      }
    });

    // ================= 4. admin approvals =================
    await step("admin approves voters, rejects one voter, approves candidates (candidates registered on-chain)", async () => {
      await admin.goto(`${FE}/admin/voters/pending`);
      for (const k of ["v1", "v2"]) {
        const row = admin.getByTestId("voter-row").filter({ hasText: U[k].email });
        await row.getByTestId("approve-voter").click(); await row.waitFor({ state: "detached" });
      }
      const rrow = admin.getByTestId("voter-row").filter({ hasText: U.v3.email });
      await rrow.getByRole("button", { name: /Reject/ }).click(); await rrow.waitFor({ state: "detached" });

      await admin.goto(`${FE}/admin/candidates`);
      for (const k of ["c1", "c2"]) {
        const card = admin.getByTestId("candidate-app").filter({ hasText: U[k].email });
        await card.getByTestId("approve-candidate").click(); await card.waitFor({ state: "detached" });
      }
      const e = await voting.getElection(1);
      assert(Number(e.candidateCount) === 2, "two candidates registered on-chain");
      assert((await voting.getCandidate(1, 1)) === U.c1.name && (await voting.getCandidate(1, 2)) === U.c2.name, "on-chain candidate names");
      assert(Date.now() < electionStart, "approvals finished before election start (timing)");
    });

    // ================= 5. wallet ownership verification =================
    await step("voters connect wallet and prove ownership by signing the server nonce (UI)", async () => {
      for (const [k, addr] of [["v1", V1], ["v2", V2]]) {
        const p = pages[k]; await login(p, U[k].email);
        await p.getByTestId("connect-wallet-card").click();
        await p.getByTestId("verify-wallet").click();
        await p.getByTestId("linked-wallet").waitFor();
        assert((await p.getByTestId("linked-wallet").innerText()).toLowerCase() === addr, "linked wallet displayed");
        const calls = await p.evaluate(() => window.__walletCalls);
        assert(calls.includes("personal_sign"), "wallet was asked to sign a message (personal_sign)");
        assert(await voting.isRegisteredVoter(1, addr), `${k} wallet registered on-chain after verification`);
      }
    });
    await step("rejected voter sees rejection and cannot link a wallet (403)", async () => {
      const p = pages.v3; await login(p, U.v3.email);
      await p.getByText(/registration was rejected/).waitFor();
      const status = await p.evaluate(async (api) => {
        const r = await fetch(api + "/api/wallet/nonce", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + localStorage.getItem("token") }, body: JSON.stringify({ walletAddress: "0x" + "12".repeat(20) }) });
        return r.status;
      }, API);
      assert(status === 403, "unapproved voter gets 403 from /wallet/nonce, got " + status);
      assert(!(await voting.isRegisteredVoter(1, V3)), "rejected voter's wallet is not on the contract allow-list");
    });

    // ================= 6. pre-start guards =================
    await step("voting before the start time is blocked (UI and contract)", async () => {
      const p = pages.v1; await p.goto(`${FE}/voter/elections`);
      await p.getByTestId("election-card").first().getByRole("link").click();
      await p.getByText(/Voting opens/).waitFor();
      assert((await p.getByTestId("cast-vote").count()) === 0, "no Cast Vote button before start");
      await expectRevert((await asSigner(V1)).vote(1, 1), "Election not started");
    });
    await step("results are refused before the election ends (API) and hidden on-chain", async () => {
      const r = await pages.v1.evaluate(async (api) => {
        const tok = localStorage.getItem("token");
        const els = await (await fetch(api + "/api/elections", { headers: { authorization: "Bearer " + tok } })).json();
        const r = await fetch(api + "/api/results/" + els.elections[0]._id, { headers: { authorization: "Bearer " + tok } });
        return r.status;
      }, API);
      assert(r === 403, "results API gives 403 before end, got " + r);
      await expectRevert(voting.getResults(1), "Results not available until election ends");
    });

    // ================= 7. voting =================
    const waitUntil = async (ms, label) => { log(`   waiting for ${label} in ${Math.max(0, Math.round((ms - Date.now()) / 1000))}s`); while (Date.now() < ms + 2500) await sleep(1000); };
    await waitUntil(electionStart, "election start");

    const castVoteUI = async (page, candidateChainId) => {
      await page.goto(`${FE}/voter/elections`);
      await page.getByTestId("election-card").first().getByRole("link").click();
      await page.getByTestId("vote-panel").waitFor();
      await page.getByTestId(`select-${candidateChainId}`).check();
      await page.getByTestId("cast-vote").click();
      await page.getByRole("button", { name: "Continue to MetaMask" }).click();
      await page.getByText(/Your vote has been recorded/).waitFor({ timeout: 30000 });
      await page.getByTestId("tx-hash").waitFor();
      const hash = (await page.getByTestId("tx-hash").innerText()).trim();
      assert(/^0x[a-f0-9]{64}$/i.test(hash), "real tx hash displayed");
      return hash;
    };
    const hashes = {};
    await step("voter 1 casts a vote through the UI (real on-chain tx)", async () => {
      hashes.v1 = await castVoteUI(pages.v1, 1);
      const receipt = await provider.getTransactionReceipt(hashes.v1);
      assert(receipt && receipt.status === 1, "receipt exists with status success");
      assert(receipt.from.toLowerCase() === V1 && receipt.to.toLowerCase() === artifact.address.toLowerCase(), "tx is from voter wallet to contract");
      assert(await voting.hasVoted(1, V1), "contract records hasVoted for voter 1");
      assert(Number(await voting.getTotalVotes(1)) === 1, "total votes = 1");
      await pages.v1.getByTestId("tx-status").filter({ hasText: /confirmed/i }).waitFor();
    });
    await step("voter 2 casts a vote through the UI", async () => {
      hashes.v2 = await castVoteUI(pages.v2, 1);
      assert(await voting.hasVoted(1, V2), "contract records hasVoted for voter 2");
    });
    await step("duplicate voting is prevented (UI hides vote, contract reverts)", async () => {
      await pages.v1.reload();
      await pages.v1.getByText(/Your vote has been recorded/).waitFor();
      assert((await pages.v1.getByTestId("cast-vote").count()) === 0, "no Cast Vote button after voting");
      await expectRevert((await asSigner(V1)).vote(1, 2), "Already voted");
    });
    await step("unauthorised wallet cannot vote (contract reverts)", async () => {
      await expectRevert((await asSigner(OUTSIDER)).vote(1, 1), "Not an authorized voter");
      await expectRevert((await asSigner(V3)).vote(1, 1), "Not an authorized voter");
      assert(Number(await voting.getTotalVotes(1)) === 2, "still exactly 2 votes");
    });
    await step("my voting status + transaction history pages show the real transaction", async () => {
      await pages.v1.goto(`${FE}/voter/status`);
      await pages.v1.getByTestId("my-status").filter({ hasText: "Voted" }).waitFor();
      await pages.v1.goto(`${FE}/voter/transactions`);
      const row = pages.v1.getByTestId("tx-row").first(); await row.waitFor();
      const txt = await row.innerText();
      assert(txt.includes(hashes.v1.slice(0, 12)), "history row shows tx hash prefix");
      assert(/confirmed/i.test(txt), "history row shows confirmed");
    });
    await step("admin sees both transactions and live participation (event listener + record)", async () => {
      await admin.goto(`${FE}/admin/transactions`);
      await admin.getByTestId("tx-row").nth(1).waitFor();
      assert((await admin.getByTestId("tx-row").count()) === 2, "two vote transactions listed");
      const stats = await admin.evaluate(async (api) => (await (await fetch(api + "/api/admin/stats", { headers: { authorization: "Bearer " + localStorage.getItem("token") } })).json()), API);
      assert(stats.confirmedVoteTransactions === 2 && stats.participation[0].totalVotes === 2, "admin stats show 2 votes from chain");
      assert(stats.voters.total === 3 && stats.voters.approved === 2 && stats.voters.walletLinked === 2, "voter stats correct");
    });

    // ================= 8. results =================
    await waitUntil(electionEnd, "election end");
    await step("after the election ends, voting is blocked and results come from the contract", async () => {
      await expectRevert((await asSigner(V2)).vote(1, 2), "Election ended");
      const r = await voting.getResults(1);
      assert(r.votes.map(Number).join() === "2,0" && Number(r.totalVotes) === 2, "on-chain tally is [2,0] total 2");
      const p = pages.v1; await p.goto(`${FE}/voter/results`);
      await p.getByTestId("results-view").waitFor();
      assert((await p.getByTestId("winner").innerText()).includes(U.c1.name), "UI declares the on-chain winner");
      const rows = await p.getByTestId("result-row").allInnerTexts();
      assert(rows.length === 2 && /Alice Candidate[\s\S]*2/.test(rows[0]) && /Bob Candidate[\s\S]*0/.test(rows[1]), "UI table matches contract tally: " + JSON.stringify(rows));
      await shot(p, "results");
      await admin.goto(`${FE}/admin/results`); await admin.getByTestId("results-view").waitFor();
      await shot(admin, "admin-results");
    });
    await step("no uncaught browser errors", async () => {
      const errs = [admin, ...Object.values(pages)].flatMap((p) => p.errors);
      assert(errs.length === 0, "page errors: " + errs.join(" | "));
    });

    log(`\nALL ${passed} E2E STEPS PASSED in ${Math.round((Date.now() - t0) / 1000)}s`);
    process.exitCode = 0;
  } catch (e) {
    log("\nE2E FAILED:", e.message);
    const be = procs.find((x) => x.procName === "backend");
    if (be) log("   backend log tail:\n" + (be.tail || "").split("\n").filter((l) => /error|Error|ERR|50\d|40\d/.test(l)).slice(-12).join("\n"));
    for (const [i, p] of allPages.entries()) {
      try {
        const alerts = await p.locator("[role=alert]").allInnerTexts();
        if (alerts.length) log(`   page#${i} ${p.url()} alerts:`, JSON.stringify(alerts));
        await p.screenshot({ path: path.join(shots, `e2e-fail-${i}.png`) });
      } catch {}
    }
    process.exitCode = 1;
  } finally {
    try { await browser?.close(); } catch {}
    try { await mongod?.stop(); } catch {}
    smtp.close(); await cleanup(); setTimeout(() => process.exit(process.exitCode), 500);
  }
})();
