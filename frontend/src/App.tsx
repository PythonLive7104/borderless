import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import { DialogProvider } from "./context/DialogContext";
import AppRoutes from "./AppRoutes";
import CookieConsent from "./components/marketing/CookieConsent";

export default function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <DialogProvider>
          <BrowserRouter>
            <AppRoutes />
            {/* Outside the routes: the Google tag loads on every page, so the
                choice has to be offered on every page too. */}
            <CookieConsent />
          </BrowserRouter>
        </DialogProvider>
      </WorkspaceProvider>
    </AuthProvider>
  );
}
