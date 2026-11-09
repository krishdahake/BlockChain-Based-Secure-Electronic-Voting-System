# SmartVote - Blockchain-Based Smart Voting System

A full-stack college PBL project: a MERN application whose votes are recorded on Ethereum by a Solidity smart contract, with email-OTP authentication, admin approval, MetaMask wallet-ownership verification and on-chain results.

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite, Tailwind CSS, React Router, Axios, Ethers.js v6, Recharts, Lucide |
| Backend | Node.js, Express, MongoDB Atlas + Mongoose, JWT, bcrypt, Nodemailer, express-validator |
| Blockchain | Solidity 0.8.24, OpenZeppelin v5 (`AccessControl`, `ReentrancyGuard`), Hardhat, MetaMask |

---

## 1. Architecture

```
 Browser (React) ──REST/JWT──▶ Express API ──▶ MongoDB (profiles, auth, election metadata, tx references)
      │                           │
      │ MetaMask (signs vote)     │ admin-only transactions (create election / add candidate / register voter)
      ▼                           ▼
              Voting.sol on Ethereum  ◀── authoritative source of votes, counts, voted-status
```

**Who can do what on-chain**

* The **backend signer** (holder of `ADMIN_ROLE`) can only perform administrative setup: `createElection`, `updateElection`, `setElectionActive`, `addCandidate`, `registerVoter(s)`. It can **never** cast, change or delete a vote.
* **Voters** call `vote(electionId, candidateId)` themselves from MetaMask.
* **Results** are read straight from the contract (`getResults`), which reverts until the election has ended. MongoDB holds no vote counts, and it does not store which candidate a voter chose.

**Backend verifies, never trusts, the browser.** After a vote, the frontend reports the transaction hash to `POST /api/voting/record`. The backend fetches the transaction and receipt from the node and checks: sender == the voter's verified wallet, target == the voting contract, receipt status == success, and a `VoteCast` event for the right election and voter. A separate event listener also reconciles `VoteCast` events (including after downtime) so records are correct even if the browser closed early.

### Workflow

1. Register as **voter** or **candidate** → 6-digit OTP emailed (bcrypt-hashed, 5 min expiry, 5 attempts, resend cooldown + hourly cap) → email verified.
2. **Admin approves** the voter / candidate. Approving a candidate registers them on-chain for that election (before the election starts).
3. Voter logs in → **connects MetaMask** → backend issues a one-time nonce → voter **signs it** (`personal_sign`) → backend recovers the signer with `ethers.verifyMessage` → wallet linked to the account (one wallet per voter, one voter per wallet) → wallet added to the on-chain allow-list for open elections.
4. During the voting window the voter picks a candidate → MetaMask confirmation → contract checks activity, time window, allow-list, duplicate vote, valid candidate → vote + `VoteCast` event → tx hash and confirmation shown.
5. After the end time, results (bar + pie charts) are rendered from contract data.

### Folder structure

```
smart-voting-system/
├── blockchain/   contracts/Voting.sol · scripts/deploy.js · test/Voting.test.js · hardhat.config.js
├── backend/      config/ controllers/ middleware/ models/ routes/ services/ utils/ tests/ server.js app.js
├── frontend/     src/{components,pages,layouts,context,hooks,services,contracts,utils} App.jsx
├── scripts/      e2e.js  (full end-to-end test)
└── README.md
```

---

## 2. Privacy - read this

* **Nothing personal is on-chain**: no names, emails, voter IDs or passwords, only wallet addresses and opaque candidate numbers (candidate names/ids are public campaign info).
* **This is NOT a secret ballot and NOT fully anonymous.** A public blockchain is transparent: every `vote()` transaction publicly links *wallet address → candidate number*. Anyone who can tie a wallet to a person can see how they voted. The contract hides per-candidate *tallies* until the election ends, but that is only an interface rule: raw transaction history and contract storage remain publicly readable, so a determined observer can count early.
* MongoDB deliberately does **not** store the chosen candidate, but it does link a user account to their wallet (required for eligibility), so the operator can map a user to a wallet and therefore to a vote.
* Real-world systems would need commit-reveal, blind signatures or zero-knowledge proofs (e.g. MACI, Semaphore) to get ballot secrecy and coercion resistance. That is out of scope for this academic implementation.

Other security measures: bcrypt (cost 12) for passwords, hashed OTPs, JWT with server-side revocation (logout bumps a `tokenVersion`), role-based middleware on every route, request validation, Helmet, CORS allow-list, rate limiting on auth routes, uploads limited to 2 MB JPG/PNG/WebP with random filenames, account-enumeration-safe resend endpoint, checks-effects-interactions + `ReentrancyGuard` in the contract. No secrets are hard-coded; the app never asks for a seed phrase or private key.

---

## 3. Prerequisites

* Node.js 18+ (tested on 22) and npm
* [MetaMask](https://metamask.io/download/) browser extension
* A MongoDB Atlas account (free tier) - see §5
* A Gmail account with an App Password - see §6

## 4. Installation

```bash
cd smart-voting-system
(cd blockchain && npm install)
(cd backend    && npm install)
(cd frontend   && npm install)
```

## 5. MongoDB Atlas

1. Create a free **M0** cluster at <https://cloud.mongodb.com>.
2. *Database Access* → add a database user (username + strong password).
3. *Network Access* → add your IP (or `0.0.0.0/0` for a class demo only).
4. *Connect → Drivers* → copy the connection string and put it in `backend/.env` as `MONGODB_URI`, adding a database name (e.g. `/smart-voting`) and your credentials.

## 6. Gmail SMTP (OTP email)

1. Enable **2-Step Verification** on the Google account.
2. Create an **App Password**: Google Account → Security → *App passwords* → generate one for "Mail".
3. In `backend/.env`: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER=<your gmail>`, `SMTP_PASS=<the 16-char app password>`, `EMAIL_FROM=<your gmail>`.

If SMTP is not configured, registration returns a clear error; there is no fake/simulated email.

## 7. Local blockchain & contract

```bash
cd blockchain
npx hardhat test                 # 18 contract tests
npx hardhat node                 # terminal 1 - local chain at http://127.0.0.1:8545, chainId 31337
npm run deploy:local             # terminal 2 - deploys Voting.sol
```

`deploy:local` prints the contract address and writes `backend/config/Voting.json` and `frontend/src/contracts/Voting.json` (address + ABI). **Run it before starting the backend or building the frontend.** Restarting `hardhat node` resets the chain: redeploy and restart the backend. The local node is configured to mine a block every 2 seconds even when idle, so on-chain time (and therefore the "election ended → results available" rule) tracks real time like a real network.

The deployer (Hardhat account #0) receives `ADMIN_ROLE`. Its private key goes into `backend/.env` as `ADMIN_PRIVATE_KEY`. On the local node this is the well-known Hardhat dev key printed when the node starts (it holds no real funds). **Never put a key that controls real funds in any file.**

### Optional: Sepolia testnet

```bash
cd blockchain
cp .env.example .env     # fill SEPOLIA_RPC_URL (Alchemy/Infura) and DEPLOYER_PRIVATE_KEY (a throw-away test wallet with Sepolia ETH)
npm run deploy:sepolia
```

Then in `backend/.env` set `RPC_URL` to the Sepolia RPC and `ADMIN_PRIVATE_KEY` to the deployer key. Voters need a little Sepolia ETH for gas. The frontend reads the chain id from `Voting.json`, so MetaMask prompts for Sepolia automatically.

## 8. MetaMask setup (local)

1. Install MetaMask and create/unlock a wallet.
2. Add the network (the app's *Switch network* button does it for you): RPC `http://127.0.0.1:8545`, chain id `31337`, symbol `ETH`.
3. **Import a test account** (Account menu → *Import account*) using one of the private keys printed by `npx hardhat node` (accounts #1-#19 for voters). These are public dev keys on a local chain only. Each has 10,000 test ETH. Use a different account per voter.
4. If you restart `hardhat node`, use *Settings → Advanced → Clear activity tab data* in MetaMask to reset its nonce cache.

## 9. Backend & frontend configuration and startup

```bash
cd backend
cp .env.example .env
# fill: MONGODB_URI, JWT_SECRET (node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"),
#       SMTP_*, ADMIN_PRIVATE_KEY (and RPC_URL / CONTRACT_ADDRESS if different)
npm start                                   # http://localhost:5000

cd ../frontend
cp .env.example .env                         # VITE_API_URL=http://localhost:5000
npm run dev                                  # http://localhost:5173
```

### Create the admin account

Admins cannot self-register. Create one from the command line (the password is never written to a file):

```bash
cd backend
ADMIN_EMAIL=admin@college.edu ADMIN_PASSWORD='ChooseAStrongOne1' ADMIN_NAME='Election Admin' npm run create-admin
```

## 10. Using the system (demo script)

1. Log in as admin → **Create election** (start must be in the future so candidates can be approved first).
2. Register a candidate (`/register/candidate`), verify OTP, log in, **apply** for the election; admin approves under *Candidate approvals*.
3. Register a voter, verify OTP; admin approves under *Pending approvals*.
4. Voter logs in, **connects MetaMask**, clicks *Verify wallet ownership* and signs the message.
5. When the election opens, voter selects a candidate → *Cast Vote* → confirm in MetaMask → tx hash + confirmation.
6. After the end time, *Results* shows on-chain counts.

## 11. REST API

All routes are under `/api` and protected by JWT + role middleware unless marked public.

| Area | Endpoints |
|---|---|
| Auth (public) | `POST /auth/register` `POST /auth/send-otp` `POST /auth/verify-otp` `POST /auth/login` · `POST /auth/logout` (auth) |
| Contact (public) | `POST /contact` (emails the configured address) |
| Voters | `GET /voters/profile` (any) · `GET /voters` · `PATCH /voters/approve/:id` · `PATCH /voters/reject/:id` · `PATCH /voters/reset-wallet/:id` (admin) |
| Candidates | `POST /candidates/apply` (candidate, multipart) · `GET /candidates` (admin: all; others: approved; `?mine=true` for candidates) · `PATCH /candidates/:id` (owner edit) · `PATCH /candidates/approve/:id` `…/reject/:id` (admin) |
| Elections | `POST /elections` `PATCH /elections/:id` `DELETE /elections/:id` (admin) · `GET /elections` `GET /elections/:id` (auth) |
| Wallet | `POST /wallet/nonce` `POST /wallet/verify` (approved voter) |
| Voting | `GET /voting/status/:electionId` `POST /voting/record` (approved voter) · `GET /voting/transactions/:electionId` (admin: all, voter: own) |
| Results | `GET /results/:electionId` (admin, voter; only after the election ended; data from the contract) |
| Admin | `GET /admin/stats` `GET /admin/transactions` |

Design notes: `DELETE /elections/:id` is only allowed before an election starts and deactivates the on-chain record (chains are immutable). Candidate approval is only possible before the election starts (the contract enforces it too). Login is permitted after email verification; voting features additionally require admin approval.

## 12. Testing

```bash
# Smart contract (18 tests)
cd blockchain && npx hardhat test

# Backend API (32 tests; real MongoDB in memory, chain faked - see below)
cd backend && npm test

# Full end-to-end (real chain + DB + SMTP + backend + UI)
cd smart-voting-system && node scripts/e2e.js
```

* **Contract tests** cover election creation, voter registration, valid voting, duplicate prevention, unauthorised voters, before-start / after-end voting, invalid candidates, deactivated elections, result hiding, result calculation.
* **Backend tests** cover registration & validation, hashed password/OTP storage, OTP wrong/expired/locked/resend limits, login, JWT auth, logout revocation, RBAC on every role boundary, voter + candidate approval, photo-upload filtering, wallet signature verification (forged signature, tampered message, expired nonce, replay, one-wallet-per-voter), vote-transaction verification. They use a real in-memory MongoDB and an in-memory stand-in for the contract service (the real chain is exercised by the E2E script).
* **E2E (`scripts/e2e.js`)** starts a Hardhat node, deploys the contract, starts MongoDB, a local SMTP server (the backend sends real Nodemailer mail to it), the backend and the built frontend, then drives Chromium through: admin creates an election → voters/candidates register and verify OTP from the received email → candidate applies → admin approves/rejects → voters verify wallet ownership by signing → pre-start guards → real vote transactions through the UI → duplicate/unauthorised attempts revert → admin transaction & stats pages → results after the end time compared with the contract's tally. **MetaMask itself cannot be automated headlessly**, so the test injects an EIP-1193 `window.ethereum` that forwards to the Hardhat node's unlocked accounts; the app's wallet code path (`BrowserProvider` → `personal_sign` / `eth_sendTransaction`) is identical. A manual MetaMask run (§10) is still recommended before demos. The test takes ~5 minutes because it waits out a real election window (the datetime picker has minute resolution).

## 13. Known limitations / future work

* No ballot secrecy (see §2). No gasless/meta-transactions: voters pay gas (free on the local chain).
* One backend signer holds `ADMIN_ROLE`; use a multisig or role separation in production.
* Voter eligibility is "admin approved + signed wallet"; there is no integration with an external identity provider.
* Voter-wallet allow-listing happens per election on wallet verification, election creation and (self-healing) on the voting-status check.
* Uploaded photos are stored on the server's disk (use object storage in production).
