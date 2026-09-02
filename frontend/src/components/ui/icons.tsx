import type { SVGProps } from "react";
const s = (p: SVGProps<SVGSVGElement>) => ({
  width: 20, height: 20, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const, ...p,
});
export const IShield = (p: SVGProps<SVGSVGElement>) => (<svg {...s(p)}><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/></svg>);
export const IRadar = (p: SVGProps<SVGSVGElement>) => (<svg {...s(p)}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12l6-3"/></svg>);
export const IGauge = (p: SVGProps<SVGSVGElement>) => (<svg {...s(p)}><path d="M12 13l4-3"/><path d="M4 15a8 8 0 1 1 16 0"/><circle cx="12" cy="13" r="1.4"/></svg>);
export const IChart = (p: SVGProps<SVGSVGElement>) => (<svg {...s(p)}><path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-7"/></svg>);
export const ITarget = (p: SVGProps<SVGSVGElement>) => (<svg {...s(p)}><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>);
export const IBolt = (p: SVGProps<SVGSVGElement>) => (<svg {...s(p)}><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>);
export const IPlug = (p: SVGProps<SVGSVGElement>) => (<svg {...s(p)}><path d="M9 2v6M15 2v6"/><path d="M7 8h10v3a5 5 0 0 1-10 0z"/><path d="M12 16v6"/></svg>);
export const ICheck = (p: SVGProps<SVGSVGElement>) => (<svg {...s(p)}><path d="M20 6L9 17l-5-5"/></svg>);
export const IArrow = (p: SVGProps<SVGSVGElement>) => (<svg {...s(p)}><path d="M5 12h14M13 6l6 6-6 6"/></svg>);
export const IGlobe = (p: SVGProps<SVGSVGElement>) => (<svg {...s(p)}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>);
export const ICode = (p: SVGProps<SVGSVGElement>) => (<svg {...s(p)}><path d="M8 9l-3 3 3 3M16 9l3 3-3 3M13 6l-2 12"/></svg>);
export const IServer = (p: SVGProps<SVGSVGElement>) => (<svg {...s(p)}><rect x="4" y="4" width="16" height="7" rx="1.5"/><rect x="4" y="13" width="16" height="7" rx="1.5"/><path d="M7.5 7.5h.01M7.5 16.5h.01"/></svg>);
export const ILock = (p: SVGProps<SVGSVGElement>) => (<svg {...s(p)}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><path d="M12 15v2"/></svg>);
