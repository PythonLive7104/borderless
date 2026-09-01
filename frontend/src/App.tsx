import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AuthProvider } from "./context/AuthContext";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import RequireAuth from "./components/auth/RequireAuth";
import RequireStaff from "./components/auth/RequireStaff";
import MarketingLayout from "./components/marketing/MarketingLayout";
import Landing from "./pages/marketing/Landing";
// lazy-loaded route chunks (keeps the first load small + splits the dashboard/charts out)
const Pricing = lazy(() => import("./pages/marketing/Pricing"));
const BotCheck = lazy(() => import("./pages/marketing/BotCheck"));
const Features = lazy(() => import("./pages/marketing/Features"));
const FraudDetection = lazy(() => import("./pages/marketing/FraudDetection"));
const Analytics = lazy(() => import("./pages/marketing/Analytics"));
const TrafficIntelligence = lazy(() => import("./pages/marketing/TrafficIntelligence"));
const Integrations = lazy(() => import("./pages/marketing/Integrations"));
const ApiPage = lazy(() => import("./pages/marketing/ApiPage"));
const Docs = lazy(() => import("./pages/marketing/Docs"));
const Faq = lazy(() => import("./pages/marketing/Faq"));
const Contact = lazy(() => import("./pages/marketing/Contact"));
const Status = lazy(() => import("./pages/marketing/Status"));
const Legal = lazy(() => import("./pages/marketing/Legal"));
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


export default function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="grid min-h-screen place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" /></div>}>
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
        </Suspense>
      </BrowserRouter>
      </WorkspaceProvider>
    </AuthProvider>
  );
}
