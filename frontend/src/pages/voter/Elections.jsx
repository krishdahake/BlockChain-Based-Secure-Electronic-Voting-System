import { Link } from "react-router-dom";
import { Calendar, Users } from "lucide-react";
import { useFetch } from "../../hooks/useFetch";
import { Alert, EmptyState, PageHeader, Spinner, StatusBadge } from "../../components/ui";
import { fmtDate } from "../../utils/format";

export default function Elections() {
  const { data, loading, error } = useFetch("/elections");
  return (
    <>
      <PageHeader title="Available elections" subtitle="Open an election to see its candidates and vote." />
      <Alert type="error">{error}</Alert>
      {loading ? <Spinner /> : !data?.elections.length ? <EmptyState title="No elections yet" text="Check back when an administrator publishes one." /> : (
        <div className="grid gap-5 md:grid-cols-2">
          {data.elections.map((e) => (
            <div key={e._id} className="card flex flex-col transition hover:-translate-y-0.5 hover:shadow-md" data-testid="election-card">
              <div className="flex items-start justify-between gap-3"><h3 className="text-lg font-bold text-navy-900">{e.electionName}</h3><StatusBadge status={e.phase} /></div>
              <p className="mt-2 line-clamp-2 flex-1 text-sm text-slate-500">{e.description || "No description."}</p>
              <div className="mt-4 space-y-1.5 text-xs text-slate-500">
                <p className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5" /> {fmtDate(e.startDate)} → {fmtDate(e.endDate)}</p>
                <p className="flex items-center gap-2"><Users className="h-3.5 w-3.5" /> {e.approvedCandidates} candidate(s) · {e.totalVotes ?? "?"} vote(s) cast</p>
              </div>
              <Link to={`/voter/elections/${e._id}`} className="btn-navy mt-4">{e.phase === "live" ? "View & vote" : e.phase === "ended" ? "View details" : "View candidates"}</Link>
            </div>))}
        </div>)}
    </>
  );
}
