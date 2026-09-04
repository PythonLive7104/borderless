import { jsxs, jsx } from "react/jsx-runtime";
import { Link } from "react-router-dom";
import { P as PageNote } from "./PageNote-9zZCxTLa.js";
import "react";
const CARDS = [
  { title: "JavaScript Tracker", desc: "The snippet you paste into your website to start collecting traffic.", to: "/dashboard/websites", cta: "Manage websites", status: "Set up per website" },
  { title: "REST API", desc: "Create API keys to record conversions and read data from your own systems.", to: "/dashboard/api", cta: "Manage API keys", status: "Key-based" },
  { title: "Webhooks", desc: "Get real-time notifications when bots are caught or sales happen.", to: "/dashboard/webhooks", cta: "Manage webhooks", status: "Signed & retried" }
];
function Integrations() {
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs(PageNote, { id: "integrations", children: [
      "Integrations are the ways TryNoBot connects to your website and your other tools. Most people start with the ",
      /* @__PURE__ */ jsx("b", { children: "JavaScript Tracker" }),
      "; developers can also use the ",
      /* @__PURE__ */ jsx("b", { children: "REST API" }),
      " and ",
      /* @__PURE__ */ jsx("b", { children: "Webhooks" }),
      "."
    ] }),
    /* @__PURE__ */ jsx("h1", { className: "text-2xl font-extrabold tracking-tight", children: "Integrations" }),
    /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-fg-muted", children: "Connect TryNoBot to your site and systems." }),
    /* @__PURE__ */ jsx("div", { className: "mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3", children: CARDS.map((c) => /* @__PURE__ */ jsxs("div", { className: "card card-hover shadow-soft flex flex-col p-6", children: [
      /* @__PURE__ */ jsx("h3", { className: "text-lg font-bold", children: c.title }),
      /* @__PURE__ */ jsx("p", { className: "mt-2 flex-1 text-sm text-fg-muted", children: c.desc }),
      /* @__PURE__ */ jsx("span", { className: "mt-3 inline-block w-fit rounded-full bg-bg-mute px-2.5 py-1 text-xs font-semibold text-fg-muted", children: c.status }),
      /* @__PURE__ */ jsxs(Link, { to: c.to, className: "mt-4 inline-block rounded-full bg-brand px-4 py-2 text-center text-sm font-semibold text-white hover:bg-brand-600", children: [
        c.cta,
        " →"
      ] })
    ] }, c.title)) })
  ] });
}
export {
  Integrations as default
};
