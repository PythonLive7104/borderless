import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTour } from "../../context/TourContext";
import { authApi, type NotificationPrefs } from "../../lib/api";
import Button from "../../components/ui/Button";
import Field from "../../components/auth/Field";
import PageNote from "../../components/dashboard/PageNote";

const TABS = ["Profile", "Security", "Notifications"] as const;
type Tab = typeof TABS[number];

const TIMEZONES = ["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Africa/Lagos", "Asia/Dubai", "Asia/Singapore"];
const LANGUAGES: [string, string][] = [
  ["en", "English"], ["es", "Español"], ["fr", "Français"], ["de", "Deutsch"],
  ["pt", "Português"], ["ru", "Русский"], ["zh", "中文"], ["ar", "العربية"],
];
const PREF_META: Record<keyof NotificationPrefs, { label: string; desc: string }> = {
  email: { label: "Email notifications", desc: "Master switch for all account emails." },
  high_risk: { label: "High-risk traffic alerts", desc: "Get notified when bot or fraud spikes are detected." },
  usage: { label: "Usage limit alerts", desc: "Warnings at 70%, 85% and 100% of your monthly events." },
  conversions: { label: "Conversion alerts", desc: "A note each time a conversion is recorded." },
};

// A modern section row: description on the left, control on the right.
function Row({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-3 border-t border-line py-5 first:border-t-0 first:pt-0 sm:grid-cols-3">
      <div className="sm:col-span-1">
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-0.5 text-xs text-fg-muted">{desc}</div>
      </div>
      <div className="sm:col-span-2">{children}</div>
    </div>
  );
}

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const { startTour } = useTour();
  const [tab, setTab] = useState<Tab>("Profile");
  const [toast, setToast] = useState("");
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2500); };
  const initials = ((user?.first_name?.[0] || "") + (user?.last_name?.[0] || "")).toUpperCase() || (user?.email?.[0] || "?").toUpperCase();

  return (
    <div className="max-w-3xl">
      <PageNote id="settings">
        This is where you manage your own account — your name, password, and which emails you'd like to receive. These settings are personal to you, not the whole team.
      </PageNote>
      <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-fg-muted">Your personal account preferences.</p>

      {/* identity header */}
      <div className="card shadow-soft mt-6 flex flex-wrap items-center gap-4 p-5">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand/10 text-lg font-extrabold text-brand">{initials}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-lg font-bold">{[user?.first_name, user?.last_name].filter(Boolean).join(" ") || "Your account"}</span>
            {user?.is_verified ? (
              <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-emerald-700">Verified</span>
            ) : (
              <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-amber-700">Unverified</span>
            )}
            {user?.is_staff && <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">Staff</span>}
          </div>
          <div className="truncate text-sm text-fg-muted">{user?.email}</div>
        </div>
        <Button variant="outline" onClick={startTour}>Take the product tour</Button>
      </div>

      <div className="mt-6 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${tab === t ? "border-brand text-brand" : "border-transparent text-fg-muted hover:text-fg"}`}>{t}</button>
        ))}
      </div>

      {toast && <div className="mt-4 rounded-lg bg-success/10 px-4 py-2 text-sm font-medium text-emerald-700">{toast}</div>}

      <div className="mt-6">
        {tab === "Profile" && <ProfileTab onSaved={() => { refreshUser(); flash("Profile saved."); }} />}
        {tab === "Security" && <SecurityTab onSaved={() => flash("Password updated.")} />}
        {tab === "Notifications" && <NotificationsTab onSaved={() => { refreshUser(); flash("Preferences saved."); }} />}
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

function ProfileTab({ onSaved }: { onSaved: () => void }) {
  const { user } = useAuth();
  const [f, setF] = useState({
    first_name: user?.first_name || "", last_name: user?.last_name || "",
    timezone: user?.timezone || "UTC", language: user?.language || "en",
  });
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await authApi.updateProfile(f); onSaved(); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={save} className="card shadow-soft p-6">
      <Row title="Name" desc="How you appear across the workspace.">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" value={f.first_name} onChange={(v) => setF({ ...f, first_name: v })} />
          <Field label="Last name" value={f.last_name} onChange={(v) => setF({ ...f, last_name: v })} />
        </div>
      </Row>
      <Row title="Email" desc="Used for sign-in and account notices. Contact support to change it.">
        <input value={user?.email} disabled className="w-full rounded-xl border border-line bg-bg-mute px-4 py-2.5 text-sm text-fg-muted" />
      </Row>
      <Row title="Language" desc="Preferred display language.">
        <select value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })} className={inputCls}>
          {LANGUAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Row>
      <Row title="Timezone" desc="Dates and charts are shown in this timezone.">
        <select value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })} className={inputCls}>
          {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Row>
      <div className="mt-5"><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button></div>
    </form>
  );
}

function SecurityTab({ onSaved }: { onSaved: () => void }) {
  const { user } = useAuth();
  const [cur, setCur] = useState(""); const [nw, setNw] = useState(""); const [cf, setCf] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    if (nw !== cf) return setErr("New passwords do not match.");
    if (nw.length < 8) return setErr("New password must be at least 8 characters.");
    setBusy(true);
    try { await authApi.changePassword(cur, nw); setCur(""); setNw(""); setCf(""); onSaved(); }
    catch (e: any) { setErr(e.data?.detail || e.message); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-5">
      <form onSubmit={save} className="card shadow-soft p-6">
        <h3 className="font-bold">Change password</h3>
        <p className="mt-1 text-xs text-fg-muted">Use at least 8 characters. You'll stay signed in on this device.</p>
        <div className="mt-4 max-w-md space-y-4">
          <Field label="Current password" type="password" value={cur} onChange={setCur} autoComplete="current-password" />
          <Field label="New password" type="password" value={nw} onChange={setNw} autoComplete="new-password" />
          <Field label="Confirm new password" type="password" value={cf} onChange={setCf} autoComplete="new-password" />
          {err && <div className="rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600">{err}</div>}
          <Button type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</Button>
        </div>
      </form>

      <div className="card shadow-soft p-6">
        <h3 className="font-bold">Account</h3>
        <dl className="mt-3 divide-y divide-line text-sm">
          <div className="flex items-center justify-between py-2.5"><dt className="text-fg-muted">Email verified</dt>
            <dd className="font-semibold">{user?.is_verified ? "Yes" : "No — check your inbox for the link"}</dd></div>
          <div className="flex items-center justify-between py-2.5"><dt className="text-fg-muted">Account ID</dt>
            <dd className="font-mono text-xs">{user?.id}</dd></div>
          <div className="flex items-center justify-between py-2.5"><dt className="text-fg-muted">Role</dt>
            <dd className="font-semibold">{user?.is_staff ? "Staff" : "Member"}</dd></div>
        </dl>
      </div>
    </div>
  );
}

function NotificationsTab({ onSaved }: { onSaved: () => void }) {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>(user?.notification_prefs || { email: true, high_risk: true, usage: true, conversions: false });
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try { await authApi.updateProfile({ notification_prefs: prefs }); onSaved(); } finally { setBusy(false); }
  }
  return (
    <div className="card shadow-soft p-6">
      <h3 className="font-bold">Email me about…</h3>
      <div className="mt-2">
        {(Object.keys(PREF_META) as (keyof NotificationPrefs)[]).map((k) => (
          <Row key={k} title={PREF_META[k].label} desc={PREF_META[k].desc}>
            <div className="flex sm:justify-end">
              <button type="button" onClick={() => setPrefs({ ...prefs, [k]: !prefs[k] })}
                className={`h-6 w-11 rounded-full p-0.5 transition ${prefs[k] ? "bg-brand" : "bg-bg-mute"}`}>
                <span className={`block h-5 w-5 rounded-full bg-white shadow transition ${prefs[k] ? "translate-x-5" : ""}`} />
              </button>
            </div>
          </Row>
        ))}
      </div>
      <div className="mt-5"><Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save preferences"}</Button></div>
    </div>
  );
}
