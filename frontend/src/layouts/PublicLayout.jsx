import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Menu, X } from "lucide-react";
import Logo from "../components/Logo";
import { useAuth } from "../hooks/useAuth";
import { homeFor } from "../components/ProtectedRoute";

const links = [["/", "Home"], ["/about", "About"], ["/how-it-works", "How it works"], ["/contact", "Contact"]];

export default function PublicLayout() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex">
            {links.map(([to, label]) => (
              <NavLink key={to} to={to} end className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? "text-brand-700" : "text-slate-600 hover:text-navy-900"}`}>{label}</NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            {user ? <Link to={homeFor(user.role)} className="btn-primary">Dashboard</Link> : (<>
              <Link to="/login" className="btn-outline">Login</Link>
              <Link to="/register/voter" className="btn-primary">Register</Link>
            </>)}
          </div>
          <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X /> : <Menu />}</button>
        </div>
        {open && (
          <div className="border-t bg-white px-4 py-3 md:hidden" onClick={() => setOpen(false)}>
            {links.map(([to, label]) => <Link key={to} to={to} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700">{label}</Link>)}
            <div className="mt-2 flex gap-2">
              {user ? <Link to={homeFor(user.role)} className="btn-primary flex-1">Dashboard</Link> : (<>
                <Link to="/login" className="btn-outline flex-1">Login</Link>
                <Link to="/register/voter" className="btn-primary flex-1">Register</Link>
              </>)}
            </div>
          </div>
        )}
      </header>
      <main className="flex-1"><Outlet /></main>
      <footer className="bg-navy-950 text-slate-300">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
          <div><Logo light /><p className="mt-3 max-w-xs text-sm text-slate-400">A college PBL project demonstrating verifiable elections on the Ethereum blockchain.</p></div>
          <div className="text-sm"><p className="mb-3 font-semibold text-white">Explore</p>
            <ul className="space-y-2">{links.map(([to, l]) => <li key={to}><Link className="hover:text-white" to={to}>{l}</Link></li>)}</ul></div>
          <div className="text-sm"><p className="mb-3 font-semibold text-white">Get started</p>
            <ul className="space-y-2"><li><Link className="hover:text-white" to="/register/voter">Voter registration</Link></li>
              <li><Link className="hover:text-white" to="/register/candidate">Candidate registration</Link></li>
              <li><Link className="hover:text-white" to="/login">Login</Link></li></ul></div>
        </div>
        <p className="border-t border-white/10 py-4 text-center text-xs text-slate-500">Academic project. Votes are transparent on-chain and do not provide ballot secrecy.</p>
      </footer>
    </div>
  );
}
