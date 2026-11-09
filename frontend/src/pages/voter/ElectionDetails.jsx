import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, Circle, ExternalLink, Loader2, Vote, ChevronDown } from "lucide-react";
import api, { assetUrl, errMsg } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { useWallet } from "../../hooks/useWallet";
import { Alert, Avatar, ConfirmModal, PageHeader, Spinner, StatusBadge } from "../../components/ui";
import { fmtDate } from "../../utils/format";
import { chainName, CHAIN_ID, explorerTxUrl, getBrowserProvider, getVotingContract, txError } from "../../services/blockchain";

const Check = ({ ok, children }) => (
  <li className={`flex items-center gap-2 text-sm ${ok ? "text-emerald-700" : "text-slate-500"}`}>{ok ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}{children}</li>
);

export default function ElectionDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const w = useWallet();
  const [election, setElection] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [vote, setVote] = useState({ step: "idle", hash: "", error: "", warning: "" }); // idle | signing | pending | confirmed

  const load = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([api.get(`/elections/${id}`), api.get(`/voting/status/${id}`)]);
      setElection(d.data.election); setCandidates(d.data.candidates); setStatus(s.data);
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const castVote = async () => {
    setConfirm(false);
    setVote({ step: "signing", hash: "", error: "", warning: "" });
    try {
      const signer = await getBrowserProvider().getSigner(w.address);
      const contract = await getVotingContract(signer);
      const cand = candidates.find((c) => c._id === selected);
      const localGasOptions = CHAIN_ID === 31337
        ? { gasLimit: 500000, maxFeePerGas: 20000000000n, maxPriorityFeePerGas: 0n }
        : { gasLimit: 500000 };
      const tx = await contract.vote(election.blockchainElectionId, cand.blockchainCandidateId, localGasOptions); // MetaMask popup
      setVote({ step: "pending", hash: tx.hash, error: "", warning: "" });
      try { await api.post("/voting/record", { electionId: id, transactionHash: tx.hash }); } catch { /* reconciled below / by event listener */ }
      const receipt = await tx.wait();
      if (receipt.status !== 1) throw new Error("Transaction reverted on-chain");
      let warning = "";
      try { await api.post("/voting/record", { electionId: id, transactionHash: tx.hash }); }
      catch (e) { warning = "Your vote is confirmed on-chain, but the server could not record it yet (" + errMsg(e) + "). It will be reconciled automatically."; }
      setVote({ step: "confirmed", hash: tx.hash, error: "", warning });
      load();
    } catch (e) {
      setVote((v) => ({ ...v, step: "idle", error: e?.response ? errMsg(e) : txError(e) }));
    }
  };

  if (loading) return <Spinner />;
  if (error) return <Alert type="error">{error}</Alert>;

  const sameWallet = w.address && status.walletAddress && w.address === status.walletAddress;
  const phase = election.phase;
  const ready = status.walletLinked && w.address && sameWallet && w.networkOk && status.registeredOnChain && status.canVote;
  const cand = candidates.find((c) => c._id === selected);
  const confirmedHash = vote.hash || status.transaction?.transactionHash;

  return (
    <>
      <Link to="/voter/elections" className="mb-3 inline-block text-sm font-medium text-brand-700">← All elections</Link>
      <PageHeader title={election.electionName} subtitle={`${fmtDate(election.startDate)} → ${fmtDate(election.endDate)}`} action={<StatusBadge status={phase} />} />
      <p className="mb-6 max-w-3xl text-slate-600">{election.description || "No description provided."}</p>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <h2 className="text-lg font-bold text-navy-900">Candidates ({candidates.length})</h2>
          {candidates.length === 0 && <Alert type="info">No candidates have been approved for this election yet.</Alert>}
          {candidates.map((c) => {
            const isSel = selected === c._id;
            return (
              <div key={c._id} data-testid="candidate-card" className={`card transition ${isSel ? "ring-2 ring-brand-500" : ""}`}>
                <div className="flex items-center gap-4">
                  <Avatar src={assetUrl(c.profileImage)} name={c.candidateName} size="h-14 w-14" />
                  <div className="min-w-0 flex-1"><h3 className="font-semibold text-navy-900">{c.candidateName}</h3><p className="text-sm text-brand-700">{c.partyName}</p></div>
                  {phase === "live" && status.canVote && vote.step !== "confirmed" && (
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50">
                      <input type="radio" name="candidate" className="accent-brand-600" checked={isSel} onChange={() => setSelected(c._id)} data-testid={`select-${c.blockchainCandidateId}`} /> Select
                    </label>)}
                </div>
                <button className="mt-3 flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-navy-900" onClick={() => setExpanded(expanded === c._id ? null : c._id)}>
                  Manifesto <ChevronDown className={`h-4 w-4 transition ${expanded === c._id ? "rotate-180" : ""}`} /></button>
                {expanded === c._id && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{c.manifesto}</p>}
              </div>);
          })}
        </div>

        <div className="space-y-4">
          <div className="card" data-testid="vote-panel">
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-navy-900"><Vote className="h-5 w-5 text-brand-600" /> Cast your vote</h3>
            <ul className="mb-4 space-y-2">
              <Check ok={user.isApproved}>Account approved</Check>
              <Check ok={status.walletLinked}>Wallet verified &amp; linked</Check>
              <Check ok={!!w.address && sameWallet}>MetaMask connected with linked account</Check>
              <Check ok={w.networkOk}>Network: {chainName(CHAIN_ID)}</Check>
              <Check ok={status.registeredOnChain}>Authorised on the contract</Check>
              <Check ok={phase === "live" && status.electionActive}>Election is open</Check>
              <Check ok={!status.hasVoted}>Not voted yet</Check>
            </ul>
            {phase === "upcoming" && <Alert type="info">Voting opens {fmtDate(election.startDate)}.</Alert>}
            {phase === "ended" && <Alert type="info">This election has ended.</Alert>}
            {!status.walletLinked && <Alert type="warn">Link your wallet on the <Link className="font-semibold underline" to="/voter">overview page</Link> first.</Alert>}
            {status.walletLinked && !w.address && <button className="btn-primary w-full" onClick={w.connect}>Connect MetaMask</button>}
            {w.address && !sameWallet && status.walletLinked && <Alert type="warn">Switch MetaMask to your linked account ({status.walletAddress.slice(0, 8)}...).</Alert>}
            {w.address && !w.networkOk && <button className="btn-outline w-full" onClick={w.switchNetwork}>Switch to {chainName(CHAIN_ID)}</button>}

            {(status.hasVoted || vote.step === "confirmed") && (
              <Alert type="success" className="mt-3"><b>Your vote has been recorded.</b> Thank you for voting.</Alert>)}
            {vote.step === "signing" && <Alert type="info" className="mt-3"><span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Confirm the transaction in MetaMask...</span></Alert>}
            {vote.step === "pending" && <Alert type="info" className="mt-3"><span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Transaction submitted. Waiting for confirmation...</span></Alert>}
            <Alert type="error" className="mt-3">{vote.error}</Alert>
            <Alert type="warn" className="mt-3">{vote.warning}</Alert>

            {confirmedHash && (
              <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs" data-testid="tx-box">
                <p className="text-slate-500">Transaction hash</p>
                <p className="break-all font-mono text-navy-900" data-testid="tx-hash">{confirmedHash}</p>
                <p className="mt-1 text-slate-500">Status: <b data-testid="tx-status" className={vote.step === "pending" ? "text-amber-700" : "text-emerald-700"}>{vote.step === "pending" ? "Pending" : (status.transaction?.transactionStatus || "confirmed")}</b></p>
                {explorerTxUrl(confirmedHash) && <a className="mt-1 inline-flex items-center gap-1 font-semibold text-brand-700" target="_blank" rel="noreferrer" href={explorerTxUrl(confirmedHash)}>View on Etherscan <ExternalLink className="h-3 w-3" /></a>}
              </div>)}

            {phase === "live" && !status.hasVoted && vote.step !== "confirmed" && (
              <button className="btn-primary mt-4 w-full" disabled={!ready || !selected || vote.step !== "idle"} onClick={() => setConfirm(true)} data-testid="cast-vote">
                <Vote className="h-4 w-4" /> Cast Vote</button>)}
            {phase === "live" && ready && !selected && <p className="mt-2 text-center text-xs text-slate-400">Select a candidate first.</p>}
          </div>
          {phase === "ended" && <Link to={`/voter/results?election=${id}`} className="btn-navy w-full">View results</Link>}
          <p className="px-1 text-xs text-slate-400">Votes are public on-chain: your wallet address and chosen candidate number are visible to anyone. This is not an anonymous ballot.</p>
        </div>
      </div>

      <ConfirmModal open={confirm} title="Confirm your vote" confirmLabel="Continue to MetaMask"
        text={`You are voting for ${cand?.candidateName} (${cand?.partyName}). This is recorded on the blockchain and cannot be changed or undone.`}
        onConfirm={castVote} onCancel={() => setConfirm(false)} />
    </>
  );
}
