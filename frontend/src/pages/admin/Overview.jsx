import { Link } from "react-router-dom";
import { Users, UserCheck, ClipboardList, Vote, Link2, CalendarClock } from "lucide-react";
import { useFetch } from "../../hooks/useFetch";
import { Alert, PageHeader, Spinner, StatCard } from "../../components/ui";

export default function AdminOverview() {
  const { data: s, loading, error } = useFetch("/admin/stats");
  if (loading) return <Spinner />;
  if (error) return <Alert type="error">{error}</Alert>;
  return (
    <>
      <PageHeader title="Admin overview" subtitle="Platform activity at a glance" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={Users} label="Registered voters" value={s.voters.total} tone="navy" hint={`${s.voters.approved} approved · ${s.voters.walletLinked} wallets linked`} />
        <StatCard icon={UserCheck} label="Pending voter approvals" value={s.voters.pending} tone="amber" />
        <StatCard icon={ClipboardList} label="Pending candidate approvals" value={s.candidates.pending} tone="amber" hint={`${s.candidates.approved} approved`} />
        <StatCard icon={Vote} label="Live elections" value={s.elections.live} tone="green" hint={`${s.elections.upcoming} upcoming · ${s.elections.ended} ended`} />
        <StatCard icon={CalendarClock} label="Total elections" value={s.elections.total} tone="brand" />
        <StatCard icon={Link2} label="Confirmed vote transactions" value={s.confirmedVoteTransactions} tone="brand" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card"><h3 className="mb-3 font-semibold text-navy-900">Needs attention</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><span>Voter registrations awaiting review</span><Link className="font-semibold text-brand-700" to="/admin/voters/pending">{s.voters.pending} →</Link></li>
            <li className="flex justify-between"><span>Candidate applications awaiting review</span><Link className="font-semibold text-brand-700" to="/admin/candidates">{s.candidates.pending} →</Link></li>
            <li className="flex justify-between"><span>Create a new election</span><Link className="font-semibold text-brand-700" to="/admin/elections/new">Create →</Link></li>
          </ul></div>
        <div className="card"><h3 className="mb-3 font-semibold text-navy-900">Smart contract</h3>
          <p className="text-sm text-slate-500">Address</p><p className="break-all font-mono text-xs text-navy-900">{s.contractAddress}</p></div>
      </div>
    </>
  );
}
