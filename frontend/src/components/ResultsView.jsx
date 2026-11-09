import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { Trophy, Users, Percent, Link2 } from "lucide-react";
import { useFetch } from "../hooks/useFetch";
import { Alert, Spinner, StatCard, Avatar, Table } from "./ui";
import { assetUrl } from "../services/api";
import { palette, fmtDate } from "../utils/format";

/** Election results exactly as returned by the smart contract. */
export default function ResultsView({ electionId }) {
  const { data, loading, error } = useFetch(`/results/${electionId}`);
  if (loading) return <Spinner label="Reading results from the blockchain..." />;
  if (error) return <Alert type="error">{error}</Alert>;
  const { candidates, winners, totalVotes, election, turnoutPercentage, eligibleVoters, isTie, contractAddress } = data;
  const chartData = candidates.map((c) => ({ name: c.candidateName, votes: c.votes }));

  return (
    <div className="space-y-6" data-testid="results-view">
      <div className="card bg-gradient-to-br from-navy-900 to-navy-700 text-white">
        <p className="text-xs uppercase tracking-wider text-brand-200">{election.electionName} · ended {fmtDate(election.endDate)}</p>
        <div className="mt-2 flex items-center gap-3">
          <Trophy className="h-8 w-8 text-amber-300" />
          <h2 className="text-2xl font-bold" data-testid="winner">{totalVotes === 0 ? "No votes were cast" : isTie ? `Tie: ${winners.join(" & ")}` : `Winner: ${winners[0]}`}</h2>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Users} label="Total votes" value={totalVotes} tone="brand" />
        <StatCard icon={Percent} label="Turnout" value={`${turnoutPercentage}%`} hint={`of ${eligibleVoters} eligible wallets`} tone="green" />
        <StatCard icon={Link2} label="Candidates" value={candidates.length} tone="navy" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card"><h3 className="mb-4 font-semibold text-navy-900">Votes per candidate</h3>
          <div className="h-72"><ResponsiveContainer><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="votes" radius={[6, 6, 0, 0]}>{chartData.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}</Bar></BarChart></ResponsiveContainer></div></div>
        <div className="card"><h3 className="mb-4 font-semibold text-navy-900">Vote share</h3>
          <div className="h-72">{totalVotes === 0 ? <p className="grid h-full place-items-center text-sm text-slate-400">No votes to display</p> :
            <ResponsiveContainer><PieChart><Pie data={chartData.filter((d) => d.votes > 0)} dataKey="votes" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>{chartData.filter((d) => d.votes > 0).map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>}</div></div>
      </div>
      <Table heads={["#", "Candidate", "Party", "Votes", "Share"]}>
        {[...candidates].sort((a, b) => b.votes - a.votes).map((c, i) => (
          <tr key={c.blockchainCandidateId} data-testid="result-row"><td className="td">{i + 1}</td>
            <td className="td"><div className="flex items-center gap-3"><Avatar src={assetUrl(c.profileImage)} name={c.candidateName} size="h-8 w-8" /><span className="font-medium">{c.candidateName}</span></div></td>
            <td className="td text-slate-500">{c.partyName || "-"}</td><td className="td font-semibold">{c.votes}</td>
            <td className="td"><div className="flex items-center gap-2"><div className="h-2 w-24 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-600" style={{ width: `${c.percentage}%` }} /></div>{c.percentage}%</div></td></tr>
        ))}
      </Table>
      <p className="text-xs text-slate-400">Source: smart contract <span className="font-mono">{contractAddress}</span> (read live; nothing is cached in the database).</p>
    </div>
  );
}
