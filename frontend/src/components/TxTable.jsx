import { ExternalLink } from "lucide-react";
import { StatusBadge, Table } from "./ui";
import { explorerTxUrl } from "../services/blockchain";
import { fmtDate } from "../utils/format";

export default function TxTable({ rows, admin = false }) {
  const heads = admin ? ["Time", "Election", "Voter", "Wallet", "Tx hash", "Block", "Status"] : ["Time", "Election", "Tx hash", "Block", "Status"];
  return (
    <Table heads={heads}>
      {rows.map((t) => (
        <tr key={t._id} data-testid="tx-row">
          <td className="td whitespace-nowrap text-slate-500">{fmtDate(t.createdAt)}</td>
          <td className="td">{t.electionName || t.electionId?.electionName || "-"}</td>
          {admin && <td className="td">{t.voterId?.name || "-"}<br /><span className="text-xs text-slate-400">{t.voterId?.voterId}</span></td>}
          {admin && <td className="td font-mono text-xs">{t.walletAddress.slice(0, 8)}...{t.walletAddress.slice(-4)}</td>}
          <td className="td font-mono text-xs"><span title={t.transactionHash}>{t.transactionHash.slice(0, 12)}...{t.transactionHash.slice(-6)}</span>
            {explorerTxUrl(t.transactionHash) && <a className="ml-1 inline-block text-brand-700" target="_blank" rel="noreferrer" href={explorerTxUrl(t.transactionHash)}><ExternalLink className="inline h-3 w-3" /></a>}</td>
          <td className="td">{t.blockNumber ?? "-"}</td>
          <td className="td"><StatusBadge status={t.transactionStatus} /></td>
        </tr>))}
    </Table>
  );
}
