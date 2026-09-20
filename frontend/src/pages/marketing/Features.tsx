import { useSeo } from "../../lib/seo";
import FeaturePage from "../../components/marketing/FeaturePage";
import { IRadar, IShield, IGauge, IChart, ITarget, IBolt, IServer, ILock, IUsers, ICheck } from "../../components/ui/icons";
export default function Features() {
  useSeo("Features", "Real-time scoring, JS + TLS/JA3 fingerprinting, traffic rules, IP allow/deny, A/B testing and more.");
  return <FeaturePage eyebrow="Features"
    title="One platform for traffic you can trust"
    sub="Analyze, score, protect and measure every visitor — from first pageview to final conversion."
    blocks={[
      { icon: IRadar, title: "Visitor & session intelligence", desc: "Rich signals for every visit: IP, ASN, geo, device, browser, OS, referrer and UTM data." },
      { icon: IShield, title: "Bot & fraud detection", desc: "Datacenter IPs, proxies, VPNs, headless browsers and automation caught in real time." },
      { icon: IRadar, title: "Behavioral analysis", desc: "How a visitor moves, scrolls and types is scored live — script-driven and synthetic interaction is flagged, while genuine human behavior clears real people faster." },
      { icon: IUsers, title: "Shared threat intelligence", desc: "A bad IP or fingerprint caught on any site defends every site. Bot farms rotate IPs but reuse fingerprints — so the network catches them the moment they reappear." },
      { icon: ICheck, title: "Ad-review reporting", desc: "Verified Google Ads, AdSense and Bing Ads review bots are identified and reported separately — shown the same page as real users, never a different one — so your click quality reflects actual people." },
      { icon: IGauge, title: "Explainable risk scores", desc: "A 0–100 score per visitor with the exact contributing signals — never a black box." },
      { icon: IBolt, title: "Traffic rules engine", desc: "Allow, review, block or tag traffic with a visual IF/THEN rule builder." },
      { icon: IServer, title: "Server-side shield", desc: "Block bots before your page loads — enforce rules at your server or edge with drop-in PHP, Django, nginx, Cloudflare or Node snippets." },
      { icon: ILock, title: "Folder Guard", desc: "Lock down sensitive paths like /admin, /wp-login or /downloads from bots and fraud." },
      { icon: IChart, title: "Analytics & reports", desc: "Filterable reports across campaigns, geos, devices and sources with CSV export." },
      { icon: ITarget, title: "Conversion attribution", desc: "Tie revenue back to campaigns and traffic quality to see what actually converts." },
    ]}
    bullets={["Async JavaScript tracker","REST API & signed webhooks","Team roles & workspaces","70/85/100% usage alerts","GDPR-friendly data controls","Configurable data retention"]}
  />;
}
