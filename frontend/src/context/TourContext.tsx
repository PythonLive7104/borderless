import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import TourGuide, { type TourStep } from "../components/dashboard/TourGuide";

const STEPS: TourStep[] = [
  { icon: "👋", title: "Welcome to TrackAudit", body: "TrackAudit scores every visitor in real time and filters out bots and fraud before they waste your ad budget. Here's a quick 60-second tour of the essentials." },
  { icon: "🌐", title: "1. Add your website", body: "Open Websites, add your site, and paste the tracking snippet into it. That snippet is what streams visits into TrackAudit for scoring." },
  { icon: "🎯", title: "2. Track campaigns", body: "Under Campaigns you can see the traffic quality of each ad campaign, run A/B landing-page tests, and scan destination URLs for threats." },
  { icon: "🛡️", title: "3. Set traffic rules", body: "Traffic Rules let you automatically Allow, Redirect, Block, Flag or Tag visitors by country, device, OS, risk score, JA3 and more — plus IP allow/deny lists." },
  { icon: "🚧", title: "4. Actually stop bad traffic (NEW)", body: "Detecting bots is half the job — to stop them, redirect them away with a rule (no code needed), or turn on the new Server-side Shield to block them BEFORE your page even loads. Start at Traffic Rules → Recommended protection, or open the Shield page. Not technical? The one-click redirect is all you need." },
  { icon: "🔍", title: "5. Inspect visitors", body: "Visitors and Click Log show every visit with its risk score, fingerprint and exactly why it was flagged, so you can trust the decisions." },
  { icon: "📊", title: "6. Read the analytics", body: "Reports, Conversions and Traffic Sources reveal what's actually working and where fraud is coming from." },
  { icon: "🔌", title: "7. Connect your stack", body: "In the Developer section you'll find API keys, webhooks and integrations to wire TrackAudit into the rest of your tools." },
  { icon: "🎉", title: "You're all set!", body: "Tap the help bubble at any time to ask a question, or replay this tour from Settings. Happy filtering!" },
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
