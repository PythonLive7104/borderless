import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import Logo from "../marketing/Logo";
import { BRAND } from "../../lib/brand";

export default function AuthLayout({ title, subtitle, children, footer }: {
  title: string; subtitle: string; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* brand panel */}
      <div className="hero-band relative hidden overflow-hidden lg:block">
        <div className="binary-grid absolute inset-0 opacity-70" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo light />
          <div>
            <h2 className="max-w-md text-3xl font-extrabold leading-tight text-white">
              See every visitor. Score every click. <span className="text-gradient">Protect every campaign.</span>
            </h2>
            <p className="mt-4 max-w-sm text-slate-300">
              Real-time traffic intelligence, fraud detection and cloaking for serious media buyers.
            </p>
            <div className="mt-8 flex gap-6 text-slate-300">
              {[["120M+", "visitors analyzed"], ["<8ms", "avg decision"], ["92.7%", "median quality"]].map(([v, k]) => (
                <div key={k}><div className="text-2xl font-extrabold text-white">{v}</div><div className="text-xs">{k}</div></div>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} {BRAND.name}</p>
        </div>
      </div>

      {/* form panel */}
      <div className="flex flex-col bg-bg">
        <div className="flex items-center justify-between p-6 lg:hidden">
          <Logo />
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
            <p className="mt-1.5 text-sm text-fg-muted">{subtitle}</p>
            <div className="mt-7">{children}</div>
            {footer && <div className="mt-6 text-center text-sm text-fg-muted">{footer}</div>}
            <p className="mt-8 text-center text-xs text-fg-dim">
              <Link to="/" className="hover:text-brand">← Back to home</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
