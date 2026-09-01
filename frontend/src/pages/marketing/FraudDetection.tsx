import FeaturePage from "../../components/marketing/FeaturePage";
import { IShield, IRadar, IGauge, IBolt, IGlobe, ITarget } from "../../components/ui/icons";
export default function FraudDetection() {
  return <FeaturePage eyebrow="Fraud Detection"
    title="Stop paying for traffic that never converts"
    sub="Detect bots, click fraud and automated abuse with transparent, explainable scoring — no deception, just defense."
    blocks={[
      { icon: IShield, title: "Bot & automation", desc: "Headless browsers, known bot user-agents and scripted traffic flagged instantly." },
      { icon: IGlobe, title: "Datacenter & proxy", desc: "Datacenter IPs, proxies and VPNs identified via IP/ASN reputation." },
      { icon: IRadar, title: "Behavioral anomalies", desc: "Abnormal request frequency and repeated suspicious activity surfaced automatically." },
      { icon: IGauge, title: "Risk ranges", desc: "0–39 low · 40–69 medium · 70–84 high · 85–100 critical, each fully explained." },
      { icon: IBolt, title: "Automatic actions", desc: "Route risky traffic to block, review or tag with your own rule thresholds." },
      { icon: ITarget, title: "Signal transparency", desc: "Every score lists the signals behind it so you can trust — and tune — decisions." },
    ]}
    bullets={["Datacenter IP detection","Proxy & VPN signals","Headless-browser indicators","Known bot fingerprints","Abnormal request-rate detection","IP / ASN reputation"]}
  />;
}
