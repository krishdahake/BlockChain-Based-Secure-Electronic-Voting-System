import { Link } from "react-router-dom";
import { Vote, CalendarClock, CheckCircle2, Clock } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useFetch } from "../../hooks/useFetch";
import { Alert, PageHeader, Spinner, StatCard, StatusBadge } from "../../components/ui";
import WalletLinkCard from "../../components/WalletLinkCard";
import { fmtDate } from "../../utils/format";

export default function VoterOverview() {
  const { user } = useAuth();
  const { data, loading } = useFetch("/elections", { skip: !user.isApproved });
  const elections = data?.elections || [];
  const live = elections.filter((e) => e.phase === "live");

  return (
    <>
      <PageHeader title={`Hello, ${user.name.split(" ")[0]}`} subtitle="Your voter dashboard" />
      {user.approvalStatus === "pending" && <Alert type="warn" className="mb-6">Your registration is awaiting administrator approval. You will be able to link your wallet and vote once approved.</Alert>}
      {user.approvalStatus === "rejected" && <Alert type="error" className="mb-6">Your registration was rejected by an administrator. Please contact support.</Alert>}
      {user.isApproved && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={Vote} label="Live elections" value={loading ? "..." : live.length} tone="green" />
            <StatCard icon={CalendarClock} label="Upcoming" value={loading ? "..." : elections.filter((e) => e.phase === "upcoming").length} tone="brand" />
            <StatCard icon={user.walletAddress ? CheckCircle2 : Clock} label="Wallet" value={user.walletAddress ? "Verified" : "Not linked"} tone={user.walletAddress ? "green" : "amber"} />
          </div>
          <WalletLinkCard />
          <div className="card">
            <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold text-navy-900">Elections</h3><Link to="/voter/elections" className="text-sm font-semibold text-brand-700">View all</Link></div>
            {loading ? <Spinner /> : elections.length === 0 ? <p className="text-sm text-slate-500">No elections are available yet.</p> : (
              <ul className="divide-y divide-slate-100">
                {elections.slice(0, 5).map((e) => (
                  <li key={e._id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div><Link to={`/voter/elections/${e._id}`} className="font-medium text-navy-900 hover:text-brand-700">{e.electionName}</Link><p className="text-xs text-slate-500">{fmtDate(e.startDate)} → {fmtDate(e.endDate)}</p></div>
                    <StatusBadge status={e.phase} />
                  </li>))}
              </ul>)}
          </div>
        </div>
      )}
    </>
  );
}
