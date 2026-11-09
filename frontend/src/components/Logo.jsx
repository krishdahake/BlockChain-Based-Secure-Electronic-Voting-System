import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

export default function Logo({ light = false, to = "/" }) {
  return (
    <Link to={to} className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow">
        <ShieldCheck className="h-5 w-5" />
      </span>
      <span className={`text-lg font-extrabold tracking-tight ${light ? "text-white" : "text-navy-900"}`}>
        Smart<span className="text-brand-500">Vote</span>
      </span>
    </Link>
  );
}
