import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import api, { errMsg } from "../../services/api";
import { Alert, Field } from "../../components/ui";

export default function Register({ role }) {
  const isVoter = role === "voter";
  const nav = useNavigate();
  const [f, setF] = useState({ name: "", email: "", voterId: "", password: "", confirm: "" });
  const [err, setErr] = useState(""); const [fieldErr, setFieldErr] = useState({}); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setErr(""); setFieldErr({});
    if (f.password !== f.confirm) { setFieldErr({ confirm: "Passwords do not match" }); return; }
    setBusy(true);
    try {
      const body = { name: f.name, email: f.email, password: f.password, role, ...(isVoter ? { voterId: f.voterId } : {}) };
      const { data } = await api.post("/auth/register", body);
      nav(`/verify-otp?email=${encodeURIComponent(f.email)}`, { state: { fresh: true, devOtp: data?.devOtp } });
    } catch (e2) {
      const d = e2?.response?.data?.details;
      if (Array.isArray(d)) setFieldErr(Object.fromEntries(d.map((x) => [x.field, x.message])));
      setErr(errMsg(e2));
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2">
      <div className="hidden lg:block">
        <h1 className="text-3xl font-extrabold text-navy-900">{isVoter ? "Register to vote" : "Apply as a candidate"}</h1>
        <p className="mt-3 text-slate-600">{isVoter ? "Create your voter account. After verifying your email and receiving admin approval you can link your MetaMask wallet and vote." : "Create your candidate account first. After verifying your email you can submit your party, photo and manifesto for admin review."}</p>
        <div className="mt-6 flex gap-2 text-sm">
          <Link to="/register/voter" className={isVoter ? "btn-navy btn-sm" : "btn-outline btn-sm"}>Voter</Link>
          <Link to="/register/candidate" className={!isVoter ? "btn-navy btn-sm" : "btn-outline btn-sm"}>Candidate</Link>
        </div>
      </div>
      <form onSubmit={submit} className="card space-y-4 !p-7" noValidate>
        <h2 className="text-xl font-bold text-navy-900 lg:hidden">{isVoter ? "Voter registration" : "Candidate registration"}</h2>
        <Alert type="error">{err}</Alert>
        <Field label="Full name" error={fieldErr.name}><input className="input" value={f.name} onChange={set("name")} required autoComplete="name" /></Field>
        <Field label="Email" error={fieldErr.email}><input className="input" type="email" value={f.email} onChange={set("email")} required autoComplete="email" /></Field>
        {isVoter && <Field label="Voter ID" error={fieldErr.voterId} hint="4-30 letters, numbers or hyphens"><input className="input" value={f.voterId} onChange={set("voterId")} required /></Field>}
        <Field label="Password" error={fieldErr.password} hint="At least 8 characters with a letter and a number"><input className="input" type="password" value={f.password} onChange={set("password")} required autoComplete="new-password" /></Field>
        <Field label="Confirm password" error={fieldErr.confirm}><input className="input" type="password" value={f.confirm} onChange={set("confirm")} required autoComplete="new-password" /></Field>
        <button className="btn-primary w-full" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Create account &amp; send code</button>
        <p className="text-center text-sm text-slate-500">Already have an account? <Link to="/login" className="font-semibold text-brand-700">Log in</Link></p>
      </form>
    </div>
  );
}
