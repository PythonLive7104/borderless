import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../../components/auth/AuthLayout";
import Field from "../../components/auth/Field";
import Button from "../../components/ui/Button";
import { useAuth } from "../../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    try { await login(email, password); nav("/dashboard"); }
    catch (e: any) { setErr(e.status === 401 ? "Invalid email or password." : e.message); }
    finally { setBusy(false); }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your Borderless workspace."
      footer={<>Don't have an account? <Link to="/signup" className="font-semibold text-brand">Create one</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Work email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" autoComplete="email" />
        <div>
          <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" autoComplete="current-password" />
          <div className="mt-1.5 text-right"><Link to="/forgot-password" className="text-xs font-medium text-brand hover:underline">Forgot password?</Link></div>
        </div>
        {err && <div className="rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600">{err}</div>}
        <Button type="submit" className="w-full">{busy ? "Signing in…" : "Sign in"}</Button>
      </form>
    </AuthLayout>
  );
}
