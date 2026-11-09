import { Loader2, AlertCircle, CheckCircle2, Info, Inbox } from "lucide-react";

export const Spinner = ({ label = "Loading..." }) => (
  <div className="flex items-center justify-center gap-2 py-16 text-slate-500" role="status">
    <Loader2 className="h-5 w-5 animate-spin text-brand-600" /> <span className="text-sm">{label}</span>
  </div>
);

const alertStyles = {
  error: ["border-red-200 bg-red-50 text-red-800", AlertCircle],
  success: ["border-emerald-200 bg-emerald-50 text-emerald-800", CheckCircle2],
  info: ["border-brand-200 bg-brand-50 text-brand-800", Info],
  warn: ["border-amber-200 bg-amber-50 text-amber-800", AlertCircle],
};
export const Alert = ({ type = "info", children, className = "" }) => {
  if (!children) return null;
  const [cls, Icon] = alertStyles[type];
  return (
    <div role={type === "error" ? "alert" : "status"} className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${cls} ${className}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" /> <div className="min-w-0 break-words">{children}</div>
    </div>
  );
};

const badge = {
  pending: "bg-amber-100 text-amber-800", approved: "bg-emerald-100 text-emerald-800", rejected: "bg-red-100 text-red-800",
  live: "bg-emerald-100 text-emerald-800", upcoming: "bg-brand-100 text-brand-800", ended: "bg-slate-200 text-slate-700",
  active: "bg-emerald-100 text-emerald-800", inactive: "bg-slate-200 text-slate-600",
  confirmed: "bg-emerald-100 text-emerald-800", failed: "bg-red-100 text-red-800",
};
export const StatusBadge = ({ status, children }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${badge[status] || "bg-slate-100 text-slate-700"}`}>
    <span className={`h-1.5 w-1.5 rounded-full bg-current ${status === "live" ? "animate-pulse" : ""}`} />
    {children || status}
  </span>
);

export const StatCard = ({ icon: Icon, label, value, tone = "brand", hint }) => {
  const tones = { brand: "bg-brand-100 text-brand-700", navy: "bg-navy-100 text-navy-700", green: "bg-emerald-100 text-emerald-700", amber: "bg-amber-100 text-amber-700" };
  return (
    <div className="card flex items-center gap-4 transition hover:shadow-md">
      <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon className="h-6 w-6" /></div>
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-navy-900">{value ?? "-"}</p>
        {hint && <p className="text-xs text-slate-400">{hint}</p>}
      </div>
    </div>
  );
};

export const PageHeader = ({ title, subtitle, action }) => (
  <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
    <div>
      <h1 className="text-2xl font-bold text-navy-900">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const EmptyState = ({ title, text, action }) => (
  <div className="card flex flex-col items-center py-12 text-center">
    <Inbox className="mb-3 h-10 w-10 text-slate-300" />
    <p className="font-semibold text-slate-700">{title}</p>
    {text && <p className="mt-1 max-w-md text-sm text-slate-500">{text}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const Field = ({ label, error, children, hint }) => (
  <div>
    <label className="label">{label}</label>
    {children}
    {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
);

export const Avatar = ({ src, name, size = "h-12 w-12" }) =>
  src ? (
    <img src={src} alt={name} className={`${size} rounded-full object-cover ring-2 ring-brand-100`} />
  ) : (
    <div className={`${size} grid place-items-center rounded-full bg-gradient-to-br from-brand-500 to-navy-700 text-sm font-bold text-white`}>
      {(name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
    </div>
  );

export const ConfirmModal = ({ open, title, text, confirmLabel = "Confirm", tone = "primary", onConfirm, onCancel, busy }) =>
  !open ? null : (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-950/60 p-4" role="dialog" aria-modal="true">
      <div className="card w-full max-w-md animate-fade-up">
        <h3 className="text-lg font-bold text-navy-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-600">{text}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-outline" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className={tone === "danger" ? "btn-danger" : "btn-primary"} onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

export const Table = ({ heads, children }) => (
  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
    <table className="min-w-full divide-y divide-slate-200">
      <thead className="bg-slate-50"><tr>{heads.map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-100">{children}</tbody>
    </table>
  </div>
);
