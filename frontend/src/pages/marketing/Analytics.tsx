import FeaturePage from "../../components/marketing/FeaturePage";
import { IChart, IGlobe, ITarget, IGauge, IRadar, IBolt } from "../../components/ui/icons";
export default function Analytics() {
  return <FeaturePage eyebrow="Analytics"
    title="Reports that tell you what to do next"
    sub="Fast, filterable analytics across campaigns, sources, geos and devices — with conversions and revenue built in."
    blocks={[
      { icon: IChart, title: "Traffic & quality reports", desc: "Volume and quality trends over any date range, exportable to CSV." },
      { icon: IGlobe, title: "Geo & device reports", desc: "See where quality traffic and conversions actually come from." },
      { icon: ITarget, title: "Conversion reports", desc: "Conversion rate, revenue and revenue-per-visitor by campaign and source." },
      { icon: IRadar, title: "Source comparison", desc: "Rank traffic sources by quality, suspicious rate and ROI side by side." },
      { icon: IGauge, title: "Risk distribution", desc: "Understand how your traffic spreads across the risk spectrum." },
      { icon: IBolt, title: "Real-time dashboards", desc: "Live overview cards and charts that update as traffic arrives." },
    ]}
    bullets={["Today / 7 / 30-day & custom ranges","Filter by campaign, geo, device, source","Classification breakdowns","Revenue & conversion metrics","CSV export (PDF later)","Saved default date ranges"]}
  />;
}
