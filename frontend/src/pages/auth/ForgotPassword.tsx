import { useState } from "react";
import { Link } from "react-router-dom";
import AuthLayout from "../../components/auth/AuthLayout";
import Field from "../../components/auth/Field";
import Button from "../../components/ui/Button";
import { authApi } from "../../lib/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await authApi.forgotPassword(email); } catch { /* never reveal existence */ }
    finally { setBusy(false); setSent(true); }
  }

  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a secure reset link."
      footer={<>Remembered it? <Link to="/login" className="font-semibold text-brand">Back to sign in</Link></>}>
      {sent ? (
        <div className="rounded-xl border border-success/25 bg-success/5 p-5 text-sm text-emerald-700">
          If an account exists for <b>{email}</b>, a reset link is on its way. Check your inbox.
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Work email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" autoComplete="email" />
          <Button type="submit" className="w-full">{busy ? "Sending…" : "Send reset link"}</Button>
        </form>
      )}
    </AuthLayout>
  );
}
