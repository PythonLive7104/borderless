import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initAnalytics, storedConsent } from "./lib/analytics";
import { initSelfTracker } from "./lib/selfTracker";
import { captureAttribution, captureReferral } from "./lib/attribution";

if (storedConsent() === "granted") initAnalytics();
// Before React renders, because this is the one moment the gclid is still in
// the URL. Here rather than in a layout: ads are often pointed straight at
// /signup, which never mounts the marketing layout.
captureAttribution();
// Last-touch, unlike attribution: a friend's link should earn them credit even
// if the visitor first arrived some other way months ago.
captureReferral();
initSelfTracker(); // we run our own bot protection on trynobot.com
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
