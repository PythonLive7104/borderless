import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initAnalytics } from "./lib/analytics";

initAnalytics(); // Google tag (no-op unless VITE_GA_ID / VITE_GADS_ID set)
const root = document.getElementById("root")!;
const app = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
// Prerendered (marketing) pages arrive with server HTML -> hydrate.
// App routes (dashboard/admin) arrive empty -> client render.
if (root.hasChildNodes()) ReactDOM.hydrateRoot(root, app);
else ReactDOM.createRoot(root).render(app);
