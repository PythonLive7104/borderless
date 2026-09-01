import type { ReactNode } from "react";
export function SectionHead({ eyebrow, title, sub, center = true }: { eyebrow?: string; title: ReactNode; sub?: ReactNode; center?: boolean; }) {
  return (
    <div className={`${center ? "mx-auto text-center" : ""} max-w-2xl`}>
      {eyebrow && <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-brand">{eyebrow}</div>}
      <h2 className="text-3xl font-extrabold tracking-tight text-fg sm:text-[2.5rem] sm:leading-[1.1]">{title}</h2>
      {sub && <p className="mt-4 text-base leading-relaxed text-fg-muted">{sub}</p>}
    </div>
  );
}
export function Section({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`container-page py-20 sm:py-24 ${className}`}>{children}</section>;
}
