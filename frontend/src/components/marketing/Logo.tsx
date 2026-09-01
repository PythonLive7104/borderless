import { Link } from "react-router-dom";
import { BRAND } from "../../lib/brand";
export default function Logo({ light = false, className = "" }: { light?: boolean; className?: string }) {
  return (
    <Link to="/" className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-tr from-brand to-violet shadow-[0_8px_20px_-8px_rgba(37,99,235,.8)]">
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
          <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"
                fill="white" fillOpacity="0.15" stroke="white" strokeWidth="1.7" strokeLinejoin="round" />
          <polyline points="6.5,12 9,12 11,8.5 13,15.5 15,12 17.5,12"
                fill="none" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className={`text-lg font-extrabold tracking-tight ${light ? "text-white" : "text-fg"}`}>{BRAND.name}</span>
    </Link>
  );
}
