import type { ReactNode } from "react";
export default function Badge({ children, tone = "brand" }: { children: ReactNode; tone?: "brand" | "cyan" | "green" | "light" }) {
  const tones: Record<string, string> = {
    brand: "border-brand/20 bg-brand/8 text-brand",
    cyan: "border-cyan/25 bg-cyan/10 text-cyan-700",
    green: "border-success/25 bg-success/10 text-emerald-700",
    light: "border-white/25 bg-white/10 text-white backdrop-blur",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}
