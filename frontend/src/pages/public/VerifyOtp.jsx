import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { Loader2, MailCheck } from "lucide-react";
import api, { errMsg } from "../../services/api";
import { Alert } from "../../components/ui";

export default function VerifyOtp() {
  const [params] = useSearchParams();
  const email = params.get("email") || "";
  const nav = useNavigate();
  const location = useLocation();
  const [otp, setOtp] = useState(location.state?.devOtp || "");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(location.state?.devOtp ? `Development code generated: ${location.state.devOtp}` : "");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(60);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const verify = async (e) => {
    e.preventDefault(); setErr(""); setOk(""); setBusy(true);
    try {
      const { data } = await api.post("/auth/verify-otp", { email, otp });
      setOk(data.message);
      setTimeout(() => nav("/login", { state: { verified: true } }), 1200);
    } catch (e2) { setErr(errMsg(e2)); } finally { setBusy(false); }
  };
  const resend = async () => {
    setErr(""); setOk("");
    try {
      const { data } = await api.post("/auth/send-otp", { email });
      setOk(data.message);
      if (data.devOtp) setOtp(data.devOtp);
      setCooldown(60);
    } catch (e2) { setErr(errMsg(e2)); }
  };

  if (!email) return <div className="mx-auto max-w-md px-4 py-16"><Alert type="warn">No email to verify. <Link to="/register/voter" className="font-semibold underline">Register first</Link>.</Alert></div>;
  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <form onSubmit={verify} className="card space-y-5 !p-7 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-100 text-brand-700"><MailCheck className="h-7 w-7" /></div>
        <div><h1 className="text-xl font-bold text-navy-900">Verify your email</h1><p className="mt-1 text-sm text-slate-500">We sent a 6-digit code to <b className="text-slate-700">{email}</b>. It expires in 5 minutes.</p></div>
        <Alert type="error">{err}</Alert><Alert type="success">{ok}</Alert>
        <input className="input text-center text-2xl font-bold tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="------" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} aria-label="6-digit code" autoFocus />
        <button className="btn-primary w-full" disabled={busy || otp.length !== 6}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Verify email</button>
        <button type="button" onClick={resend} disabled={cooldown > 0} className="text-sm font-medium text-brand-700 disabled:text-slate-400">{cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}</button>
      </form>
    </div>
  );
}
