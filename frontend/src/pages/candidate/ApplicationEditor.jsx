import { useState } from "react";
import { Loader2 } from "lucide-react";
import api, { assetUrl, errMsg } from "../../services/api";
import { Alert, Avatar, Field, StatusBadge } from "../../components/ui";

/** Edit one application. `fields` controls which inputs are shown ("profile" | "manifesto"). */
export default function ApplicationEditor({ app, fields, onSaved }) {
  const [party, setParty] = useState(app.partyName); const [manifesto, setManifesto] = useState(app.manifesto); const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState({ type: "", text: "" });
  const started = app.electionId?.startDate && new Date(app.electionId.startDate) <= new Date();
  const locked = app.approvalStatus === "approved" || started;

  const save = async (e) => {
    e.preventDefault(); setBusy(true); setMsg({ type: "", text: "" });
    try {
      const fd = new FormData();
      if (fields === "profile") { fd.append("partyName", party); if (file) fd.append("profileImage", file); } else fd.append("manifesto", manifesto);
      const { data } = await api.patch(`/candidates/${app._id}`, fd);
      setMsg({ type: "success", text: data.message }); onSaved?.();
    } catch (e2) { setMsg({ type: "error", text: errMsg(e2) }); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={save} className="card space-y-4">
      <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><Avatar src={assetUrl(app.profileImage)} name={app.candidateName} /><div><h3 className="font-semibold text-navy-900">{app.electionId?.electionName}</h3><p className="text-xs text-slate-500">{app.candidateName}</p></div></div><StatusBadge status={app.approvalStatus} /></div>
      <Alert type={msg.type || "info"}>{msg.text}</Alert>
      {locked && <Alert type="info">{app.approvalStatus === "approved" ? "Approved profiles are locked because they have been registered on the blockchain." : "The election has already started."}</Alert>}
      {fields === "profile" ? (<>
        <Field label="Party name"><input className="input" value={party} onChange={(e) => setParty(e.target.value)} disabled={locked} required minLength={2} /></Field>
        <Field label="Replace photo (JPG/PNG/WebP, max 2 MB)"><input type="file" accept="image/jpeg,image/png,image/webp" disabled={locked} onChange={(e) => setFile(e.target.files[0])} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-100 file:px-3 file:py-2 file:font-semibold file:text-brand-700" /></Field>
      </>) : (
        <Field label="Manifesto"><textarea className="input min-h-[180px]" value={manifesto} onChange={(e) => setManifesto(e.target.value)} disabled={locked} required minLength={20} maxLength={5000} /></Field>)}
      {!locked && <button className="btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save changes</button>}
    </form>
  );
}
