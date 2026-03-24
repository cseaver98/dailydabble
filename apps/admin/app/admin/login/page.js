"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<main className="admin-content"><section className="admin-card"><h1 className="admin-title">Loading login…</h1></section></main>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const nextPath = searchParams.get("next");
  const destination = nextPath && nextPath.startsWith("/") ? nextPath : "/admin/agegaple";

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error || "Login failed");
        return;
      }

      router.replace(destination);
      router.refresh();
    } catch {
      setError("Could not sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="admin-content" style={{ maxWidth: 560, margin: "2.5rem auto" }}>
      <section className="admin-card">
        <h1 className="admin-title">DailyDabble Admin Login</h1>
        <p className="admin-copy">Enter your admin passcode to continue.</p>
        <form onSubmit={onSubmit} style={{ marginTop: "1rem", display: "grid", gap: ".65rem" }}>
          <label style={{ display: "grid", gap: ".35rem", fontWeight: 700 }}>
            Passcode
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              style={{ borderRadius: 10, border: "1px solid #d8dce2", padding: ".6rem .7rem" }}
            />
          </label>
          <button className="admin-btn primary" type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        {error ? <p style={{ marginTop: ".8rem", color: "#b42318", fontWeight: 700 }}>{error}</p> : null}
      </section>
    </main>
  );
}
