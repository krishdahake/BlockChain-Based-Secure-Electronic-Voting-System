import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { hasMetaMask, getBrowserProvider, CHAIN_ID, CHAINS } from "../services/blockchain";
import api from "../services/api";

export const WalletContext = createContext(null);
const DISCONNECTED_KEY = "wallet:disconnected";

export function WalletProvider({ children }) {
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const installed = hasMetaMask();

  const readChain = useCallback(async () => {
    if (!installed) return;
    const hex = await window.ethereum.request({ method: "eth_chainId" });
    setChainId(parseInt(hex, 16));
  }, [installed]);

  // Restore an existing, previously approved connection silently (no popup).
  useEffect(() => {
    if (!installed) return;
    (async () => {
      try {
        await readChain();
        if (localStorage.getItem(DISCONNECTED_KEY) === "1") return;
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        if (accounts[0]) setAddress(accounts[0].toLowerCase());
      } catch { /* ignore */ }
    })();
  }, [installed, readChain]);

  // Detect account + network changes.
  useEffect(() => {
    if (!installed) return;
    const onAccounts = (accounts) => {
      if (localStorage.getItem(DISCONNECTED_KEY) === "1") return;
      setAddress(accounts[0] ? accounts[0].toLowerCase() : null);
    };
    const onChain = (hex) => setChainId(parseInt(hex, 16));
    window.ethereum.on?.("accountsChanged", onAccounts);
    window.ethereum.on?.("chainChanged", onChain);
    return () => {
      window.ethereum.removeListener?.("accountsChanged", onAccounts);
      window.ethereum.removeListener?.("chainChanged", onChain);
    };
  }, [installed]);

  const connect = useCallback(async () => {
    setError("");
    if (!installed) { setError("MetaMask is not installed. Install it from metamask.io."); return null; }
    setConnecting(true);
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      localStorage.removeItem(DISCONNECTED_KEY);
      setAddress(accounts[0].toLowerCase());
      await readChain();
      return accounts[0].toLowerCase();
    } catch (e) {
      setError(e?.code === 4001 ? "Connection request was rejected." : e?.message || "Could not connect to MetaMask");
      return null;
    } finally {
      setConnecting(false);
    }
  }, [installed, readChain]);

  /** App-level disconnect. (MetaMask has no programmatic disconnect; we also try to revoke the permission.) */
  const disconnect = useCallback(async () => {
    localStorage.setItem(DISCONNECTED_KEY, "1");
    setAddress(null);
    try {
      await window.ethereum?.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] });
    } catch { /* older MetaMask versions: ignore */ }
  }, []);

  const switchNetwork = useCallback(async () => {
    setError("");
    const params = CHAINS[CHAIN_ID]?.params;
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x" + CHAIN_ID.toString(16) }] });
    } catch (e) {
      if ((e?.code === 4902 || e?.data?.originalError?.code === 4902) && params) {
        try { await window.ethereum.request({ method: "wallet_addEthereumChain", params: [params] }); }
        catch (e2) { setError(e2?.message || "Could not add network"); }
      } else {
        setError(e?.message || "Could not switch network");
      }
    }
  }, []);

  /** Proves wallet ownership to the backend: server nonce -> personal_sign -> signature verified server-side. */
  const verifyOwnership = useCallback(async () => {
    const wallet = address || (await connect());
    if (!wallet) throw new Error("Connect your wallet first");
    const { data } = await api.post("/wallet/nonce", { walletAddress: wallet });
    const signer = await getBrowserProvider().getSigner(wallet);
    const signature = await signer.signMessage(data.message);
    const res = await api.post("/wallet/verify", { walletAddress: wallet, signature });
    return res.data.user;
  }, [address, connect]);

  const value = useMemo(
    () => ({ address, chainId, installed, connecting, error, setError, connect, disconnect, switchNetwork, verifyOwnership, networkOk: chainId === CHAIN_ID }),
    [address, chainId, installed, connecting, error, connect, disconnect, switchNetwork, verifyOwnership]
  );
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
