import { useSearchParams } from "react-router-dom";
import { useFetch } from "../../hooks/useFetch";
import { Alert, EmptyState, PageHeader, Spinner } from "../../components/ui";
import ResultsView from "../../components/ResultsView";

export default function Results({ admin = false }) {
  const [params, setParams] = useSearchParams();
  const { data, loading, error } = useFetch("/elections");
  const ended = (data?.elections || []).filter((e) => e.phase === "ended");
  const selected = params.get("election") || ended[0]?._id;
  return (
    <>
      <PageHeader title={admin ? "Results management" : "Election results"} subtitle="Results are available after an election ends and are read directly from the smart contract."
        action={ended.length > 0 && <select className="input !w-auto" value={selected} onChange={(e) => setParams({ election: e.target.value })} aria-label="Election">{ended.map((e) => <option key={e._id} value={e._id}>{e.electionName}</option>)}</select>} />
      <Alert type="error">{error}</Alert>
      {loading ? <Spinner /> : ended.length === 0 ? <EmptyState title="No completed elections" text="Results appear here once an election's end time has passed." /> : <ResultsView key={selected} electionId={selected} />}
    </>
  );
}
