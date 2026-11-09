import { useFetch } from "../../hooks/useFetch";
import { Alert, EmptyState, PageHeader, Spinner, StatusBadge } from "../../components/ui";
import { fmtDate } from "../../utils/format";

export default function ElectionInfo() {
  const { data, loading, error } = useFetch("/elections");
  return (
    <>
      <PageHeader title="Election information" />
      <Alert type="error">{error}</Alert>
      {loading ? <Spinner /> : !data?.elections.length ? <EmptyState title="No elections yet" /> : (
        <div className="grid gap-4 md:grid-cols-2">{data.elections.map((e) => (
          <div key={e._id} className="card"><div className="flex justify-between gap-2"><h3 className="font-semibold text-navy-900">{e.electionName}</h3><StatusBadge status={e.phase} /></div>
            <p className="mt-2 text-sm text-slate-500">{e.description || "No description."}</p>
            <p className="mt-3 text-xs text-slate-500">{fmtDate(e.startDate)} → {fmtDate(e.endDate)}</p><p className="text-xs text-slate-500">{e.approvedCandidates} approved candidate(s)</p></div>))}</div>)}
    </>
  );
}
