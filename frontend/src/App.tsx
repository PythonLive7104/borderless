import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import AppRoutes from "./AppRoutes";

export default function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </WorkspaceProvider>
    </AuthProvider>
  );
}
