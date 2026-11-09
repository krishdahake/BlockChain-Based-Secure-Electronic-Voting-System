import { Link } from "react-router-dom";
import { UserPlus, MailCheck, ShieldCheck, LogIn, Wallet, ListChecks, Vote, BarChart3 } from "lucide-react";

const steps = [
  [UserPlus, "Register", "Choose Voter or Candidate registration and submit your details."],
  [MailCheck, "Verify your email", "A 6-digit code (valid 5 minutes) is emailed to you. Enter it to verify your address."],
  [ShieldCheck, "Admin approval", "An administrator reviews voter registrations and candidate applications."],
  [LogIn, "Log in", "Access your role-specific dashboard."],
  [Wallet, "Connect MetaMask", "Connect your wallet and sign a one-time message to prove you own it. It is then linked to your account."],
  [ListChecks, "Browse elections", "View active elections and their approved candidates and manifestos."],
  [Vote, "Cast your vote", "Select a candidate and confirm the transaction in MetaMask. The contract checks eligibility, timing and duplicates."],
  [BarChart3, "See the results", "When the election ends, totals are read directly from the smart contract and charted."],
];

export default function HowItWorks() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-extrabold text-navy-900">How it works</h1>
      <p className="mt-3 text-slate-600">From registration to verified results in eight steps.</p>
      <ol className="mt-10 space-y-0">
        {steps.map(([Icon, t, d], i) => (
          <li key={t} className="relative flex gap-5 pb-8 last:pb-0">
            {i < steps.length - 1 && <span className="absolute left-[22px] top-12 h-full w-px bg-brand-200" />}
            <span className="relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-navy-900 text-white shadow"><Icon className="h-5 w-5" /></span>
            <div className="card flex-1 !p-4"><p className="text-xs font-semibold text-brand-600">STEP {i + 1}</p><h3 className="font-semibold text-navy-900">{t}</h3><p className="mt-1 text-sm text-slate-500">{d}</p></div>
          </li>
        ))}
      </ol>
      <div className="mt-10 text-center"><Link to="/register/voter" className="btn-primary">Get started</Link></div>
    </div>
  );
}
