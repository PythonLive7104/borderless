import { Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import RequireAuth from "./components/auth/RequireAuth";
import RequireStaff from "./components/auth/RequireStaff";
// Marketing pages are EAGER so they can be server-rendered (prerendered) for SEO.
import MarketingLayout from "./components/marketing/MarketingLayout";
import Landing from "./pages/marketing/Landing";
import Pricing from "./pages/marketing/Pricing";
import BotCheck from "./pages/marketing/BotCheck";
import Features from "./pages/marketing/Features";
import FraudDetection from "./pages/marketing/FraudDetection";
import Analytics from "./pages/marketing/Analytics";
import TrafficIntelligence from "./pages/marketing/TrafficIntelligence";
import Integrations from "./pages/marketing/Integrations";
import ApiPage from "./pages/marketing/ApiPage";
import Docs from "./pages/marketing/Docs";
import Faq from "./pages/marketing/Faq";
import Contact from "./pages/marketing/Contact";
import Status from "./pages/marketing/Status";
import Legal from "./pages/marketing/Legal";
// Auth + app + admin are lazy (behind login, no SEO, keeps first load small).
const Login = lazy(() => import("./pages/auth/Login"));
const Signup = lazy(() => import("./pages/auth/Signup"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const VerifyEmail = lazy(() => import("./pages/auth/VerifyEmail"));
const AcceptInvite = lazy(() => import("./pages/auth/AcceptInvite"));
const DashboardLayout = lazy(() => import("./components/dashboard/DashboardLayout"));
const Overview = lazy(() => import("./pages/dashboard/Overview"));
const Websites = lazy(() => import("./pages/dashboard/Websites"));
const WebsiteDetail = lazy(() => import("./pages/dashboard/WebsiteDetail"));
const Campaigns = lazy(() => import("./pages/dashboard/Campaigns"));
const CampaignDetail = lazy(() => import("./pages/dashboard/CampaignDetail"));
const TrafficRules = lazy(() => import("./pages/dashboard/TrafficRules"));
const Shield = lazy(() => import("./pages/dashboard/Shield"));
const BotScanner = lazy(() => import("./pages/dashboard/BotScanner"));
const Visitors = lazy(() => import("./pages/dashboard/Visitors"));
const VisitorDetail = lazy(() => import("./pages/dashboard/VisitorDetail"));
const ClickLog = lazy(() => import("./pages/dashboard/ClickLog"));
const TrafficSources = lazy(() => import("./pages/dashboard/TrafficSources"));
const Conversions = lazy(() => import("./pages/dashboard/Conversions"));
const DashIntegrations = lazy(() => import("./pages/dashboard/Integrations"));
const ApiKeys = lazy(() => import("./pages/dashboard/ApiKeys"));
const Webhooks = lazy(() => import("./pages/dashboard/Webhooks"));
const Billing = lazy(() => import("./pages/dashboard/Billing"));
const UsagePage = lazy(() => import("./pages/dashboard/UsagePage"));
const Team = lazy(() => import("./pages/dashboard/Team"));
const Settings = lazy(() => import("./pages/dashboard/Settings"));
const Reports = lazy(() => import("./pages/dashboard/Reports"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminOrgs = lazy(() => import("./pages/admin/AdminOrgs"));
const AdminSubscriptions = lazy(() => import("./pages/admin/AdminSubscriptions"));
const AdminFraudAlerts = lazy(() => import("./pages/admin/AdminFraudAlerts"));

const spinner = <div className="grid min-h-screen place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" /></div>;

export default function AppRoutes() {
  return (
    <Suspense fallback={spinner}>
      <Routes>
        <Route element={<MarketingLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/features" element={<Features />} />
          <Route path="/traffic-intelligence" element={<TrafficIntelligence />} />
          <Route path="/fraud-detection" element={<FraudDetection />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/api" element={<ApiPage />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/bot-check" element={<BotCheck />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/status" element={<Status />} />
          <Route path="/terms" element={<Legal kind="terms" />} />
          <Route path="/privacy" element={<Legal kind="privacy" />} />
        </Route>

        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />

        <Route path="/dashboard" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
          <Route index element={<Overview />} />
          <Route path="websites" element={<Websites />} />
          <Route path="websites/:id" element={<WebsiteDetail />} />
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="campaigns/:id" element={<CampaignDetail />} />
          <Route path="traffic-rules" element={<TrafficRules />} />
          <Route path="shield" element={<Shield />} />
          <Route path="scanner" element={<BotScanner />} />
          <Route path="visitors" element={<Visitors />} />
          <Route path="visitors/:id" element={<VisitorDetail />} />
          <Route path="click-log" element={<ClickLog />} />
          <Route path="traffic-sources" element={<TrafficSources />} />
          <Route path="conversions" element={<Conversions />} />
          <Route path="integrations" element={<DashIntegrations />} />
          <Route path="api" element={<ApiKeys />} />
          <Route path="webhooks" element={<Webhooks />} />
          <Route path="billing" element={<Billing />} />
          <Route path="usage" element={<UsagePage />} />
          <Route path="team" element={<Team />} />
          <Route path="settings" element={<Settings />} />
          <Route path="reports" element={<Reports />} />
        </Route>

        <Route path="/admin" element={<RequireStaff><AdminLayout /></RequireStaff>}>
          <Route index element={<AdminOverview />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="organizations" element={<AdminOrgs />} />
          <Route path="subscriptions" element={<AdminSubscriptions />} />
          <Route path="fraud-alerts" element={<AdminFraudAlerts />} />
        </Route>

        <Route path="*" element={<Landing />} />
      </Routes>
    </Suspense>
  );
}
