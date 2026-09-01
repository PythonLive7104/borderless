import { useState, type ReactNode } from "react";
import { useAuth } from "../../context/AuthContext";
import { authApi } from "../../lib/api";
import Button from "../ui/Button";

// Blocks the app until the signed-in user confirms their email.
export default function VerifyEmailGate({ children }: { children: ReactNode }) {
  const { user, refreshUser, logout } = useAuth();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user || user.is_verified) return <>{children}</>;

  async function resend() {
    setBusy(true); setMsg("");
    try {
      const r = await authApi.resendVerification();
      setMsg(r.detail || "Verification email sent.");
    } catch {
      setMsg("Couldn't send right now — please try again in a moment.");
    } finally { setBusy(false); }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-bg-soft px-4">
      <div className="card shadow-soft w-full max-w-md p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-2xl">✉️</div>
        <h1 className="mt-4 text-xl font-extrabold tracking-tight">Confirm your email</h1>
        <p className="mt-2 text-sm text-fg-muted">
          We sent a confirmation link to <b className="text-fg">{user.email}</b>. Click it to activate your account and start using the dashboard.
        </p>
        {msg && <p className="mt-4 rounded-lg bg-success/10 px-4 py-2 text-sm text-emerald-700">{msg}</p>}
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={resend} disabled={busy}>{busy ? "Sending…" : "Resend the email"}</Button>
          <button onClick={() => refreshUser()} className="rounded-full px-4 py-2 text-sm font-semibold text-brand hover:underline">
            I've confirmed — continue
          </button>
        </div>
        <button onClick={logout} className="mt-4 text-xs text-fg-dim hover:text-fg-muted">Sign out</button>
        <p className="mt-4 text-xs text-fg-dim">Wrong address or no email? Check spam, or resend above.</p>
      </div>
    </div>
  );
}
