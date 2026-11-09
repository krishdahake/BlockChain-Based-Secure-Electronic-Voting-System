import { useState } from "react";
import { Loader2 } from "lucide-react";
import api, { assetUrl, errMsg } from "../../services/api";
import { useFetch } from "../../hooks/useFetch";
import { Alert, Avatar, EmptyState, Field, PageHeader, Spinner, StatusBadge } from "../../components/ui";
import { fmtDate } from "../../utils/format";

export default function Status() {
  const apps = useFetch("/candidates?mine=true");
  const els = useFetch("/elections");
  const [f, setF] = useState({ electionId: "", partyName: "", manifesto: "" }); const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState({ type: "", text: "" });
  const applied = new Set((apps.data?.candidates || []).map((a) => a.electionId?._id));
  const open = (els.data?.elections || []).filter((e) => e.phase === "upcoming" && !applied.has(e._id));

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setMsg({ type: "", text: "" });
    try {
      const fd = new FormData(); Object.entries(f).forEach(([k, v]) => fd.append(k, v)); if (file) fd.append("profileImage", file);
      const { data } = await api.post("/candidates/apply", fd);
      setMsg({ type: "success", text: data.message }); setF({ electionId: "", partyName: "", manifesto: "" }); setFile(null); apps.reload();
    } catch (e2) { setMsg({ type: "error", text: errMsg(e2) }); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Application status" subtitle="Track your candidacy. You appear on the ballot only after admin approval." />
      <Alert type={msg.type || "info"} className="mb-4">{msg.text}</Alert>
      {apps.loading ? <Spinner /> : !apps.data?.candidates.length ? <EmptyState title="No applications yet" text="Submit your first application below." /> : (
        <div className="mb-8 grid gap-4 md:grid-cols-2">
          {apps.data.candidates.map((a) => (
            <div key={a._id} className="card" data-testid="my-application">
              <div className="flex items-center gap-3"><Avatar src={assetUrl(a.profileImage)} name={a.candidateName} size="h-14 w-14" />
                <div className="flex-1"><h3 className="font-semibold text-navy-900">{a.electionId?.electionName}</h3><p className="text-sm text-brand-700">{a.partyName}</p></div><StatusBadge status={a.approvalStatus} /></div>
              <p className="mt-3 text-sm text-slate-500">{a.approvalStatus === "pending" && "Waiting for administrator review."}{a.approvalStatus === "approved" && `You are on the ballot (election starts ${fmtDate(a.electionId?.startDate)}).`}{a.approvalStatus === "rejected" && "Your application was rejected. Edit your profile or manifesto to resubmit."}</p>
            </div>))}
        </div>)}
      <div className="card max-w-2xl"><h3 className="mb-4 font-semibold text-navy-900">Apply for an election</h3>
        {els.loading ? <Spinner /> : open.length === 0 ? <p className="text-sm text-slate-500">No upcoming elections are accepting applications.</p> : (
          <form onSubmit={submit} className="space-y-4">
            <Field label="Election"><select className="input" value={f.electionId} onChange={(e) => setF({ ...f, electionId: e.target.value })} required><option value="">Select...</option>{open.map((e) => <option key={e._id} value={e._id}>{e.electionName} (starts {fmtDate(e.startDate)})</option>)}</select></Field>
            <Field label="Party name"><input className="input" value={f.partyName} onChange={(e) => setF({ ...f, partyName: e.target.value })} required minLength={2} /></Field>
            <Field label="Photo (JPG/PNG/WebP, max 2 MB)"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files[0])} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-100 file:px-3 file:py-2 file:font-semibold file:text-brand-700" /></Field>
            <Field label="Manifesto" hint="20-5000 characters"><textarea className="input min-h-[140px]" value={f.manifesto} onChange={(e) => setF({ ...f, manifesto: e.target.value })} required minLength={20} maxLength={5000} /></Field>
            <button className="btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Submit application</button>
          </form>)}
      </div>
    </>
  );
}
