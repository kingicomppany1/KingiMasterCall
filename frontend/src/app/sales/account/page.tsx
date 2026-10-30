"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export default function Account() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState("");
  const [bad, setBad] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBad(true);
    if (pw.length < 8) return setMsg("Use at least 8 characters");
    if (pw !== pw2) return setMsg("Passwords do not match");
    const { error } = await createClient().auth.updateUser({ password: pw });
    if (error) return setMsg(error.message);
    setBad(false);
    setMsg("Password changed");
    setPw("");
    setPw2("");
  }

  return (
    <>
      <h1>Change password</h1>
      <p className="sub">Choose a new password for your own login.</p>
      <form className="card" onSubmit={submit} style={{ maxWidth: 380 }}>
        <label htmlFor="pw">New password</label>
        <input id="pw" type="password" required value={pw} onChange={(e) => setPw(e.target.value)} />
        <label htmlFor="pw2">Repeat new password</label>
        <input id="pw2" type="password" required value={pw2} onChange={(e) => setPw2(e.target.value)} />
        <div style={{ marginTop: 16 }}>
          <button className="primary">Change password</button>
        </div>
        {msg && <div className={bad ? "err" : "muted"} style={{ marginTop: 8 }}>{msg}</div>}
      </form>
    </>
  );
}
