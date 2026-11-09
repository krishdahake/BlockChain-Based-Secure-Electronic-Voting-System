import { Link } from "react-router-dom";
import { ShieldCheck, Vote, Wallet, Mail, BarChart3, Lock, Link2, UserCheck, ArrowRight } from "lucide-react";

const features = [
  [Mail, "Verified identities", "Email OTP verification and admin approval make sure only eligible people take part."],
  [Wallet, "Wallet ownership proof", "Every voter proves control of their MetaMask wallet by signing a one-time server challenge."],
  [Link2, "On-chain recording", "Each vote is a real Ethereum transaction. Duplicate and out-of-window votes are rejected by the contract."],
  [BarChart3, "Verifiable results", "Final counts are read directly from the smart contract once the election ends, never from a database."],
  [UserCheck, "Role-based access", "Separate admin, voter and candidate dashboards with server-enforced permissions."],
  [Lock, "Privacy-aware design", "No names, emails or personal data are ever written to the public blockchain."],
];
const steps = ["Register & verify email", "Admin approves", "Connect MetaMask", "Cast your vote", "View on-chain results"];

export default function Landing() {
  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-600/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/4 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-28">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-brand-200"><ShieldCheck className="h-3.5 w-3.5" /> Built on Ethereum</span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Elections you can <span className="bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">verify</span>, not just trust.</h1>
            <p className="mt-5 max-w-xl text-lg text-slate-300">SmartVote records every ballot on a public blockchain with secure email, admin and wallet verification, so anyone can audit the tally.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register/voter" className="btn-primary px-6 py-3 text-base">Register as voter <ArrowRight className="h-4 w-4" /></Link>
              <Link to="/register/candidate" className="btn border border-white/25 px-6 py-3 text-base text-white hover:bg-white/10">Apply as candidate</Link>
            </div>
            <p className="mt-6 text-sm text-slate-400">Already registered? <Link to="/login" className="font-semibold text-brand-300 hover:underline">Log in</Link></p>
          </div>
          <div className="hidden justify-center lg:flex">
            <div className="animate-float w-80 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
              <div className="mb-4 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600"><Vote className="h-5 w-5" /></div><div><p className="text-sm font-semibold">Ballot confirmed</p><p className="text-xs text-slate-400">Recorded on-chain</p></div></div>
              <div className="space-y-2 text-xs"><div className="rounded-lg bg-white/5 p-3"><p className="text-slate-400">Transaction</p><p className="truncate font-mono text-brand-200">0x9f3c...b71a</p></div>
                <div className="rounded-lg bg-white/5 p-3"><p className="text-slate-400">Status</p><p className="font-semibold text-emerald-300">Confirmed</p></div></div>
              <p className="mt-3 text-center text-[10px] text-slate-500">Illustration</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center"><h2 className="text-3xl font-bold text-navy-900">Why SmartVote</h2><p className="mt-3 text-slate-500">Traditional paper and database voting asks you to trust the administrator. A smart contract enforces the rules in public.</p></div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(([Icon, t, d]) => (
            <div key={t} className="card transition hover:-translate-y-1 hover:shadow-lg">
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-brand-100 text-brand-700"><Icon className="h-5 w-5" /></div>
              <h3 className="font-semibold text-navy-900">{t}</h3><p className="mt-2 text-sm text-slate-500">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-bold text-navy-900">Five steps to a verified vote</h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-5">
            {steps.map((s, i) => (<li key={s} className="relative rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center"><span className="mx-auto mb-3 grid h-9 w-9 place-items-center rounded-full bg-navy-900 text-sm font-bold text-white">{i + 1}</span><p className="text-sm font-semibold text-navy-900">{s}</p></li>))}
          </ol>
          <div className="mt-10 text-center"><Link to="/how-it-works" className="btn-navy">See the full workflow</Link></div>
        </div>
      </section>
    </>
  );
}
