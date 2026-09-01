import { Link } from "react-router-dom";
import { BRAND } from "../../lib/brand";
export default function Logo({ light = false, className = "" }: { light?: boolean; className?: string }) {
  return (
    <Link to="/" className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-tr from-brand to-violet shadow-[0_8px_20px_-8px_rgba(37,99,235,.8)]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
          <path d="M8.5 12.5l2.2 2.2 4.8-5" />
        </svg>
      </span>
      <span className={`text-lg font-extrabold tracking-tight ${light ? "text-white" : "text-fg"}`}>{BRAND.name}</span>
    </Link>
  );
}
