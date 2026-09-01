import { Link } from "react-router-dom";
import type { ReactNode } from "react";

type Variant = "primary" | "outline" | "ghost" | "light";
const styles: Record<Variant, string> = {
  primary: "bg-brand text-white shadow-[0_10px_24px_-10px_rgba(37,99,235,.7)] hover:bg-brand-600",
  outline: "border border-line bg-white text-fg hover:border-brand/50 hover:text-brand",
  ghost: "text-fg-muted hover:text-fg hover:bg-bg-mute",
  light: "bg-white/10 text-white border border-white/25 hover:bg-white/20 backdrop-blur",
};

export default function Button({
  children, to, href, variant = "primary", className = "", onClick, type, size = "md", disabled = false,
}: {
  children: ReactNode; to?: string; href?: string; variant?: Variant;
  className?: string; onClick?: () => void; type?: "button" | "submit"; size?: "md" | "lg"; disabled?: boolean;
}) {
  const pad = size === "lg" ? "px-7 py-3.5 text-[15px]" : "px-5 py-2.5 text-sm";
  const cls = `inline-flex items-center justify-center gap-2 rounded-full font-semibold transition ${pad} ${styles[variant]} ${disabled ? "cursor-not-allowed opacity-60" : ""} ${className}`;
  if (to) return <Link to={to} className={cls}>{children}</Link>;
  if (href) return <a href={href} className={cls}>{children}</a>;
  return <button type={type ?? "button"} onClick={onClick} disabled={disabled} className={cls}>{children}</button>;
}
