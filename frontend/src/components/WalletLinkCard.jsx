import { useState } from "react";
import { Wallet, ShieldCheck, Loader2, ExternalLink } from "lucide-react";
import { useWallet } from "../hooks/useWallet";
import { useAuth } from "../hooks/useAuth";
import { errMsg } from "../services/api";
import { Alert } from "./ui";
import { shortAddr, txError } from "../services/blockchain";

/** Walks the voter through: connect MetaMask -> sign server nonce -> wallet linked to account. */
export default function WalletLinkCard() {
  const w = useWallet();
  const { user, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const linked = user?.walletAddress;

  const verify = async () => {
    setBusy(true); setMsg({ type: "", text: "" });
    try {
      await w.verifyOwnership();
      await refresh();
      setMsg({ type: "success", text: "Wallet ownership verified and linked to your account." });
    } catch (e) {
      setMsg({ type: "error", text: e?.response ? errMsg(e) : txError(e) });
    } finally { setBusy(false); }
  };

  return (
    <div className="card" data-testid="wallet-card">
      <div className="flex items-start gap-4">
        <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${linked ? "bg-emerald-100 text-emerald-700" : "bg-brand-100 text-brand-700"}`}>{linked ? <ShieldCheck className="h-6 w-6" /> : <Wallet className="h-6 w-6" />}</div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-navy-900">Wallet</h3>
          {linked ? (
            <p className="text-sm text-slate-600">Verified wallet: <span className="break-all font-mono text-xs" data-testid="linked-wallet">{linked}</span></p>
          ) : (
            <p className="text-sm text-slate-500">Connect MetaMask and sign a free message to prove you own your wallet. Connecting alone does not authenticate you.</p>
          )}
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {!w.installed && <Alert type="warn">MetaMask was not detected in this browser. <a className="inline-flex items-center gap-1 font-semibold underline" href="https://metamask.io/download/" target="_blank" rel="noreferrer">Install it <ExternalLink className="h-3 w-3" /></a></Alert>}
        <Alert type="error">{w.error}</Alert>
        <Alert type={msg.type || "info"}>{msg.text}</Alert>
        {!linked && w.installed && (
          !w.address ? (
            <button className="btn-primary" onClick={w.connect} disabled={w.connecting} data-testid="connect-wallet-card">{w.connecting && <Loader2 className="h-4 w-4 animate-spin" />} Connect MetaMask</button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-600">Connected: <span className="font-mono text-xs">{shortAddr(w.address)}</span></p>
              <button className="btn-primary" onClick={verify} disabled={busy} data-testid="verify-wallet">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Verify wallet ownership (sign message)</button>
            </div>
          )
        )}
        {linked && w.address && w.address !== linked && <Alert type="warn">Your MetaMask is on a different account ({shortAddr(w.address)}). Switch back to {shortAddr(linked)} to vote.</Alert>}
      </div>
    </div>
  );
}
