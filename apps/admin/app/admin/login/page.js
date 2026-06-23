"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<main className="admin-content"><section className="admin-card"><h1 className="admin-title">Loading login…</h1></section></main>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const destination = nextPath && nextPath.startsWith("/") ? nextPath : "/admin/agegaple";
  const error = searchParams.get("error");
  const signInHref = `/api/admin/google/start?next=${encodeURIComponent(destination)}`;

  return (
    <main className="admin-content" style={{ maxWidth: 560, margin: "2.5rem auto" }}>
      <section className="admin-card">
        <h1 className="admin-title">DailyDabble Admin Login</h1>
        <p className="admin-copy">Sign in with the allowlisted Google account to continue.</p>
        <a className="admin-btn primary" href={signInHref} style={{ width: "100%", marginTop: "1rem", justifyContent: "center" }}>
          Continue with Google
        </a>
        {error ? <p style={{ marginTop: ".8rem", color: "#b42318", fontWeight: 700 }}>{error}</p> : null}
      </section>
    </main>
  );
}
