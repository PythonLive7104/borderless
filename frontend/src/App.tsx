import { BrowserRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { WorkspaceProvider, useWorkspace } from "./context/WorkspaceContext";
import { DialogProvider } from "./context/DialogContext";
import AppRoutes from "./AppRoutes";
import CookieConsent from "./components/marketing/CookieConsent";

function AppLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-bg-soft text-fg">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <div className="mb-8 h-12 w-40 animate-pulse rounded-xl bg-bg-mute" />
        <div className="grid gap-5 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-line bg-white p-5 shadow-soft">
              <div className="mb-4 h-5 w-24 animate-pulse rounded bg-bg-mute" />
              <div className="mb-2 h-3 w-full animate-pulse rounded bg-bg-mute" />
              <div className="mb-2 h-3 w-5/6 animate-pulse rounded bg-bg-mute" />
              <div className="mb-5 h-3 w-4/6 animate-pulse rounded bg-bg-mute" />
              <div className="h-10 w-full animate-pulse rounded-xl bg-bg-mute" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AppShell() {
  const { loading: authLoading } = useAuth();
  const { loading: workspaceLoading } = useWorkspace();

  if (authLoading || workspaceLoading) {
    return <AppLoadingSkeleton />;
  }

  return (
    <DialogProvider>
      <BrowserRouter>
        <AppRoutes />
        {/* Outside the routes: the Google tag loads on every page, so the
            choice has to be offered on every page too. */}
        <CookieConsent />
      </BrowserRouter>
    </DialogProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <AppShell />
      </WorkspaceProvider>
    </AuthProvider>
  );
}
