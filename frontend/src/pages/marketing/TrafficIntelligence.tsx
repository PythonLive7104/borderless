import FeaturePage from "../../components/marketing/FeaturePage";
import { IRadar, IGlobe, IChart, IGauge, IBolt, ITarget } from "../../components/ui/icons";
export default function TrafficIntelligence() {
  return <FeaturePage eyebrow="Traffic Intelligence"
    title="Understand every visitor in real time"
    sub="See where traffic comes from, how it behaves, and whether it's worth paying for — the moment it lands."
    blocks={[
      { icon: IRadar, title: "40+ signals per visit", desc: "Network, device, browser and behavioral signals extracted on every request." },
      { icon: IGlobe, title: "Geo & network context", desc: "Country, region, city, ASN and ISP resolution to spot anomalies fast." },
      { icon: IGauge, title: "Live classification", desc: "Human, Suspicious, Bot or Fraud — decided in single-digit milliseconds." },
      { icon: IChart, title: "Source breakdowns", desc: "Compare quality across Google, Meta, TikTok, organic, direct and referral." },
      { icon: IBolt, title: "Live traffic feed", desc: "Watch visitors, scores and actions stream in as clicks happen." },
      { icon: ITarget, title: "Quality trends", desc: "Track traffic quality over time and catch degradation before it costs you." },
    ]}
  />;
}
