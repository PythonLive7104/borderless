import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import Logo from "./Logo";
import Button from "../ui/Button";
import { NAV_LINKS } from "../../lib/brand";
import { useAuth } from "../../context/AuthContext";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white/85 backdrop-blur-xl">
      <div className="container-page flex h-16 items-center justify-between">
        <Logo />
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 lg:flex">
          {NAV_LINKS.map((l) => (
            <NavLink key={l.to} to={l.to}
              className={({ isActive }) =>
                `rounded-full px-3.5 py-2 text-sm font-medium transition ${isActive ? "text-brand" : "text-fg-muted hover:text-fg"}`}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          {user ? (
            <Button to="/dashboard">Go to dashboard</Button>
          ) : (
            <>
              <Button to="/login" variant="ghost">Sign in</Button>
              <Button to="/signup">Start Free</Button>
            </>
          )}
        </div>
        <button className="lg:hidden rounded-lg p-2 text-fg-muted hover:bg-bg-mute" onClick={() => setOpen(!open)} aria-label="Menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
      </div>
      {open && (
        <div className="border-t border-line lg:hidden">
          <div className="container-page flex flex-col gap-1 py-3">
            {NAV_LINKS.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm text-fg-muted hover:bg-bg-mute hover:text-fg">{l.label}</Link>
            ))}
            <div className="mt-2 flex gap-2">
              {user ? (
                <Button to="/dashboard" className="flex-1">Go to dashboard</Button>
              ) : (
                <>
                  <Button to="/login" variant="outline" className="flex-1">Sign in</Button>
                  <Button to="/signup" className="flex-1">Start Free</Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
