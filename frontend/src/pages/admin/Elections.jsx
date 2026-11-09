import { useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import api, { errMsg } from "../../services/api";
import { useFetch } from "../../hooks/useFetch";
import { Alert, ConfirmModal, EmptyState, PageHeader, Spinner, StatusBadge, Table } from "../../components/ui";
import { fmtDate } from "../../utils/format";

export default function Elections() {
  const { data, loading, error, reload } = useFetch("/elections");
  const [msg, setMsg] = useState({ type: "", text: "" }); const [busy, setBusy] = useState(""); const [del, setDel] = useState(null);

  const toggle = async (e) => {
    setBusy(e._id); setMsg({ type: "", text: "" });
    try { await api.patch(`/elections/${e._id}`, { status: e.status === "active" ? "inactive" : "active" }); reload(); }
    catch (er) { setMsg({ type: "error", text: errMsg(er) }); } finally { setBusy(""); }
  };
  const remove = async () => {
    setBusy(del._id);
    try { const { data: d } = await api.delete(`/elections/${del._id}`); setMsg({ type: "success", text: d.message }); setDel(null); reload(); }
    catch (er) { setMsg({ type: "error", text: errMsg(er) }); setDel(null); } finally { setBusy(""); }
  };

  return (
    <>
      <PageHeader title="Manage elections" subtitle="Activate or deactivate elections, edit upcoming ones, and monitor participation." action={<Link to="/admin/elections/new" className="btn-primary"><Plus className="h-4 w-4" /> Create election</Link>} />
      <Alert type={msg.type || "info"} className="mb-4">{msg.text}</Alert><Alert type="error" className="mb-4">{error}</Alert>
      {loading ? <Spinner /> : !data?.elections.length ? <EmptyState title="No elections yet" action={<Link to="/admin/elections/new" className="btn-primary">Create the first one</Link>} /> : (
        <Table heads={["Election", "Schedule", "Phase", "Switch", "Candidates", "Votes", "On-chain ID", "Actions"]}>
          {data.elections.map((e) => (
            <tr key={e._id} data-testid="election-row"><td className="td font-medium text-navy-900">{e.electionName}</td>
              <td className="td whitespace-nowrap text-slate-500">{fmtDate(e.startDate)}<br />{fmtDate(e.endDate)}</td>
              <td className="td"><StatusBadge status={e.phase} /></td><td className="td"><StatusBadge status={e.status} /></td>
              <td className="td">{e.approvedCandidates}</td><td className="td font-semibold">{e.totalVotes ?? "?"}</td><td className="td">#{e.blockchainElectionId}</td>
              <td className="td"><div className="flex gap-1.5">
                <button className="btn-outline btn-sm" disabled={!!busy} onClick={() => toggle(e)} title={e.status === "active" ? "Deactivate" : "Activate"} data-testid="toggle-election"><Power className="h-3.5 w-3.5" /></button>
                {e.phase === "upcoming" && <Link to={`/admin/elections/${e._id}/edit`} className="btn-outline btn-sm" title="Edit"><Pencil className="h-3.5 w-3.5" /></Link>}
                {e.phase === "upcoming" && <button className="btn-outline btn-sm text-red-600" disabled={!!busy} onClick={() => setDel(e)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>}
              </div></td></tr>))}
        </Table>)}
      <ConfirmModal open={!!del} tone="danger" title="Delete election?" confirmLabel="Delete" busy={!!busy} onConfirm={remove} onCancel={() => setDel(null)}
        text={`"${del?.electionName}" and its candidate applications will be removed. The on-chain election is permanently deactivated (blockchains are immutable).`} />
    </>
  );
}
