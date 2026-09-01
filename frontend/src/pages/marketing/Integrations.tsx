import FeaturePage from "../../components/marketing/FeaturePage";
import { ICode, IPlug, IBolt, IShield, IGlobe, IChart } from "../../components/ui/icons";
export default function Integrations() {
  return <FeaturePage eyebrow="Integrations"
    title="Drop-in tracking, developer-friendly APIs"
    sub="Install one script or call the REST API. Get signed webhooks for every important event."
    blocks={[
      { icon: ICode, title: "JavaScript tracker", desc: "A lightweight async snippet — pageviews, events and conversions, no page-load impact." },
      { icon: IPlug, title: "REST API", desc: "Manage websites, campaigns, visitors, rules and conversions programmatically." },
      { icon: IBolt, title: "Webhooks", desc: "Signed, retried deliveries for visitor.created, traffic.classified, risk.high and more." },
      { icon: IShield, title: "Server-side ingestion", desc: "Send events from your backend for tamper-resistant conversion tracking." },
      { icon: IGlobe, title: "Coming soon", desc: "Native Google Ads, Meta Ads, TikTok Ads, GA4, Shopify and WordPress connectors." },
      { icon: IChart, title: "Data export", desc: "Export raw and aggregated data to CSV for your own warehouse and BI tools." },
    ]}
  />;
}
