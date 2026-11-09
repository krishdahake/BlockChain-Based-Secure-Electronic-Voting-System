const router = require("express").Router();
const { body, param, query } = require("express-validator");
const rateLimit = require("express-rate-limit");
const { authenticate, authorize, requireApproved } = require("../middleware/auth");
const validate = require("../middleware/validate");
const upload = require("../middleware/upload");

const auth = require("../controllers/authController");
const voters = require("../controllers/voterController");
const candidates = require("../controllers/candidateController");
const elections = require("../controllers/electionController");
const wallet = require("../controllers/walletController");
const voting = require("../controllers/votingController");
const results = require("../controllers/resultsController");
const admin = require("../controllers/adminController");

const limiter = (max) =>
  process.env.NODE_ENV === "test"
    ? (_q, _s, n) => n()
    : rateLimit({ windowMs: 15 * 60 * 1000, max, standardHeaders: true, legacyHeaders: false, message: { message: "Too many requests, please try again later" } });

const mongoId = (name = "id") => param(name).isMongoId().withMessage("Invalid id");
const email = body("email").isEmail().withMessage("Valid email required").normalizeEmail({ gmail_remove_dots: false });
const hexHash = body("transactionHash").matches(/^0x[a-fA-F0-9]{64}$/).withMessage("Invalid transaction hash");

// ---------------- auth ----------------
router.post("/auth/register", limiter(20), [
  body("name").trim().isLength({ min: 2, max: 100 }).withMessage("Name must be 2-100 characters"),
  email,
  body("password").isLength({ min: 8, max: 72 }).withMessage("Password must be 8-72 characters")
    .matches(/[A-Za-z]/).withMessage("Password needs a letter").matches(/\d/).withMessage("Password needs a number"),
  body("role").isIn(["voter", "candidate"]).withMessage("Role must be voter or candidate"),
  body("voterId").if(body("role").equals("voter")).trim().isLength({ min: 4, max: 30 }).matches(/^[A-Za-z0-9-]+$/)
    .withMessage("Voter ID must be 4-30 letters, numbers or hyphens"),
  validate,
], auth.register);
router.post("/auth/send-otp", limiter(20), [email, validate], auth.sendOtp);
router.post("/auth/verify-otp", limiter(30), [email, body("otp").matches(/^\d{6}$/).withMessage("OTP must be 6 digits"), validate], auth.verifyOtp);
router.post("/auth/login", limiter(30), [email, body("password").notEmpty().withMessage("Password required"), validate], auth.login);
router.post("/auth/logout", authenticate, auth.logout);

// ---------------- contact ----------------
router.post("/contact", limiter(10), [
  body("name").trim().isLength({ min: 2, max: 100 }).withMessage("Name required"), email,
  body("message").trim().isLength({ min: 10, max: 2000 }).withMessage("Message must be 10-2000 characters"), validate,
], require("../utils/asyncHandler")(async (req, res) => {
  await require("../services/mailer").sendContactEmail(req.body);
  res.json({ message: "Thanks! Your message has been sent." });
}));

// ---------------- voters ----------------
router.get("/voters/profile", authenticate, voters.profile);
router.get("/voters", authenticate, authorize("admin"), [query("status").optional().isIn(["pending", "approved", "rejected"]), validate], voters.list);
router.patch("/voters/approve/:id", authenticate, authorize("admin"), [mongoId(), validate], voters.approve);
router.patch("/voters/reject/:id", authenticate, authorize("admin"), [mongoId(), validate], voters.reject);
router.patch("/voters/reset-wallet/:id", authenticate, authorize("admin"), [mongoId(), validate], voters.resetWallet);

// ---------------- candidates ----------------
const candidateFields = [
  body("partyName").trim().isLength({ min: 2, max: 100 }).withMessage("Party name required (2-100 chars)"),
  body("manifesto").trim().isLength({ min: 20, max: 5000 }).withMessage("Manifesto must be 20-5000 characters"),
];
router.post("/candidates/apply", authenticate, authorize("candidate"), upload.single("profileImage"),
  [body("electionId").isMongoId().withMessage("Election required"), ...candidateFields, validate], candidates.apply);
router.get("/candidates", authenticate, [query("electionId").optional().isMongoId(), query("status").optional().isIn(["pending", "approved", "rejected"]), validate], candidates.list);
router.patch("/candidates/approve/:id", authenticate, authorize("admin"), [mongoId(), validate], candidates.approve);
router.patch("/candidates/reject/:id", authenticate, authorize("admin"), [mongoId(), validate], candidates.reject);
router.patch("/candidates/:id", authenticate, authorize("candidate"), upload.single("profileImage"),
  [mongoId(), body("partyName").optional().trim().isLength({ min: 2, max: 100 }), body("manifesto").optional().trim().isLength({ min: 20, max: 5000 }), validate], candidates.update);

// ---------------- elections ----------------
const dates = (optional) => [
  optional ? body("startDate").optional().isISO8601() : body("startDate").isISO8601().withMessage("Valid start date required"),
  optional ? body("endDate").optional().isISO8601() : body("endDate").isISO8601().withMessage("Valid end date required"),
];
router.post("/elections", authenticate, authorize("admin"), [
  body("electionName").trim().isLength({ min: 3, max: 150 }).withMessage("Election name must be 3-150 characters"),
  body("description").optional().isLength({ max: 2000 }), ...dates(false), validate,
], elections.create);
router.get("/elections", authenticate, elections.list);
router.get("/elections/:id", authenticate, [mongoId(), validate], elections.get);
router.patch("/elections/:id", authenticate, authorize("admin"), [
  mongoId(), body("electionName").optional().trim().isLength({ min: 3, max: 150 }), body("description").optional().isLength({ max: 2000 }),
  ...dates(true), body("status").optional().isIn(["active", "inactive"]), validate,
], elections.update);
router.delete("/elections/:id", authenticate, authorize("admin"), [mongoId(), validate], elections.remove);

// ---------------- wallet ----------------
const addr = body("walletAddress").custom((v) => /^0x[a-fA-F0-9]{40}$/.test(v)).withMessage("Invalid wallet address");
router.post("/wallet/nonce", authenticate, authorize("voter"), requireApproved, [addr, validate], wallet.nonce);
router.post("/wallet/verify", authenticate, authorize("voter"), requireApproved, [addr, body("signature").matches(/^0x[a-fA-F0-9]{130}$/).withMessage("Invalid signature"), validate], wallet.verify);

// ---------------- voting ----------------
router.get("/voting/status/:electionId", authenticate, authorize("voter"), requireApproved, [mongoId("electionId"), validate], voting.status);
router.post("/voting/record", authenticate, authorize("voter"), requireApproved, [body("electionId").isMongoId(), hexHash, validate], voting.record);
router.get("/voting/transactions/:electionId", authenticate, authorize("admin", "voter"), [mongoId("electionId"), validate], voting.transactions);

// ---------------- results & admin ----------------
router.get("/results/:electionId", authenticate, authorize("admin", "voter"), [mongoId("electionId"), validate], results.get);
router.get("/admin/stats", authenticate, authorize("admin"), admin.stats);
router.get("/admin/transactions", authenticate, authorize("admin"), admin.transactions);

module.exports = router;
