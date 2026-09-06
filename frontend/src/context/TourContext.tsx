import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import TourGuide, { type TourStep } from "../components/dashboard/TourGuide";

// Ordered around the two GOALS, matching the sidebar. The old tour walked the
// antibot setup and never mentioned Redirection at all, which is the path most
// new users actually want and the one support kept having to explain.
const STEPS: TourStep[] = [
  { icon: "👋", title: "Welcome to TryNoBot",
    body: "TryNoBot checks every visitor in real time and keeps bots away from what you're paying to promote. This takes about a minute." },

  { icon: "🔀", title: "First: what are you protecting?",
    body: "There are two ways to use TryNoBot — a link you share, or a website you own. You don't need both, and neither depends on the other. The sidebar is split the same way, so you can ignore half of it." },

  { icon: "🔗", title: "Protecting a link — Redirection",
    body: "Create a short link and point your ad or campaign at it instead of your landing page. Every click is screened first: real people go straight through, bots don't. Nothing to install, and you don't need to add a website. Short links need a paid plan — that's deliberate, it keeps spammers out." },

  { icon: "🚦", title: "What you control on each link",
    body: "Choose what bots get: a decoy page that wastes their time, a 404, a blank page, or let them through and just count them. You can also block VPN, proxy and RDP visitors, and ask people to press and hold a button for five seconds to prove they're human." },

  { icon: "🌐", title: "Protecting a website — start here",
    body: "Open Websites, add your site, and paste the snippet into it. That's what lets TryNoBot see and score your visitors. Turn on Strict mode if you'd rather blocked visitors never see your page at all." },

  { icon: "🛡️", title: "Traffic Rules, then the Shield",
    body: "Rules act automatically: allow, block, redirect, flag or tag visitors by country, device, risk score, VPN or datacenter. For the strongest protection, install the Shield so bots are stopped on your server before your page is even built." },

  { icon: "🔍", title: "See who actually showed up",
    body: "Visitors and Click Log list every visit with its IP, country, device and risk score, and why it was flagged. The number to watch is traffic quality — the share of visitors who were real. Compare it across sources to see who's selling you rubbish." },

  { icon: "🎉", title: "That's it",
    body: "Tap the help bubble any time to ask a question, or replay this tour from Settings. If you're not sure where to start, the Dashboard will ask you which of the two paths you want." },
];

type TourCtx = { startTour: () => void };
const Ctx = createContext<TourCtx>({ startTour: () => {} });
export const useTour = () => useContext(Ctx);

export function TourProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  // Auto-start once per user on first sign-in.
  useEffect(() => {
    if (!user) return;
    const key = `bl_tour_seen_${user.id}`;
    let seen = false;
    try { seen = localStorage.getItem(key) === "1"; } catch { /* storage blocked */ }
    if (!seen) setOpen(true);
  }, [user?.id]);

  function close() {
    setOpen(false);
    if (user) { try { localStorage.setItem(`bl_tour_seen_${user.id}`, "1"); } catch { /* ignore */ } }
  }
  function startTour() { setOpen(true); }

  return (
    <Ctx.Provider value={{ startTour }}>
      {children}
      <TourGuide steps={STEPS} open={open} onClose={close} />
    </Ctx.Provider>
  );
}
