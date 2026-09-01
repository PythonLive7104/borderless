import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AuthLayout from "../../components/auth/AuthLayout";
import { authApi } from "../../lib/api";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<"working" | "ok" | "fail">(token ? "working" : "fail");

  useEffect(() => {
    if (!token) return;
    authApi.verifyEmail(token).then(() => setState("ok")).catch(() => setState("fail"));
  }, [token]);

  const map = {
    working: { t: "Verifying your email…", s: "One moment while we confirm your link." },
    ok: { t: "Email verified 🎉", s: "Your email is confirmed. You can now sign in." },
    fail: { t: "Verification failed", s: "This link is invalid or has expired. Request a new one from your dashboard." },
  }[state];

  return (
    <AuthLayout title={map.t} subtitle={map.s}
      footer={<Link to="/login" className="font-semibold text-brand">Go to sign in</Link>}>
      <div className="flex justify-center py-4">
        {state === "working" && <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />}
        {state === "ok" && <div className="grid h-14 w-14 place-items-center rounded-full bg-success/10 text-success"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg></div>}
        {state === "fail" && <div className="grid h-14 w-14 place-items-center rounded-full bg-danger/10 text-danger"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg></div>}
      </div>
    </AuthLayout>
  );
}
