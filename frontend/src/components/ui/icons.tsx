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
// A gold/amber filled shield for the Shield nav item.
export const IShieldGold = (p: SVGProps<SVGSVGElement>) => (<svg {...s(p)}><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" fill="#f59e0b" stroke="#d97706"/><path d="M9 12l2 2 4-4" stroke="#fff"/></svg>);
export const IHome = (p: SVGProps<SVGSVGElement>) => (<svg {...s(p)}><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>);
export const IFilter = (p: SVGProps<SVGSVGElement>) => (<svg {...s(p)}><path d="M4 6h16M7 12h10M10 18h4"/></svg>);
export const ILink = (p: SVGProps<SVGSVGElement>) => (<svg {...s(p)}><path d="M9 15l6-6"/><path d="M11 6l1-1a4 4 0 0 1 6 6l-1 1"/><path d="M13 18l-1 1a4 4 0 0 1-6-6l1-1"/></svg>);
export const IUsers = (p: SVGProps<SVGSVGElement>) => (<svg {...s(p)}><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5.5a3 3 0 0 1 0 5.5"/><path d="M18.5 20a6 6 0 0 0-3-5"/></svg>);
export const IList = (p: SVGProps<SVGSVGElement>) => (<svg {...s(p)}><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>);
export const IKey = (p: SVGProps<SVGSVGElement>) => (<svg {...s(p)}><circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L20 3"/><path d="M16 5l2 2"/></svg>);
export const ICard = (p: SVGProps<SVGSVGElement>) => (<svg {...s(p)}><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/></svg>);
export const IGear = (p: SVGProps<SVGSVGElement>) => (<svg {...s(p)}><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/></svg>);
export const IFunnel = (p: SVGProps<SVGSVGElement>) => (<svg {...s(p)}><path d="M3 5h18l-7 8v6l-4-2v-4z"/></svg>);
export const ISources = (p: SVGProps<SVGSVGElement>) => (<svg {...s(p)}><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/></svg>);
export const ILock = (p: SVGProps<SVGSVGElement>) => (<svg {...s(p)}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><path d="M12 15v2"/></svg>);
