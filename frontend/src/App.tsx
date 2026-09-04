import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import { DialogProvider } from "./context/DialogContext";
import AppRoutes from "./AppRoutes";

export default function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <DialogProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </DialogProvider>
      </WorkspaceProvider>
    </AuthProvider>
  );
}
