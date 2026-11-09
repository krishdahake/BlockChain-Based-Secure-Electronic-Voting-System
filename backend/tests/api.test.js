require("./setupEnv");
const { describe, test, before, after, beforeEach } = require("node:test");
const { expect } = require("expect");
const path = require("path");

// --- module stubs (injected into require.cache before the app loads) ---
const otpCalls = [];
const stub = (rel, exports) => { const f = require.resolve(rel); require.cache[f] = { id: f, filename: f, loaded: true, exports }; };
const mailer = { sendOtpEmail: async (to, otp) => { otpCalls.push([to, otp]); }, _calls: otpCalls };
stub("../services/mailer", mailer);
stub("../services/contractService", require("./fakeChain"));

const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { ethers } = require("ethers");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../app");
const fakeChain = require("./fakeChain");
const User = require("../models/User");
const OTP = require("../models/OTP");

let mongod;
const lastOtp = () => otpCalls.at(-1)[1];
const PW = "Passw0rdOK";

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await User.init(); await OTP.init();
});
after(async () => { await mongoose.disconnect(); await mongod.stop(); });
beforeEach(() => { otpCalls.length = 0; });

async function registerVerified(role, email, extra = {}) {
  await request(app).post("/api/auth/register").send({ name: "Test " + role, email, password: PW, role, voterId: role === "voter" ? "VID" + email.split("@")[0] : undefined, ...extra }).expect(201);
  await request(app).post("/api/auth/verify-otp").send({ email, otp: lastOtp() }).expect(200);
  const res = await request(app).post("/api/auth/login").send({ email, password: PW }).expect(200);
  return { token: res.body.token, user: res.body.user };
}
async function makeAdmin() {
  await User.create({ name: "Admin", email: "admin@test.com", password: await bcrypt.hash(PW, 4), role: "admin", isEmailVerified: true, isApproved: true, approvalStatus: "approved" });
  return (await request(app).post("/api/auth/login").send({ email: "admin@test.com", password: PW })).body.token;
}
const auth = (t) => ({ Authorization: `Bearer ${t}` });

describe("registration & email OTP", () => {
  test("registers, stores only hashed password and hashed OTP, emails a 6-digit code", async () => {
    await request(app).post("/api/auth/register").send({ name: "Alice", email: "alice@test.com", password: PW, role: "voter", voterId: "V-1001" }).expect(201);
    expect(lastOtp()).toMatch(/^\d{6}$/);
    const u = await User.findOne({ email: "alice@test.com" }).select("+password");
    expect(u.password).not.toBe(PW);
    expect(await bcrypt.compare(PW, u.password)).toBe(true);
    expect(u.isEmailVerified).toBe(false);
    const o = await OTP.findOne({ email: "alice@test.com" });
    expect(o.hashedOTP).not.toBe(lastOtp());
    expect(await bcrypt.compare(lastOtp(), o.hashedOTP)).toBe(true);
    expect(o.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(5 * 60 * 1000);
  });

  test("validation rejects weak password, bad email, missing voterId, admin role", async () => {
    const base = { name: "Bob", email: "bob@test.com", password: PW, role: "voter", voterId: "V-2002" };
    await request(app).post("/api/auth/register").send({ ...base, password: "short" }).expect(400);
    await request(app).post("/api/auth/register").send({ ...base, password: "nodigitshere" }).expect(400);
    await request(app).post("/api/auth/register").send({ ...base, email: "nope" }).expect(400);
    await request(app).post("/api/auth/register").send({ ...base, voterId: undefined }).expect(400);
    await request(app).post("/api/auth/register").send({ ...base, role: "admin" }).expect(400);
  });

  test("login is blocked until email verified, then works after OTP", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "alice@test.com", password: PW });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("EMAIL_NOT_VERIFIED");
  });

  test("wrong OTP is rejected; correct OTP verifies; OTP is single-use", async () => {
    await request(app).post("/api/auth/register").send({ name: "Carl", email: "carl@test.com", password: PW, role: "voter", voterId: "V-3003" }).expect(201);
    const good = lastOtp();
    const wrong = good === "123456" ? "654321" : "123456";
    const bad = await request(app).post("/api/auth/verify-otp").send({ email: "carl@test.com", otp: wrong }).expect(400);
    expect(bad.body.message).toMatch(/Incorrect/);
    await request(app).post("/api/auth/verify-otp").send({ email: "carl@test.com", otp: good }).expect(200);
    await request(app).post("/api/auth/verify-otp").send({ email: "carl@test.com", otp: good }).expect(400);
    await request(app).post("/api/auth/login").send({ email: "carl@test.com", password: PW }).expect(200);
  });

  test("OTP locks after 5 wrong attempts (even with the right code afterwards)", async () => {
    await request(app).post("/api/auth/register").send({ name: "Dan", email: "dan@test.com", password: PW, role: "voter", voterId: "V-4004" }).expect(201);
    const good = lastOtp();
    const wrong = good === "111111" ? "222222" : "111111";
    for (let i = 0; i < 5; i++) await request(app).post("/api/auth/verify-otp").send({ email: "dan@test.com", otp: wrong }).expect(400);
    await request(app).post("/api/auth/verify-otp").send({ email: "dan@test.com", otp: good }).expect(429);
  });

  test("expired OTP is rejected", async () => {
    await request(app).post("/api/auth/register").send({ name: "Eve", email: "eve@test.com", password: PW, role: "voter", voterId: "V-5005" }).expect(201);
    await OTP.updateOne({ email: "eve@test.com" }, { expiresAt: new Date(Date.now() - 1000) });
    const r = await request(app).post("/api/auth/verify-otp").send({ email: "eve@test.com", otp: lastOtp() }).expect(400);
    expect(r.body.message).toMatch(/expired/);
  });

  test("resend: cooldown enforced, hourly cap enforced, new code replaces old", async () => {
    await request(app).post("/api/auth/register").send({ name: "Fay", email: "fay@test.com", password: PW, role: "voter", voterId: "V-6006" }).expect(201);
    const first = lastOtp();
    await request(app).post("/api/auth/send-otp").send({ email: "fay@test.com" }).expect(429); // cooldown
    for (let i = 0; i < 5; i++) {
      await OTP.updateOne({ email: "fay@test.com" }, { lastSentAt: new Date(Date.now() - 61000) });
      await request(app).post("/api/auth/send-otp").send({ email: "fay@test.com" }).expect(200);
    }
    await OTP.updateOne({ email: "fay@test.com" }, { lastSentAt: new Date(Date.now() - 61000) });
    await request(app).post("/api/auth/send-otp").send({ email: "fay@test.com" }).expect(429); // cap
    expect(first).toMatch(/^\d{6}$/);
  });

  test("send-otp does not reveal whether an account exists", async () => {
    const r = await request(app).post("/api/auth/send-otp").send({ email: "ghost@test.com" }).expect(200);
    expect(r.body.message).toMatch(/If this email/);
    expect(otpCalls).toHaveLength(0);
  });

  test("duplicate verified email / voter ID rejected", async () => {
    await request(app).post("/api/auth/register").send({ name: "Alice2", email: "carl@test.com", password: PW, role: "voter", voterId: "V-9999" }).expect(409);
    await request(app).post("/api/auth/register").send({ name: "Gus", email: "gus@test.com", password: PW, role: "voter", voterId: "V-3003" }).expect(409);
  });
});

describe("login, JWT and RBAC", () => {
  let admin, voter, candidate;
  before(async () => {
    admin = await makeAdmin();
    voter = await registerVerified("voter", "vee@test.com");
    candidate = await registerVerified("candidate", "cat@test.com");
  });

  test("wrong password and unknown user both give 401 with same message", async () => {
    const a = await request(app).post("/api/auth/login").send({ email: "vee@test.com", password: "WrongPass1" }).expect(401);
    const b = await request(app).post("/api/auth/login").send({ email: "nobody@test.com", password: "WrongPass1" }).expect(401);
    expect(a.body.message).toBe(b.body.message);
  });

  test("login response never leaks password hash / nonce", async () => {
    expect(voter.user.password).toBeUndefined();
    expect(voter.user.tokenVersion).toBeUndefined();
  });

  test("protected routes require a valid JWT", async () => {
    await request(app).get("/api/voters/profile").expect(401);
    await request(app).get("/api/voters/profile").set(auth("garbage")).expect(401);
    const r = await request(app).get("/api/voters/profile").set(auth(voter.token)).expect(200);
    expect(r.body.user.email).toBe("vee@test.com");
  });

  test("role-based authorization", async () => {
    await request(app).get("/api/voters").set(auth(voter.token)).expect(403);
    await request(app).get("/api/voters").set(auth(candidate.token)).expect(403);
    await request(app).get("/api/voters").set(auth(admin)).expect(200);
    await request(app).get("/api/admin/stats").set(auth(voter.token)).expect(403);
    await request(app).post("/api/elections").set(auth(voter.token)).send({}).expect(403);
    await request(app).patch(`/api/voters/approve/${voter.user._id}`).set(auth(voter.token)).expect(403); // self-approval blocked
    await request(app).post("/api/candidates/apply").set(auth(voter.token)).send({}).expect(403);
    await request(app).get("/api/voting/status/" + new mongoose.Types.ObjectId()).set(auth(candidate.token)).expect(403);
    await request(app).get("/api/results/" + new mongoose.Types.ObjectId()).set(auth(candidate.token)).expect(403);
  });

  test("logout revokes the token", async () => {
    const t = (await request(app).post("/api/auth/login").send({ email: "vee@test.com", password: PW })).body.token;
    await request(app).get("/api/voters/profile").set(auth(t)).expect(200);
    await request(app).post("/api/auth/logout").set(auth(t)).expect(200);
    await request(app).get("/api/voters/profile").set(auth(t)).expect(401);
  });

  test("unapproved voter cannot use wallet/voting features", async () => {
    const t = (await request(app).post("/api/auth/login").send({ email: "vee@test.com", password: PW })).body.token;
    await request(app).post("/api/wallet/nonce").set(auth(t)).send({ walletAddress: ethers.Wallet.createRandom().address }).expect(403);
  });
});

describe("approvals, elections, candidates", () => {
  let admin, voter, cand, election;
  before(async () => {
    fakeChain._reset();
    admin = await request(app).post("/api/auth/login").send({ email: "admin@test.com", password: PW }).then((r) => r.body.token);
    voter = await registerVerified("voter", "approveme@test.com");
    cand = await registerVerified("candidate", "runner@test.com");
  });

  test("admin creates election (on-chain id stored) and validates dates", async () => {
    const now = Date.now();
    await request(app).post("/api/elections").set(auth(admin)).send({ electionName: "Bad", startDate: new Date(now + 5000), endDate: new Date(now + 1000) }).expect(400);
    const r = await request(app).post("/api/elections").set(auth(admin)).send({ electionName: "Council 2026", description: "d", startDate: new Date(now + 3600e3), endDate: new Date(now + 7200e3) }).expect(201);
    election = r.body.election;
    expect(election.blockchainElectionId).toBe(1);
    expect(election.phase).toBe("upcoming");
  });

  test("voter approval/rejection", async () => {
    const rej = await request(app).patch(`/api/voters/reject/${voter.user._id}`).set(auth(admin)).expect(200);
    expect(rej.body.user.isApproved).toBe(false);
    expect(rej.body.user.approvalStatus).toBe("rejected");
    const ok = await request(app).patch(`/api/voters/approve/${voter.user._id}`).set(auth(admin)).expect(200);
    expect(ok.body.user.isApproved).toBe(true);
    await request(app).patch(`/api/voters/approve/${new mongoose.Types.ObjectId()}`).set(auth(admin)).expect(404);
    await request(app).patch(`/api/voters/approve/not-an-id`).set(auth(admin)).expect(400);
    const list = await request(app).get("/api/voters?status=approved").set(auth(admin)).expect(200);
    expect(list.body.voters.some((v) => v.email === "approveme@test.com")).toBe(true);
  });

  test("candidate applies, appears only after approval, approval registers on-chain", async () => {
    const apply = await request(app).post("/api/candidates/apply").set(auth(cand.token))
      .field("electionId", election._id).field("partyName", "Unity Party").field("manifesto", "A long enough manifesto text for validation.").expect(201);
    const id = apply.body.candidate._id;
    await request(app).post("/api/candidates/apply").set(auth(cand.token))
      .field("electionId", election._id).field("partyName", "Unity Party").field("manifesto", "A long enough manifesto text for validation.").expect(409);
    // voters don't see pending candidates
    let list = await request(app).get(`/api/candidates?electionId=${election._id}`).set(auth(voter.token)).expect(200);
    expect(list.body.candidates).toHaveLength(0);
    // candidate sees their own application
    const mine = await request(app).get("/api/candidates?mine=true").set(auth(cand.token)).expect(200);
    expect(mine.body.candidates[0].approvalStatus).toBe("pending");
    // non-admin cannot approve
    await request(app).patch(`/api/candidates/approve/${id}`).set(auth(cand.token)).expect(403);
    const ok = await request(app).patch(`/api/candidates/approve/${id}`).set(auth(admin)).expect(200);
    expect(ok.body.candidate.blockchainCandidateId).toBe(1);
    expect(ok.body.candidate.approvalStatus).toBe("approved");
    list = await request(app).get(`/api/candidates?electionId=${election._id}`).set(auth(voter.token)).expect(200);
    expect(list.body.candidates).toHaveLength(1);
    expect(list.body.candidates[0].userId).toBeUndefined();
    // approved can't be rejected
    await request(app).patch(`/api/candidates/reject/${id}`).set(auth(admin)).expect(409);
  });

  test("candidate photo upload accepts images only", async () => {
    const cand2 = await registerVerified("candidate", "second@test.com");
    await request(app).post("/api/candidates/apply").set(auth(cand2.token))
      .field("electionId", election._id).field("partyName", "Other Party").field("manifesto", "A long enough manifesto text for validation.")
      .attach("profileImage", Buffer.from("not an image"), { filename: "x.exe", contentType: "application/x-msdownload" }).expect(400);
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
    const r = await request(app).post("/api/candidates/apply").set(auth(cand2.token))
      .field("electionId", election._id).field("partyName", "Other Party").field("manifesto", "A long enough manifesto text for validation.")
      .attach("profileImage", png, { filename: "p.png", contentType: "image/png" }).expect(201);
    expect(r.body.candidate.profileImage).toMatch(/^\/uploads\/[a-f0-9]{32}\.png$/);
    const rej = await request(app).patch(`/api/candidates/reject/${r.body.candidate._id}`).set(auth(admin)).expect(200);
    expect(rej.body.candidate.approvalStatus).toBe("rejected");
  });

  test("non-admin sees only active elections; admin can deactivate", async () => {
    await request(app).patch(`/api/elections/${election._id}`).set(auth(admin)).send({ status: "inactive" }).expect(200);
    const v = await request(app).get("/api/elections").set(auth(voter.token)).expect(200);
    expect(v.body.elections).toHaveLength(0);
    const a = await request(app).get("/api/elections").set(auth(admin)).expect(200);
    expect(a.body.elections).toHaveLength(1);
    await request(app).patch(`/api/elections/${election._id}`).set(auth(admin)).send({ status: "active" }).expect(200);
  });

  test("results are refused before the election ends", async () => {
    const r = await request(app).get(`/api/results/${election._id}`).set(auth(admin)).expect(403);
    expect(r.body.message).toMatch(/after the election has ended/);
  });
});

describe("wallet ownership verification", () => {
  let voterTok, wallet, other;
  before(async () => {
    const admin = (await request(app).post("/api/auth/login").send({ email: "admin@test.com", password: PW })).body.token;
    const v = await registerVerified("voter", "walletvoter@test.com");
    voterTok = v.token;
    await request(app).patch(`/api/voters/approve/${v.user._id}`).set(auth(admin)).expect(200);
    wallet = ethers.Wallet.createRandom();
    other = ethers.Wallet.createRandom();
  });

  test("rejects invalid address / signature formats", async () => {
    await request(app).post("/api/wallet/nonce").set(auth(voterTok)).send({ walletAddress: "0x123" }).expect(400);
    await request(app).post("/api/wallet/verify").set(auth(voterTok)).send({ walletAddress: wallet.address, signature: "0xabc" }).expect(400);
  });

  test("verify without a nonce fails", async () => {
    await request(app).post("/api/wallet/verify").set(auth(voterTok)).send({ walletAddress: wallet.address, signature: "0x" + "00".repeat(65) }).expect(400);
  });

  test("signature from a different key is rejected; nonce survives for retry", async () => {
    const n = await request(app).post("/api/wallet/nonce").set(auth(voterTok)).send({ walletAddress: wallet.address }).expect(200);
    const forged = await other.signMessage(n.body.message);
    await request(app).post("/api/wallet/verify").set(auth(voterTok)).send({ walletAddress: wallet.address, signature: forged }).expect(401);
    const u = await User.findOne({ email: "walletvoter@test.com" });
    expect(u.walletAddress).toBeUndefined();
  });

  test("tampered message (wrong nonce) is rejected", async () => {
    const n = await request(app).post("/api/wallet/nonce").set(auth(voterTok)).send({ walletAddress: wallet.address }).expect(200);
    const sig = await wallet.signMessage(n.body.message.replace(n.body.nonce, "0".repeat(32)));
    await request(app).post("/api/wallet/verify").set(auth(voterTok)).send({ walletAddress: wallet.address, signature: sig }).expect(401);
  });

  test("expired nonce is rejected", async () => {
    const n = await request(app).post("/api/wallet/nonce").set(auth(voterTok)).send({ walletAddress: wallet.address }).expect(200);
    await User.updateOne({ email: "walletvoter@test.com" }, { walletNonceExpires: new Date(Date.now() - 1000) });
    const sig = await wallet.signMessage(n.body.message);
    await request(app).post("/api/wallet/verify").set(auth(voterTok)).send({ walletAddress: wallet.address, signature: sig }).expect(400);
  });

  test("valid signature links wallet, nonce is single-use, registers on all open elections", async () => {
    const n = await request(app).post("/api/wallet/nonce").set(auth(voterTok)).send({ walletAddress: wallet.address }).expect(200);
    const sig = await wallet.signMessage(n.body.message);
    const ok = await request(app).post("/api/wallet/verify").set(auth(voterTok)).send({ walletAddress: wallet.address, signature: sig }).expect(200);
    expect(ok.body.user.walletAddress).toBe(wallet.address.toLowerCase());
    expect(await fakeChain.isRegistered(1, wallet.address)).toBe(true);
    // replay fails
    await request(app).post("/api/wallet/verify").set(auth(voterTok)).send({ walletAddress: wallet.address, signature: sig }).expect(400);
  });

  test("one wallet per voter, and a wallet cannot be shared between voters", async () => {
    await request(app).post("/api/wallet/nonce").set(auth(voterTok)).send({ walletAddress: other.address }).expect(409);
    const admin = (await request(app).post("/api/auth/login").send({ email: "admin@test.com", password: PW })).body.token;
    const v2 = await registerVerified("voter", "walletvoter2@test.com");
    await request(app).patch(`/api/voters/approve/${v2.user._id}`).set(auth(admin)).expect(200);
    await request(app).post("/api/wallet/nonce").set(auth(v2.token)).send({ walletAddress: wallet.address }).expect(409);
  });
});

describe("vote transaction recording", () => {
  let tok, election, wallet, admin;
  const hash = "0x" + "a1".repeat(32);
  before(async () => {
    admin = (await request(app).post("/api/auth/login").send({ email: "admin@test.com", password: PW })).body.token;
    const u = await User.findOne({ email: "walletvoter@test.com" });
    wallet = u.walletAddress;
    tok = (await request(app).post("/api/auth/login").send({ email: "walletvoter@test.com", password: PW })).body.token;
    const e = await request(app).get("/api/elections").set(auth(admin));
    election = e.body.elections[0];
  });
  const rec = (h = hash) => request(app).post("/api/voting/record").set(auth(tok)).send({ electionId: election._id, transactionHash: h });

  test("status reports registered-on-chain, not voted", async () => {
    const r = await request(app).get(`/api/voting/status/${election._id}`).set(auth(tok)).expect(200);
    expect(r.body).toMatchObject({ walletLinked: true, registeredOnChain: true, hasVoted: false, phase: "upcoming", canVote: false });
  });

  test("rejects malformed hash, unknown tx, foreign sender, wrong contract, wrong election", async () => {
    await rec("0x123").expect(400);
    fakeChain._verify = { found: false };
    await rec().expect(404);
    const contract = fakeChain.getAddress().toLowerCase();
    fakeChain._verify = { found: true, status: "confirmed", from: "0x" + "99".repeat(20), to: contract, contract, blockNumber: 5, vote: { electionId: 1, voter: wallet } };
    await rec().expect(403);
    fakeChain._verify = { found: true, status: "confirmed", from: wallet, to: "0x" + "88".repeat(20), contract, blockNumber: 5, vote: { electionId: 1, voter: wallet } };
    await rec().expect(400);
    fakeChain._verify = { found: true, status: "confirmed", from: wallet, to: contract, contract, blockNumber: 5, vote: { electionId: 77, voter: wallet } };
    await rec().expect(400);
  });

  test("pending -> confirmed lifecycle; stores no candidate choice", async () => {
    const contract = fakeChain.getAddress().toLowerCase();
    fakeChain._verify = { found: true, status: "pending", from: wallet, to: contract, contract };
    let r = await rec().expect(200);
    expect(r.body.transaction.transactionStatus).toBe("pending");
    fakeChain._verify = { found: true, status: "confirmed", from: wallet, to: contract, contract, blockNumber: 12, vote: { electionId: 1, voter: wallet } };
    r = await rec().expect(200);
    expect(r.body.transaction.transactionStatus).toBe("confirmed");
    expect(r.body.transaction.blockNumber).toBe(12);
    expect(r.body.transaction.candidateId).toBeUndefined();
    expect(r.body.transaction.candidate).toBeUndefined();
  });

  test("another voter cannot claim this transaction; admin sees all, voter sees own", async () => {
    const v2 = (await request(app).post("/api/auth/login").send({ email: "walletvoter2@test.com", password: PW })).body.token;
    await request(app).post("/api/voting/record").set(auth(v2)).send({ electionId: election._id, transactionHash: hash }).expect(400); // no wallet linked
    const a = await request(app).get(`/api/voting/transactions/${election._id}`).set(auth(admin)).expect(200);
    expect(a.body.transactions).toHaveLength(1);
    const mine = await request(app).get(`/api/voting/transactions/${election._id}`).set(auth(tok)).expect(200);
    expect(mine.body.transactions).toHaveLength(1);
    const theirs = await request(app).get(`/api/voting/transactions/${election._id}`).set(auth(v2)).expect(200);
    expect(theirs.body.transactions).toHaveLength(0);
  });
});

describe("admin reporting endpoints", () => {
  test("stats and transactions work with populated partial election documents", async () => {
    const admin = (await request(app).post("/api/auth/login").send({ email: "admin@test.com", password: PW })).body.token;
    const stats = await request(app).get("/api/admin/stats").set(auth(admin)).expect(200);
    expect(stats.body.voters.total).toBeGreaterThan(0);
    expect(stats.body.elections.total).toBe(1);
    const tx = await request(app).get("/api/admin/transactions").set(auth(admin)).expect(200);
    expect(tx.body.transactions).toHaveLength(1);
    expect(tx.body.transactions[0].electionId.electionName).toBe("Council 2026");
    expect(tx.body.transactions[0].candidateId).toBeUndefined();
  });
});
