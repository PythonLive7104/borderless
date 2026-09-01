import { Link } from "react-router-dom";
import Logo from "./Logo";
import { BRAND, FOOTER_COLS } from "../../lib/brand";

export default function Footer() {
  return (
    <footer className="border-t border-line bg-bg-soft">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-fg-muted">{BRAND.tagline}</p>
        </div>
        {FOOTER_COLS.map((col) => (
          <div key={col.title}>
            <h4 className="text-sm font-bold text-fg">{col.title}</h4>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l.to}><Link to={l.to} className="text-sm text-fg-muted hover:text-brand">{l.label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col items-center justify-between gap-3 py-6 text-sm text-fg-dim sm:flex-row">
          <span>© {new Date().getFullYear()} {BRAND.name}. All rights reserved.</span>
          <span>Built for performance marketers, media buyers & agencies.</span>
        </div>
      </div>
    </footer>
  );
}
