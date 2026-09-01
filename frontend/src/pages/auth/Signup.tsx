import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../../components/auth/AuthLayout";
import Field from "../../components/auth/Field";
import Button from "../../components/ui/Button";
import { useAuth } from "../../context/AuthContext";

export default function Signup() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ first_name: "", last_name: "", email: "", password: "", confirm: "" });
  const [terms, setTerms] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    if (f.password !== f.confirm) return setErr("Passwords do not match.");
    if (f.password.length < 8) return setErr("Password must be at least 8 characters.");
    if (!terms) return setErr("Please accept the terms to continue.");
    setBusy(true);
    try { await register({ first_name: f.first_name, last_name: f.last_name, email: f.email, password: f.password }); nav("/dashboard"); }
    catch (e: any) {
      const d = e.data;
      setErr(d?.email?.[0] || d?.password?.[0] || e.message || "Could not create account.");
    } finally { setBusy(false); }
  }

  return (
    <AuthLayout title="Create your account" subtitle="Start protecting your traffic in minutes."
      footer={<>Already have an account? <Link to="/login" className="font-semibold text-brand">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" value={f.first_name} onChange={set("first_name")} placeholder="Jane" autoComplete="given-name" />
          <Field label="Last name" value={f.last_name} onChange={set("last_name")} placeholder="Marketer" autoComplete="family-name" />
        </div>
        <Field label="Work email" type="email" value={f.email} onChange={set("email")} placeholder="you@company.com" autoComplete="email" />
        <Field label="Password" type="password" value={f.password} onChange={set("password")} placeholder="At least 8 characters" autoComplete="new-password" />
        <Field label="Confirm password" type="password" value={f.confirm} onChange={set("confirm")} placeholder="Re-enter password" autoComplete="new-password" />
        <label className="flex items-start gap-2.5 text-sm text-fg-muted">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand" />
          <span>I agree to the <Link to="/terms" className="text-brand hover:underline">Terms</Link> and <Link to="/privacy" className="text-brand hover:underline">Privacy Policy</Link>.</span>
        </label>
        {err && <div className="rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600">{err}</div>}
        <Button type="submit" className="w-full">{busy ? "Creating account…" : "Create account"}</Button>
      </form>
    </AuthLayout>
  );
}
