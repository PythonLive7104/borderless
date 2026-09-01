import FeaturePage from "../../components/marketing/FeaturePage";
import { IRadar, IShield, IGauge, IChart, ITarget, IBolt } from "../../components/ui/icons";
export default function Features() {
  return <FeaturePage eyebrow="Features"
    title="One platform for traffic you can trust"
    sub="Analyze, score, protect and measure every visitor — from first pageview to final conversion."
    blocks={[
      { icon: IRadar, title: "Visitor & session intelligence", desc: "Rich signals for every visit: IP, ASN, geo, device, browser, OS, referrer and UTM data." },
      { icon: IShield, title: "Bot & fraud detection", desc: "Datacenter IPs, proxies, VPNs, headless browsers and automation caught in real time." },
      { icon: IGauge, title: "Explainable risk scores", desc: "A 0–100 score per visitor with the exact contributing signals — never a black box." },
      { icon: IBolt, title: "Traffic rules engine", desc: "Allow, review, block or tag traffic with a visual IF/THEN rule builder." },
      { icon: IChart, title: "Analytics & reports", desc: "Filterable reports across campaigns, geos, devices and sources with CSV export." },
      { icon: ITarget, title: "Conversion attribution", desc: "Tie revenue back to campaigns and traffic quality to see what actually converts." },
    ]}
    bullets={["Async JavaScript tracker","REST API & signed webhooks","Team roles & workspaces","70/85/100% usage alerts","GDPR-friendly data controls","Configurable data retention"]}
  />;
}
