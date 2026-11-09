import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { useFetch } from "../../hooks/useFetch";
import { Alert, PageHeader, Spinner } from "../../components/ui";
import { palette } from "../../utils/format";

export default function Analytics() {
  const { data: s, loading, error } = useFetch("/admin/stats");
  if (loading) return <Spinner />;
  if (error) return <Alert type="error">{error}</Alert>;
  const part = s.participation.map((p) => ({ name: p.electionName, votes: p.totalVotes ?? 0, candidates: p.approvedCandidates }));
  const funnel = [{ name: "Approved", value: s.voters.approved }, { name: "Pending", value: s.voters.pending }, { name: "Rejected", value: Math.max(0, s.voters.total - s.voters.approved - s.voters.pending) }].filter((d) => d.value > 0);
  return (
    <>
      <PageHeader title="Election analytics" subtitle="Participation counts are read from the smart contract. Per-candidate tallies stay hidden until an election ends." />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card"><h3 className="mb-4 font-semibold text-navy-900">Votes cast per election (on-chain)</h3>
          <div className="h-72">{part.length === 0 ? <p className="grid h-full place-items-center text-sm text-slate-400">No elections yet</p> :
            <ResponsiveContainer><BarChart data={part}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} /><Tooltip /><Legend />
              <Bar dataKey="votes" name="Votes cast" fill="#7c3aed" radius={[6, 6, 0, 0]} /><Bar dataKey="candidates" name="Candidates" fill="#243469" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>}</div></div>
        <div className="card"><h3 className="mb-4 font-semibold text-navy-900">Voter registrations</h3>
          <div className="h-72">{funnel.length === 0 ? <p className="grid h-full place-items-center text-sm text-slate-400">No voters yet</p> :
            <ResponsiveContainer><PieChart><Pie data={funnel} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>{funnel.map((_, i) => <Cell key={i} fill={palette[i]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>}</div></div>
      </div>
    </>
  );
}
