import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Menu, X, LogOut } from "lucide-react";
import Logo from "../components/Logo";
import WalletBar from "../components/WalletBar";
import { Avatar } from "../components/ui";
import { useAuth } from "../hooks/useAuth";

export default function DashboardLayout({ nav, title }) {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const doLogout = async () => { await logout(); navigate("/login"); };

  const Sidebar = (
    <aside className="flex h-full w-64 flex-col bg-navy-950 text-slate-300">
      <div className="flex h-16 items-center px-5"><Logo light /></div>
      <p className="px-5 pb-2 pt-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}
            className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${isActive ? "bg-brand-600/20 text-white ring-1 ring-brand-500/40" : "hover:bg-white/5 hover:text-white"}`}>
            <Icon className="h-[18px] w-[18px]" /> {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <Avatar name={user?.name} size="h-9 w-9" />
          <div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{user?.name}</p><p className="truncate text-xs text-slate-400">{user?.email}</p></div>
        </div>
        <button onClick={doLogout} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm hover:bg-white/10"><LogOut className="h-4 w-4" /> Log out</button>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen">
      <div className="fixed inset-y-0 left-0 z-30 hidden lg:block">{Sidebar}</div>
      {open && (<div className="fixed inset-0 z-40 lg:hidden"><div className="absolute inset-0 bg-navy-950/60" onClick={() => setOpen(false)} /><div className="relative h-full w-64">{Sidebar}</div></div>)}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-2 backdrop-blur sm:px-6">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></button>
          <div className="hidden text-sm text-slate-500 lg:block">Signed in as <span className="font-semibold capitalize text-navy-900">{user?.role}</span></div>
          <div className="ml-auto">{user?.role === "voter" && user?.isApproved && <WalletBar />}</div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 animate-fade-up p-4 sm:p-6"><Outlet /></main>
      </div>
    </div>
  );
}
