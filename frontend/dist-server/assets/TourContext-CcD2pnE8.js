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
  { icon: "👋", title: "Welcome to TrackAudit", body: "TrackAudit scores every visitor in real time and filters out bots and fraud before they waste your ad budget. Here's a quick 60-second tour of the essentials." },
  { icon: "🌐", title: "1. Add your website", body: "Open Websites, add your site, and paste the tracking snippet into it. That snippet is what streams visits into TrackAudit for scoring." },
  { icon: "🎯", title: "2. Track campaigns", body: "Under Campaigns you can see the traffic quality of each ad campaign, run A/B landing-page tests, and scan destination URLs for threats." },
  { icon: "🛡️", title: "3. Set traffic rules", body: "Traffic Rules let you automatically Allow, Redirect, Block, Flag or Tag visitors by country, device, OS, risk score, JA3 and more — plus IP allow/deny lists." },
  { icon: "🔍", title: "4. Inspect visitors", body: "Visitors and Click Log show every visit with its risk score, fingerprint and exactly why it was flagged, so you can trust the decisions." },
  { icon: "📊", title: "5. Read the analytics", body: "Reports, Conversions and Traffic Sources reveal what's actually working and where fraud is coming from." },
  { icon: "🔌", title: "6. Connect your stack", body: "In the Developer section you'll find API keys, webhooks and integrations to wire TrackAudit into the rest of your tools." },
  { icon: "🎉", title: "You're all set!", body: "Tap the help bubble at any time to ask a question, or replay this tour from Settings. Happy filtering!" }
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
