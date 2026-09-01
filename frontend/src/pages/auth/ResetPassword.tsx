import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import AuthLayout from "../../components/auth/AuthLayout";
import Field from "../../components/auth/Field";
import Button from "../../components/ui/Button";
import { authApi } from "../../lib/api";

export default function ResetPassword() {
  const { token = "" } = useParams();
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    if (password !== confirm) return setErr("Passwords do not match.");
    if (password.length < 8) return setErr("Password must be at least 8 characters.");
    setBusy(true);
    try { await authApi.resetPassword(token, password); nav("/login"); }
    catch (e: any) { setErr(e.data?.detail || "This reset link is invalid or has expired."); }
    finally { setBusy(false); }
  }

  return (
    <AuthLayout title="Set a new password" subtitle="Choose a strong password you don't use elsewhere."
      footer={<Link to="/login" className="font-semibold text-brand">Back to sign in</Link>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password" type="password" value={password} onChange={setPassword} placeholder="At least 8 characters" autoComplete="new-password" />
        <Field label="Confirm password" type="password" value={confirm} onChange={setConfirm} placeholder="Re-enter password" autoComplete="new-password" />
        {err && <div className="rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600">{err}</div>}
        <Button type="submit" className="w-full">{busy ? "Updating…" : "Update password"}</Button>
      </form>
    </AuthLayout>
  );
}
