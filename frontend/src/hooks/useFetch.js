import { useCallback, useEffect, useState } from "react";
import api, { errMsg } from "../services/api";

/** GET helper with loading / error / reload. */
export function useFetch(url, { skip = false } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (skip || !url) return;
    setLoading(true); setError("");
    try { setData((await api.get(url)).data); }
    catch (e) { setError(errMsg(e)); }
    finally { setLoading(false); }
  }, [url, skip]);
  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load, setData };
}
