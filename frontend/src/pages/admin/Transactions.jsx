import { useFetch } from "../../hooks/useFetch";
import { Alert, EmptyState, PageHeader, Spinner } from "../../components/ui";
import TxTable from "../../components/TxTable";

export default function AdminTransactions() {
  const { data, loading, error } = useFetch("/admin/transactions");
  return (
    <>
      <PageHeader title="Blockchain transactions" subtitle={data ? `Voting contract: ${data.contractAddress}` : undefined} />
      <Alert type="error">{error}</Alert>
      {loading ? <Spinner /> : !data?.transactions.length ? <EmptyState title="No vote transactions recorded yet" /> : <TxTable rows={data.transactions} admin />}
      <p className="mt-4 text-xs text-slate-400">These are references to on-chain transactions. The contract remains the authoritative record; the candidate chosen is deliberately not stored here.</p>
    </>
  );
}
