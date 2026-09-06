import { jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect, useContext, createContext } from "react";
import { u as useAuth } from "../entry-server.js";
function TourGuide({ steps, open, onClose }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (open) setI(0);
  }, [open]);
  if (!open) return null;
  const step = steps[i];
  const last = i === steps.length - 1;
  return /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4 backdrop-blur-sm", children: /* @__PURE__ */ jsxs("div", { className: "w-full max-w-md rounded-2xl bg-white p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,.4)]", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between", children: [
      /* @__PURE__ */ jsx("div", { className: "grid h-12 w-12 place-items-center rounded-xl bg-brand/10 text-2xl", children: step.icon }),
      /* @__PURE__ */ jsx("button", { onClick: onClose, className: "rounded-lg p-1.5 text-fg-dim hover:bg-bg-mute hover:text-fg", "aria-label": "Close tour", children: /* @__PURE__ */ jsx("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })
    ] }),
    /* @__PURE__ */ jsx("h2", { className: "mt-4 text-xl font-extrabold tracking-tight", children: step.title }),
    /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm leading-relaxed text-fg-muted", children: step.body }),
    /* @__PURE__ */ jsxs("div", { className: "mt-6 flex items-center justify-between", children: [
      /* @__PURE__ */ jsx("div", { className: "flex gap-1.5", children: steps.map((_, j) => /* @__PURE__ */ jsx("span", { className: `h-1.5 rounded-full transition-all ${j === i ? "w-5 bg-brand" : "w-1.5 bg-line"}` }, j)) }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
        i > 0 && /* @__PURE__ */ jsx("button", { onClick: () => setI(i - 1), className: "rounded-full px-4 py-2 text-sm font-semibold text-fg-muted hover:text-fg", children: "Back" }),
        last ? /* @__PURE__ */ jsx("button", { onClick: onClose, className: "rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600", children: "Get started" }) : /* @__PURE__ */ jsx("button", { onClick: () => setI(i + 1), className: "rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600", children: "Next" })
      ] })
    ] }),
    !last && /* @__PURE__ */ jsx("button", { onClick: onClose, className: "mt-3 block w-full text-center text-xs text-fg-dim hover:text-fg-muted", children: "Skip the tour" })
  ] }) });
}
const STEPS = [
  {
    icon: "👋",
    title: "Welcome to TryNoBot",
    body: "TryNoBot checks every visitor in real time and keeps bots away from what you're paying to promote. This takes about a minute."
  },
  {
    icon: "🔀",
    title: "First: what are you protecting?",
    body: "There are two ways to use TryNoBot — a link you share, or a website you own. You don't need both, and neither depends on the other. The sidebar is split the same way, so you can ignore half of it."
  },
  {
    icon: "🔗",
    title: "Protecting a link — Redirection",
    body: "Create a short link and point your ad or campaign at it instead of your landing page. Every click is screened first: real people go straight through, bots don't. Nothing to install, and you don't need to add a website. Short links need a paid plan — that's deliberate, it keeps spammers out."
  },
  {
    icon: "🚦",
    title: "What you control on each link",
    body: "Choose what bots get: a decoy page that wastes their time, a 404, a blank page, or let them through and just count them. You can also block VPN, proxy and RDP visitors, and ask people to press and hold a button for five seconds to prove they're human."
  },
  {
    icon: "🌐",
    title: "Protecting a website — start here",
    body: "Open Websites, add your site, and paste the snippet into it. That's what lets TryNoBot see and score your visitors. Turn on Strict mode if you'd rather blocked visitors never see your page at all."
  },
  {
    icon: "🛡️",
    title: "Traffic Rules, then the Shield",
    body: "Rules act automatically: allow, block, redirect, flag or tag visitors by country, device, risk score, VPN or datacenter. For the strongest protection, install the Shield so bots are stopped on your server before your page is even built."
  },
  {
    icon: "🔍",
    title: "See who actually showed up",
    body: "Visitors and Click Log list every visit with its IP, country, device and risk score, and why it was flagged. The number to watch is traffic quality — the share of visitors who were real. Compare it across sources to see who's selling you rubbish."
  },
  {
    icon: "🎉",
    title: "That's it",
    body: "Tap the help bubble any time to ask a question, or replay this tour from Settings. If you're not sure where to start, the Dashboard will ask you which of the two paths you want."
  }
];
const Ctx = createContext({ startTour: () => {
} });
const useTour = () => useContext(Ctx);
function TourProvider({ children }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!user) return;
    const key = `bl_tour_seen_${user.id}`;
    let seen = false;
    try {
      seen = localStorage.getItem(key) === "1";
    } catch {
    }
    if (!seen) setOpen(true);
  }, [user == null ? void 0 : user.id]);
  function close() {
    setOpen(false);
    if (user) {
      try {
        localStorage.setItem(`bl_tour_seen_${user.id}`, "1");
      } catch {
      }
    }
  }
  function startTour() {
    setOpen(true);
  }
  return /* @__PURE__ */ jsxs(Ctx.Provider, { value: { startTour }, children: [
    children,
    /* @__PURE__ */ jsx(TourGuide, { steps: STEPS, open, onClose: close })
  ] });
}
export {
  TourProvider as T,
  useTour as u
};
