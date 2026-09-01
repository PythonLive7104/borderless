import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { AuthProvider } from "./context/AuthContext";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import AppRoutes from "./AppRoutes";

// Called by the prerender script for each public route.
export function render(url: string): string {
  return renderToString(
    <AuthProvider>
      <WorkspaceProvider>
        <StaticRouter location={url}>
          <AppRoutes />
        </StaticRouter>
      </WorkspaceProvider>
    </AuthProvider>
  );
}
