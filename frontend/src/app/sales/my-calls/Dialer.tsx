"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { OUTCOMES, fmtDuration, type OutcomeValue } from "@/lib/common";
import { api } from "@/lib/api";

export type ContactRow = {
  id: string;
  company: string;
  name: string | null;
  title: string | null;
  phone: string;
  switchboard: string;
  linkedin: string | null;
  status: string;
  callback_at: string | null;
  call_attempts: number;
};
type Pending = { id: string; number: string; duration_sec: number; answered: boolean; contact_id: string };
type Phase = "idle" | "connecting" | "in-call" | "ended";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ATClient = any;

export default function Dialer({ contacts, disabled, onChanged }: { contacts: ContactRow[]; disabled: boolean; onChanged: () => void }) {
  const clientRef = useRef<ATClient>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [active, setActive] = useState<ContactRow | null>(null);
  const [muted, setMuted] = useState(false);
  const [secs, setSecs] = useState(0);
  const [pending, setPending] = useState<Pending | null>(null);
  const [err, setErr] = useState("");

  // outcome form
  const [outcome, setOutcome] = useState<OutcomeValue | "">("");
  const [callbackAt, setCallbackAt] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const checkPending = useCallback(async () => {
    try {
      const j = await api<{ pending: Pending | null }>("/calls/pending");
      setPending(j.pending);
      return j.pending;
    } catch {
      return null;
    }
  }, []);

  // On load: if a previous call still needs an outcome, force it
  useEffect(() => {
    checkPending();
  }, [checkPending]);

  useEffect(() => {
    if (phase !== "in-call") return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // After hangup the AT webhook writes the log; poll until it shows up
  async function waitForLog() {
    for (let i = 0; i < 20; i++) {
      const p = await checkPending();
      if (p) return;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  async function startCall(c: ContactRow, kind: "phone" | "switchboard") {
    setErr("");
    setPhase("connecting");
    setActive(c);
    setSecs(0);
    setMuted(false);
    try {
      const j = await api<{ session_id: string; token: string }>("/calls/start", {
        method: "POST",
        json: { contact_id: c.id, kind },
      });

      const mod = await import("africastalking-client");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AT: any = (mod as any).default ?? mod;
      const client: ATClient = new AT.Client(j.token);
      clientRef.current = client;
      client.on("callaccepted", () => setPhase("in-call"));
      client.on("hangup", () => {
        setPhase("ended");
        client.close?.();
        waitForLog();
      });
      client.on("closed", () => {});
      // The session id is all the browser sends; the server resolves the real number.
      client.call(j.session_id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Call failed");
      setPhase("idle");
      setActive(null);
    }
  }

  function hangup() {
    clientRef.current?.hangup?.();
  }
  function toggleMute() {
    const c = clientRef.current;
    if (!c) return;
    if (muted) c.unmuteAudio?.();
    else c.muteAudio?.();
    setMuted(!muted);
  }

  async function saveOutcome(e: React.FormEvent) {
    e.preventDefault();
    if (!pending || !outcome) return;
    setSaving(true);
    setErr("");
    try {
      await api("/calls/outcome", {
        method: "POST",
        json: {
          call_log_id: pending.id,
          outcome,
          callback_at: callbackAt ? new Date(callbackAt).toISOString() : null,
          notes,
        },
      });
    } catch (e) {
      setSaving(false);
      return setErr(e instanceof Error ? e.message : "Could not save");
    }
    setSaving(false);
    setPending(null);
    setOutcome("");
    setCallbackAt("");
    setNotes("");
    setPhase("idle");
    setActive(null);
    onChanged();
  }

  const busy = phase === "connecting" || phase === "in-call";
  const needOutcome = !!pending && !busy;

  return (
    <div>
      {(busy || phase === "ended") && active && (
        <div className="card callbar">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <strong>{active.company}</strong> {active.name && <>· {active.name}</>}
              <div className="muted num">
                {phase === "connecting" && "Connecting…"}
                {phase === "in-call" && `In call ${fmtDuration(secs)}`}
                {phase === "ended" && "Call ended"}
              </div>
            </div>
            {busy && (
              <div className="row">
                <button onClick={toggleMute} disabled={phase !== "in-call"}>{muted ? "Unmute" : "Mute"}</button>
                <button className="danger" onClick={hangup}>Hang up</button>
              </div>
            )}
          </div>
        </div>
      )}

      {needOutcome && (
        <form className="card" onSubmit={saveOutcome}>
          <h2>Call outcome (required)</h2>
          <p className="muted">
            {pending!.number} · {pending!.answered ? `answered, ${fmtDuration(pending!.duration_sec)}` : "not answered"}
          </p>
          <div className="chips">
            {OUTCOMES.map((o) => (
              <button type="button" key={o.value} className={outcome === o.value ? "primary" : ""} onClick={() => setOutcome(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
          {outcome === "call_back" && (
            <>
              <label htmlFor="cb">Call back on</label>
              <input id="cb" type="datetime-local" required value={callbackAt} onChange={(e) => setCallbackAt(e.target.value)} />
            </>
          )}
          <label htmlFor="notes">Notes</label>
          <textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div style={{ marginTop: 12 }}>
            <button className="primary" disabled={!outcome || saving}>{saving ? "Saving…" : "Save outcome"}</button>
          </div>
        </form>
      )}

      {phase === "ended" && !pending && <div className="banner">Waiting for the call record from Africa&apos;s Talking…</div>}
      {err && <div className="err">{err}</div>}

      <div className="card">
        <h2>Today&apos;s call list ({contacts.length})</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Company</th><th>Contact</th><th>Phone</th><th>Switchboard</th><th></th></tr>
            </thead>
            <tbody>
              {contacts.length === 0 && (
                <tr><td colSpan={5} className="muted">No contacts assigned yet.</td></tr>
              )}
              {contacts.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.company}</strong>
                    {c.status === "callback" && <div><span className="pill warn">Call back due</span></div>}
                    {c.linkedin && <div><a href={c.linkedin} target="_blank" rel="noreferrer">LinkedIn</a></div>}
                  </td>
                  <td>{c.name}<div className="muted">{c.title}</div></td>
                  <td className="num">{c.phone || "—"}</td>
                  <td className="num">{c.switchboard || "—"}</td>
                  <td>
                    <div className="row">
                      <button className="call" disabled={disabled || busy || needOutcome || !c.phone} onClick={() => startCall(c, "phone")}>Call</button>
                      <button disabled={disabled || busy || needOutcome || !c.switchboard} onClick={() => startCall(c, "switchboard")}>Switchboard</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
