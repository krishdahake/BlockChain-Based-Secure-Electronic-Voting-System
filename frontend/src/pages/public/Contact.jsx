import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import api, { errMsg } from "../../services/api";
import { Alert, Field } from "../../components/ui";

export default function Contact() {
  const [f, setF] = useState({ name: "", email: "", message: "" });
  const [err, setErr] = useState(""); const [ok, setOk] = useState(""); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr(""); setOk(""); setBusy(true);
    try { const { data } = await api.post("/contact", f); setOk(data.message); setF({ name: "", email: "", message: "" }); }
    catch (e2) { setErr(errMsg(e2)); } finally { setBusy(false); }
  };
  return (
    <div className="mx-auto max-w-xl px-4 py-14">
      <h1 className="flex items-center gap-2 text-3xl font-extrabold text-navy-900"><Mail className="h-7 w-7 text-brand-600" /> Contact us</h1>
      <p className="mt-2 text-slate-600">Questions about the project or an election? Send us a message.</p>
      <form onSubmit={submit} className="card mt-6 space-y-4 !p-6">
        <Alert type="error">{err}</Alert><Alert type="success">{ok}</Alert>
        <Field label="Name"><input className="input" value={f.name} onChange={set("name")} required minLength={2} /></Field>
        <Field label="Email"><input className="input" type="email" value={f.email} onChange={set("email")} required /></Field>
        <Field label="Message"><textarea className="input min-h-[140px]" value={f.message} onChange={set("message")} required minLength={10} maxLength={2000} /></Field>
        <button className="btn-primary w-full" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Send message</button>
      </form>
    </div>
  );
}
