import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
export const assetUrl = (p) => (p ? (p.startsWith("http") ? p : `${API_URL}${p}`) : "");

const api = axios.create({ baseURL: `${API_URL}/api`, timeout: 30000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    const url = error.config?.url || "";
    if (error.response?.status === 401 && !url.includes("/auth/login")) {
      localStorage.removeItem("token");
      window.dispatchEvent(new Event("auth:expired"));
    }
    return Promise.reject(error);
  }
);

export const errMsg = (e) =>
  e?.response?.data?.message || (e?.code === "ERR_NETWORK" ? "Cannot reach the server. Is the backend running?" : e?.message) || "Something went wrong";

export default api;
