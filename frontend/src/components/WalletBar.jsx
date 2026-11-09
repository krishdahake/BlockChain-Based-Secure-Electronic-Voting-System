import { Wallet, LogOut, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useWallet } from "../hooks/useWallet";
import { useAuth } from "../hooks/useAuth";
import { shortAddr, chainName, CHAIN_ID } from "../services/blockchain";

/** Compact wallet status / connect control shown in the voter top bar. */
export default function WalletBar() {
  const w = useWallet();
  const { user } = useAuth();
  const linked = user?.walletAddress;
  const mismatch = w.address && linked && w.address !== linked;

  if (!w.address) {
    return (
      <button onClick={w.connect} disabled={w.connecting} className="btn-primary btn-sm" data-testid="connect-wallet">
        <Wallet className="h-4 w-4" /> {w.connecting ? "Connecting..." : "Connect MetaMask"}
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!w.networkOk && (
        <button onClick={w.switchNetwork} className="btn btn-sm bg-amber-100 text-amber-900 hover:bg-amber-200" data-testid="switch-network">
          <AlertTriangle className="h-4 w-4" /> Switch to {chainName(CHAIN_ID)}
        </button>
      )}
      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${mismatch ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`} title={w.address} data-testid="wallet-address">
        {mismatch ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        {shortAddr(w.address)}{mismatch && " (not your linked wallet)"}
      </span>
      <button onClick={w.disconnect} className="btn-outline btn-sm" title="Disconnect wallet from this app" data-testid="disconnect-wallet">
        <LogOut className="h-4 w-4" /> Disconnect
      </button>
    </div>
  );
}
