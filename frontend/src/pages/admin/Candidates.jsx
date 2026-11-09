import { useState } from "react";
import { Check, X } from "lucide-react";
import api, { assetUrl, errMsg } from "../../services/api";
import { useFetch } from "../../hooks/useFetch";
import { Alert, Avatar, EmptyState, PageHeader, Spinner, StatusBadge } from "../../components/ui";
import { fmtDate } from "../../utils/format";

export default function Candidates() {
  const [tab, setTab] = useState("pending");
  const { data, loading, error, reload } = useFetch(`/candidates?status=${tab}`);
  const [msg, setMsg] = useState({ type: "", text: "" }); const [busy, setBusy] = useState("");
  const act = async (id, action) => {
    setBusy(id); setMsg({ type: "", text: "" });
    try { const { data: d } = await api.patch(`/candidates/${action}/${id}`); setMsg({ type: "success", text: d.message }); reload(); }
    catch (e) { setMsg({ type: "error", text: errMsg(e) }); } finally { setBusy(""); }
  };
  return (
    <>
      <PageHeader title="Candidate approvals" subtitle="Approving registers the candidate on the smart contract for that election (only possible before it starts)." />
      <div className="mb-4 flex gap-2">{["pending", "approved", "rejected"].map((t) => <button key={t} onClick={() => setTab(t)} className={`btn-sm rounded-full capitalize ${tab === t ? "btn bg-navy-900 text-white" : "btn border border-slate-300 bg-white"}`}>{t}</button>)}</div>
      <Alert type={msg.type || "info"} className="mb-4">{msg.text}</Alert><Alert type="error" className="mb-4">{error}</Alert>
      {loading ? <Spinner /> : !data?.candidates.length ? <EmptyState title={`No ${tab} applications`} /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.candidates.map((c) => (
            <div key={c._id} className="card" data-testid="candidate-app">
              <div className="flex items-center gap-3"><Avatar src={assetUrl(c.profileImage)} name={c.candidateName} size="h-14 w-14" />
                <div className="min-w-0 flex-1"><h3 className="font-semibold text-navy-900">{c.candidateName}</h3><p className="truncate text-xs text-slate-500">{c.userId?.email}</p><p className="text-sm text-brand-700">{c.partyName}</p></div>
                <StatusBadge status={c.approvalStatus} /></div>
              <p className="mt-3 text-xs text-slate-500">Election: <b className="text-slate-700">{c.electionId?.electionName}</b> · Applied {fmtDate(c.createdAt)}</p>
              <p className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{c.manifesto}</p>
              {c.approvalStatus === "pending" && (
                <div className="mt-3 flex gap-2">
                  <button className="btn-success btn-sm" disabled={!!busy} onClick={() => act(c._id, "approve")} data-testid="approve-candidate"><Check className="h-3.5 w-3.5" /> Approve</button>
                  <button className="btn-danger btn-sm" disabled={!!busy} onClick={() => act(c._id, "reject")}><X className="h-3.5 w-3.5" /> Reject</button></div>)}
              {c.blockchainCandidateId && <p className="mt-2 text-xs text-slate-400">On-chain candidate #{c.blockchainCandidateId}</p>}
            </div>))}
        </div>)}
    </>
  );
}
