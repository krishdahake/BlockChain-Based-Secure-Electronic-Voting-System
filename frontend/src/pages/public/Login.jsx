import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import api, { errMsg } from "../../services/api";
import { Alert, Field } from "../../components/ui";
import { homeFor } from "../../components/ProtectedRoute";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate(); const loc = useLocation();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const user = await login(email, password);
      const from = loc.state?.from;
      nav(from && from.startsWith("/" + user.role) ? from : homeFor(user.role), { replace: true });
    } catch (e2) {
      if (e2?.response?.data?.code === "EMAIL_NOT_VERIFIED") {
        try { await api.post("/auth/send-otp", { email }); } catch { /* cooldown: a code was recently sent */ }
        nav(`/verify-otp?email=${encodeURIComponent(email)}`);
        return;
      }
      setErr(errMsg(e2));
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <form onSubmit={submit} className="card space-y-4 !p-7">
        <div><h1 className="text-2xl font-bold text-navy-900">Welcome back</h1><p className="text-sm text-slate-500">Log in to your SmartVote account.</p></div>
        {loc.state?.verified && <Alert type="success">Email verified. You can now log in.</Alert>}
        <Alert type="error">{err}</Alert>
        <Field label="Email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></Field>
        <Field label="Password"><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></Field>
        <button className="btn-primary w-full" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Log in</button>
        <p className="text-center text-sm text-slate-500">New here? <Link to="/register/voter" className="font-semibold text-brand-700">Register as voter</Link> or <Link to="/register/candidate" className="font-semibold text-brand-700">candidate</Link></p>
      </form>
    </div>
  );
}
