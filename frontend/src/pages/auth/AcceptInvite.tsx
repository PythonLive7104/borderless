import { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import AuthLayout from "../../components/auth/AuthLayout";
import Button from "../../components/ui/Button";
import { orgApi } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [state, setState] = useState<"idle" | "working" | "ok" | "fail">("idle");
  const [msg, setMsg] = useState("");

  // must be logged in (as the invited email) to accept
  useEffect(() => {
    if (!loading && !user) nav(`/login?next=/accept-invite?token=${token}`);
  }, [loading, user, token, nav]);

  async function accept() {
    setState("working"); setMsg("");
    try {
      const r: any = await orgApi.acceptInvite(token);
      setMsg(r?.organization ? `You've joined ${r.organization}.` : "Invitation accepted.");
      setState("ok");
    } catch (e: any) {
      setMsg(e.data?.detail || "This invitation is invalid or has expired.");
      setState("fail");
    }
  }

  return (
    <AuthLayout title="Team invitation" subtitle="Join a Borderless workspace."
      footer={<Link to="/dashboard" className="font-semibold text-brand">Go to dashboard</Link>}>
      {state === "ok" ? (
        <div className="rounded-xl border border-success/25 bg-success/5 p-5 text-sm text-emerald-700">{msg}
          <div className="mt-4"><Button to="/dashboard" className="w-full">Open dashboard</Button></div>
        </div>
      ) : state === "fail" ? (
        <div className="rounded-xl border border-danger/25 bg-danger/5 p-5 text-sm text-red-600">{msg}</div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-fg-muted">You're signed in as <b>{user?.email}</b>. Accept the invitation to join the workspace.</p>
          <Button onClick={accept} className="w-full">{state === "working" ? "Joining…" : "Accept invitation"}</Button>
        </div>
      )}
    </AuthLayout>
  );
}
