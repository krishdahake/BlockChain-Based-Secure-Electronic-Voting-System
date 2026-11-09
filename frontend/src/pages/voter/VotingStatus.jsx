import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { errMsg } from "../../services/api";
import { Alert, EmptyState, PageHeader, Spinner, StatusBadge, Table } from "../../components/ui";
import { fmtDate } from "../../utils/format";

export default function VotingStatus() {
  const [rows, setRows] = useState(null); const [error, setError] = useState("");
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/elections");
        const out = await Promise.all(data.elections.map(async (e) => {
          try { return { e, s: (await api.get(`/voting/status/${e._id}`)).data }; } catch { return { e, s: null }; }
        }));
        setRows(out);
      } catch (err) { setError(errMsg(err)); }
    })();
  }, []);
  if (error) return <Alert type="error">{error}</Alert>;
  if (!rows) return <Spinner />;
  return (
    <>
      <PageHeader title="My voting status" subtitle="Read from the smart contract for your verified wallet." />
      {rows.length === 0 ? <EmptyState title="No elections" /> : (
        <Table heads={["Election", "Period", "Phase", "My status", ""]}>
          {rows.map(({ e, s }) => (
            <tr key={e._id}><td className="td font-medium text-navy-900">{e.electionName}</td><td className="td text-slate-500">{fmtDate(e.startDate)}<br />{fmtDate(e.endDate)}</td>
              <td className="td"><StatusBadge status={e.phase} /></td>
              <td className="td" data-testid="my-status">{!s ? "-" : s.hasVoted ? <StatusBadge status="confirmed">Voted</StatusBadge> : !s.walletLinked ? <span className="text-amber-700">Wallet not linked</span> : e.phase === "ended" ? <span className="text-slate-500">Did not vote</span> : s.canVote ? <span className="font-semibold text-emerald-700">Eligible - not voted</span> : <span className="text-slate-500">{s.registeredOnChain ? "Not open" : "Not authorised"}</span>}</td>
              <td className="td"><Link className="font-semibold text-brand-700" to={`/voter/elections/${e._id}`}>Open</Link></td></tr>))}
        </Table>)}
    </>
  );
}
