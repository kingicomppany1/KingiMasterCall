"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import ThemeToggle from "@/components/ThemeToggle";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="auth">
      <div className="theme-corner"><ThemeToggle /></div>
      <form className="card login" onSubmit={submit}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/logo.png" alt="KingiMaster logo" />
        <h1>KingiMaster</h1>
        <p className="sub">Sign in to the Sales Team dashboard</p>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="pw">Password</label>
        <input id="pw" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <div style={{ marginTop: 18 }}>
          <button className="primary" disabled={busy} style={{ width: "100%", padding: "9px 13px" }}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </div>
        {err && <div className="err">{err}</div>}
      </form>
    </div>
  );
}
