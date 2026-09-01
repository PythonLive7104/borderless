import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import RequireAuth from "./components/auth/RequireAuth";
import RequireStaff from "./components/auth/RequireStaff";
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
// auth
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import VerifyEmail from "./pages/auth/VerifyEmail";
import AcceptInvite from "./pages/auth/AcceptInvite";
// app (placeholder until dashboard phase)
import DashboardLayout from "./components/dashboard/DashboardLayout";
import Overview from "./pages/dashboard/Overview";
import Websites from "./pages/dashboard/Websites";
import WebsiteDetail from "./pages/dashboard/WebsiteDetail";
import Campaigns from "./pages/dashboard/Campaigns";
import CampaignDetail from "./pages/dashboard/CampaignDetail";
import TrafficRules from "./pages/dashboard/TrafficRules";
import BotScanner from "./pages/dashboard/BotScanner";
import Visitors from "./pages/dashboard/Visitors";
import VisitorDetail from "./pages/dashboard/VisitorDetail";
import ClickLog from "./pages/dashboard/ClickLog";
import TrafficSources from "./pages/dashboard/TrafficSources";
import Conversions from "./pages/dashboard/Conversions";
import DashIntegrations from "./pages/dashboard/Integrations";
import ApiKeys from "./pages/dashboard/ApiKeys";
import Webhooks from "./pages/dashboard/Webhooks";
import Billing from "./pages/dashboard/Billing";
import UsagePage from "./pages/dashboard/UsagePage";
import Team from "./pages/dashboard/Team";
import Settings from "./pages/dashboard/Settings";
import Reports from "./pages/dashboard/Reports";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminOrgs from "./pages/admin/AdminOrgs";
import AdminSubscriptions from "./pages/admin/AdminSubscriptions";
import AdminFraudAlerts from "./pages/admin/AdminFraudAlerts";

export default function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
      <BrowserRouter>
        <Routes>
          {/* marketing */}
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

          {/* auth */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />

          {/* app (protected) */}
          <Route path="/dashboard" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
            <Route index element={<Overview />} />
            <Route path="websites" element={<Websites />} />
            <Route path="websites/:id" element={<WebsiteDetail />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="campaigns/:id" element={<CampaignDetail />} />
            <Route path="traffic-rules" element={<TrafficRules />} />
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

          {/* staff admin */}
          <Route path="/admin" element={<RequireStaff><AdminLayout /></RequireStaff>}>
            <Route index element={<AdminOverview />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="organizations" element={<AdminOrgs />} />
            <Route path="subscriptions" element={<AdminSubscriptions />} />
            <Route path="fraud-alerts" element={<AdminFraudAlerts />} />
          </Route>

          <Route path="*" element={<Landing />} />
        </Routes>
      </BrowserRouter>
      </WorkspaceProvider>
    </AuthProvider>
  );
}
