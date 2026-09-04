import { jsxs, jsx } from "react/jsx-runtime";
import { useState } from "react";
import { u as useAuth, B as Button, a as authApi } from "../entry-server.js";
import { u as useTour } from "./TourContext-Bymw7lRR.js";
import { F as Field } from "./Field-Cq1XQP8x.js";
import { P as PageNote } from "./PageNote-9zZCxTLa.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react-router-dom";
const TABS = ["Profile", "Security", "Notifications"];
const TIMEZONES = ["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Africa/Lagos", "Asia/Dubai", "Asia/Singapore"];
const LANGUAGES = [
  ["en", "English"],
  ["es", "Español"],
  ["fr", "Français"],
  ["de", "Deutsch"],
  ["pt", "Português"],
  ["ru", "Русский"],
  ["zh", "中文"],
  ["ar", "العربية"]
];
const PREF_META = {
  email: { label: "Email notifications", desc: "Master switch for all account emails." },
  high_risk: { label: "High-risk traffic alerts", desc: "Get notified when bot or fraud spikes are detected." },
  usage: { label: "Usage limit alerts", desc: "Warnings at 70%, 85% and 100% of your monthly events." },
  conversions: { label: "Conversion alerts", desc: "A note each time a conversion is recorded." }
};
function Row({ title, desc, children }) {
  return /* @__PURE__ */ jsxs("div", { className: "grid gap-3 border-t border-line py-5 first:border-t-0 first:pt-0 sm:grid-cols-3", children: [
    /* @__PURE__ */ jsxs("div", { className: "sm:col-span-1", children: [
      /* @__PURE__ */ jsx("div", { className: "text-sm font-semibold", children: title }),
      /* @__PURE__ */ jsx("div", { className: "mt-0.5 text-xs text-fg-muted", children: desc })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "sm:col-span-2", children })
  ] });
}
function Settings() {
  var _a, _b, _c;
  const { user, refreshUser } = useAuth();
  const { startTour } = useTour();
  const [tab, setTab] = useState("Profile");
  const [toast, setToast] = useState("");
  const flash = (m) => {
    setToast(m);
    setTimeout(() => setToast(""), 2500);
  };
  const initials = ((((_a = user == null ? void 0 : user.first_name) == null ? void 0 : _a[0]) || "") + (((_b = user == null ? void 0 : user.last_name) == null ? void 0 : _b[0]) || "")).toUpperCase() || (((_c = user == null ? void 0 : user.email) == null ? void 0 : _c[0]) || "?").toUpperCase();
  return /* @__PURE__ */ jsxs("div", { className: "max-w-3xl", children: [
    /* @__PURE__ */ jsx(PageNote, { id: "settings", children: "This is where you manage your own account — your name, password, and which emails you'd like to receive. These settings are personal to you, not the whole team." }),
    /* @__PURE__ */ jsx("h1", { className: "text-2xl font-extrabold tracking-tight", children: "Settings" }),
    /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-fg-muted", children: "Your personal account preferences." }),
    /* @__PURE__ */ jsxs("div", { className: "card shadow-soft mt-6 flex flex-wrap items-center gap-4 p-5", children: [
      /* @__PURE__ */ jsx("div", { className: "grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand/10 text-lg font-extrabold text-brand", children: initials }),
      /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx("span", { className: "truncate text-lg font-bold", children: [user == null ? void 0 : user.first_name, user == null ? void 0 : user.last_name].filter(Boolean).join(" ") || "Your account" }),
          (user == null ? void 0 : user.is_verified) ? /* @__PURE__ */ jsx("span", { className: "rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-emerald-700", children: "Verified" }) : /* @__PURE__ */ jsx("span", { className: "rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-amber-700", children: "Unverified" }),
          (user == null ? void 0 : user.is_staff) && /* @__PURE__ */ jsx("span", { className: "rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand", children: "Staff" })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "truncate text-sm text-fg-muted", children: user == null ? void 0 : user.email })
      ] }),
      /* @__PURE__ */ jsx(Button, { variant: "outline", onClick: startTour, children: "Take the product tour" })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "mt-6 flex gap-1 border-b border-line", children: TABS.map((t) => /* @__PURE__ */ jsx(
      "button",
      {
        onClick: () => setTab(t),
        className: `-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${tab === t ? "border-brand text-brand" : "border-transparent text-fg-muted hover:text-fg"}`,
        children: t
      },
      t
    )) }),
    toast && /* @__PURE__ */ jsx("div", { className: "mt-4 rounded-lg bg-success/10 px-4 py-2 text-sm font-medium text-emerald-700", children: toast }),
    /* @__PURE__ */ jsxs("div", { className: "mt-6", children: [
      tab === "Profile" && /* @__PURE__ */ jsx(ProfileTab, { onSaved: () => {
        refreshUser();
        flash("Profile saved.");
      } }),
      tab === "Security" && /* @__PURE__ */ jsx(SecurityTab, { onSaved: () => flash("Password updated.") }),
      tab === "Notifications" && /* @__PURE__ */ jsx(NotificationsTab, { onSaved: () => {
        refreshUser();
        flash("Preferences saved.");
      } })
    ] })
  ] });
}
const inputCls = "w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
function ProfileTab({ onSaved }) {
  const { user } = useAuth();
  const [f, setF] = useState({
    first_name: (user == null ? void 0 : user.first_name) || "",
    last_name: (user == null ? void 0 : user.last_name) || "",
    timezone: (user == null ? void 0 : user.timezone) || "UTC",
    language: (user == null ? void 0 : user.language) || "en"
  });
  const [busy, setBusy] = useState(false);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await authApi.updateProfile(f);
      onSaved();
    } finally {
      setBusy(false);
    }
  }
  return /* @__PURE__ */ jsxs("form", { onSubmit: save, className: "card shadow-soft p-6", children: [
    /* @__PURE__ */ jsx(Row, { title: "Name", desc: "How you appear across the workspace.", children: /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-3", children: [
      /* @__PURE__ */ jsx(Field, { label: "First name", value: f.first_name, onChange: (v) => setF({ ...f, first_name: v }) }),
      /* @__PURE__ */ jsx(Field, { label: "Last name", value: f.last_name, onChange: (v) => setF({ ...f, last_name: v }) })
    ] }) }),
    /* @__PURE__ */ jsx(Row, { title: "Email", desc: "Used for sign-in and account notices. Contact support to change it.", children: /* @__PURE__ */ jsx("input", { value: user == null ? void 0 : user.email, disabled: true, className: "w-full rounded-xl border border-line bg-bg-mute px-4 py-2.5 text-sm text-fg-muted" }) }),
    /* @__PURE__ */ jsx(Row, { title: "Language", desc: "Preferred display language.", children: /* @__PURE__ */ jsx("select", { value: f.language, onChange: (e) => setF({ ...f, language: e.target.value }), className: inputCls, children: LANGUAGES.map(([v, l]) => /* @__PURE__ */ jsx("option", { value: v, children: l }, v)) }) }),
    /* @__PURE__ */ jsx(Row, { title: "Timezone", desc: "Dates and charts are shown in this timezone.", children: /* @__PURE__ */ jsx("select", { value: f.timezone, onChange: (e) => setF({ ...f, timezone: e.target.value }), className: inputCls, children: TIMEZONES.map((t) => /* @__PURE__ */ jsx("option", { value: t, children: t }, t)) }) }),
    /* @__PURE__ */ jsx("div", { className: "mt-5", children: /* @__PURE__ */ jsx(Button, { type: "submit", disabled: busy, children: busy ? "Saving…" : "Save changes" }) })
  ] });
}
function SecurityTab({ onSaved }) {
  const { user } = useAuth();
  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [cf, setCf] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(e) {
    var _a;
    e.preventDefault();
    setErr("");
    if (nw !== cf) return setErr("New passwords do not match.");
    if (nw.length < 8) return setErr("New password must be at least 8 characters.");
    setBusy(true);
    try {
      await authApi.changePassword(cur, nw);
      setCur("");
      setNw("");
      setCf("");
      onSaved();
    } catch (e2) {
      setErr(((_a = e2.data) == null ? void 0 : _a.detail) || e2.message);
    } finally {
      setBusy(false);
    }
  }
  return /* @__PURE__ */ jsxs("div", { className: "space-y-5", children: [
    /* @__PURE__ */ jsxs("form", { onSubmit: save, className: "card shadow-soft p-6", children: [
      /* @__PURE__ */ jsx("h3", { className: "font-bold", children: "Change password" }),
      /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-fg-muted", children: "Use at least 8 characters. You'll stay signed in on this device." }),
      /* @__PURE__ */ jsxs("div", { className: "mt-4 max-w-md space-y-4", children: [
        /* @__PURE__ */ jsx(Field, { label: "Current password", type: "password", value: cur, onChange: setCur, autoComplete: "current-password" }),
        /* @__PURE__ */ jsx(Field, { label: "New password", type: "password", value: nw, onChange: setNw, autoComplete: "new-password" }),
        /* @__PURE__ */ jsx(Field, { label: "Confirm new password", type: "password", value: cf, onChange: setCf, autoComplete: "new-password" }),
        err && /* @__PURE__ */ jsx("div", { className: "rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600", children: err }),
        /* @__PURE__ */ jsx(Button, { type: "submit", disabled: busy, children: busy ? "Updating…" : "Update password" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "card shadow-soft p-6", children: [
      /* @__PURE__ */ jsx("h3", { className: "font-bold", children: "Account" }),
      /* @__PURE__ */ jsxs("dl", { className: "mt-3 divide-y divide-line text-sm", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between py-2.5", children: [
          /* @__PURE__ */ jsx("dt", { className: "text-fg-muted", children: "Email verified" }),
          /* @__PURE__ */ jsx("dd", { className: "font-semibold", children: (user == null ? void 0 : user.is_verified) ? "Yes" : "No — check your inbox for the link" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between py-2.5", children: [
          /* @__PURE__ */ jsx("dt", { className: "text-fg-muted", children: "Account ID" }),
          /* @__PURE__ */ jsx("dd", { className: "font-mono text-xs", children: user == null ? void 0 : user.id })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between py-2.5", children: [
          /* @__PURE__ */ jsx("dt", { className: "text-fg-muted", children: "Role" }),
          /* @__PURE__ */ jsx("dd", { className: "font-semibold", children: (user == null ? void 0 : user.is_staff) ? "Staff" : "Member" })
        ] })
      ] })
    ] })
  ] });
}
function NotificationsTab({ onSaved }) {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState((user == null ? void 0 : user.notification_prefs) || { email: true, high_risk: true, usage: true, conversions: false });
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await authApi.updateProfile({ notification_prefs: prefs });
      onSaved();
    } finally {
      setBusy(false);
    }
  }
  return /* @__PURE__ */ jsxs("div", { className: "card shadow-soft p-6", children: [
    /* @__PURE__ */ jsx("h3", { className: "font-bold", children: "Email me about…" }),
    /* @__PURE__ */ jsx("div", { className: "mt-2", children: Object.keys(PREF_META).map((k) => /* @__PURE__ */ jsx(Row, { title: PREF_META[k].label, desc: PREF_META[k].desc, children: /* @__PURE__ */ jsx("div", { className: "flex sm:justify-end", children: /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        onClick: () => setPrefs({ ...prefs, [k]: !prefs[k] }),
        className: `h-6 w-11 rounded-full p-0.5 transition ${prefs[k] ? "bg-brand" : "bg-bg-mute"}`,
        children: /* @__PURE__ */ jsx("span", { className: `block h-5 w-5 rounded-full bg-white shadow transition ${prefs[k] ? "translate-x-5" : ""}` })
      }
    ) }) }, k)) }),
    /* @__PURE__ */ jsx("div", { className: "mt-5", children: /* @__PURE__ */ jsx(Button, { onClick: save, disabled: busy, children: busy ? "Saving…" : "Save preferences" }) })
  ] });
}
export {
  Settings as default
};
