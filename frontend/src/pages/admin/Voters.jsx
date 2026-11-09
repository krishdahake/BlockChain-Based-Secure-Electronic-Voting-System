import { useState } from "react";
import { Check, X, Unlink } from "lucide-react";
import api, { errMsg } from "../../services/api";
import { useFetch } from "../../hooks/useFetch";
import { Alert, EmptyState, PageHeader, Spinner, StatusBadge, Table } from "../../components/ui";
import { fmtDate } from "../../utils/format";

const tabs = ["all", "pending", "approved", "rejected"];

export default function Voters({ initial = "all" }) {
  const [tab, setTab] = useState(initial);
  const { data, loading, error, reload } = useFetch(`/voters${tab === "all" ? "" : `?status=${tab}`}`);
  const [msg, setMsg] = useState({ type: "", text: "" }); const [busy, setBusy] = useState("");

  const act = async (id, action) => {
    setBusy(id + action); setMsg({ type: "", text: "" });
    try { const { data: d } = await api.patch(`/voters/${action}/${id}`); setMsg({ type: "success", text: d.message }); reload(); }
    catch (e) { setMsg({ type: "error", text: errMsg(e) }); } finally { setBusy(""); }
  };

  return (
    <>
      <PageHeader title={initial === "pending" ? "Pending voter approvals" : "Registered voters"} subtitle="Voters have verified their email. Approve eligible voters to let them link a wallet and vote." />
      <div className="mb-4 flex flex-wrap gap-2">{tabs.map((t) => <button key={t} onClick={() => setTab(t)} className={`btn-sm rounded-full capitalize ${tab === t ? "btn bg-navy-900 text-white" : "btn border border-slate-300 bg-white"}`}>{t}</button>)}</div>
      <Alert type={msg.type || "info"} className="mb-4">{msg.text}</Alert><Alert type="error" className="mb-4">{error}</Alert>
      {loading ? <Spinner /> : !data?.voters.length ? <EmptyState title="No voters found" /> : (
        <Table heads={["Name", "Email", "Voter ID", "Registered", "Wallet", "Status", "Actions"]}>
          {data.voters.map((v) => (
            <tr key={v._id} data-testid="voter-row"><td className="td font-medium text-navy-900">{v.name}</td><td className="td">{v.email}</td><td className="td font-mono text-xs">{v.voterId}</td>
              <td className="td text-slate-500">{fmtDate(v.createdAt)}</td>
              <td className="td font-mono text-xs">{v.walletAddress ? `${v.walletAddress.slice(0, 8)}...${v.walletAddress.slice(-4)}` : <span className="text-slate-400">none</span>}</td>
              <td className="td"><StatusBadge status={v.approvalStatus} /></td>
              <td className="td"><div className="flex flex-wrap gap-1.5">
                {v.approvalStatus !== "approved" && <button className="btn-success btn-sm" disabled={!!busy} onClick={() => act(v._id, "approve")} data-testid="approve-voter"><Check className="h-3.5 w-3.5" /> Approve</button>}
                {v.approvalStatus !== "rejected" && <button className="btn-danger btn-sm" disabled={!!busy} onClick={() => act(v._id, "reject")}><X className="h-3.5 w-3.5" /> Reject</button>}
                {v.walletAddress && <button className="btn-outline btn-sm" disabled={!!busy} onClick={() => act(v._id, "reset-wallet")} title="Unlink wallet"><Unlink className="h-3.5 w-3.5" /></button>}
              </div></td></tr>))}
        </Table>)}
    </>
  );
}
