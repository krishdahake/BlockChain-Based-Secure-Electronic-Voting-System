import { useEffect, useState } from "react";
import api, { errMsg } from "../../services/api";
import { Alert, EmptyState, PageHeader, Spinner } from "../../components/ui";
import TxTable from "../../components/TxTable";

export default function Transactions() {
  const [rows, setRows] = useState(null); const [error, setError] = useState(""); const [contract, setContract] = useState("");
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/elections");
        const all = await Promise.all(data.elections.map(async (e) => {
          const r = await api.get(`/voting/transactions/${e._id}`);
          setContract(r.data.contractAddress);
          return r.data.transactions.map((t) => ({ ...t, electionName: e.electionName }));
        }));
        setRows(all.flat().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      } catch (err) { setError(errMsg(err)); }
    })();
  }, []);
  if (error) return <Alert type="error">{error}</Alert>;
  if (!rows) return <Spinner />;
  return (
    <>
      <PageHeader title="Transaction history" subtitle={contract ? `Voting contract: ${contract}` : undefined} />
      {rows.length === 0 ? <EmptyState title="No transactions yet" text="Your vote transactions will appear here once you vote." /> : <TxTable rows={rows} />}
    </>
  );
}
