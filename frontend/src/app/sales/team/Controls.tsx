"use client";
import { useEffect, useRef, useState } from "react";
import { Search, UploadCloud } from "lucide-react";
import { ngn } from "@/lib/common";
import { api } from "@/lib/api";
import { Alert, Card, EmptyState, Field, Pill } from "@/components/ui";

async function send(url: string, method: string, body: unknown) {
  try {
    return { ok: true, j: await api<Record<string, unknown>>(url, { method, json: body }) };
  } catch (e) {
    return { ok: false, j: { error: e instanceof Error ? e.message : "Failed" } as Record<string, unknown> };
  }
}

type Note = { tone: "ok" | "bad"; text: string } | null;

/** Message that clears itself after a few seconds. */
function useNote() {
  const [note, setNote] = useState<Note>(null);
  useEffect(() => {
    if (!note || note.tone === "bad") return;
    const t = setTimeout(() => setNote(null), 4000);
    return () => clearTimeout(t);
  }, [note]);
  return [note, setNote] as const;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function AgentControls({
  agent,
  spent,
  onChanged,
}: {
  onChanged: () => void;
  agent: { id: string; name: string; active: boolean; daily: number; monthly: number };
  spent: number;
}) {
  const [daily, setDaily] = useState(String(agent.daily));
  const [monthly, setMonthly] = useState(String(agent.monthly));
  const [note, setNote] = useNote();
  const [dialog, setDialog] = useState<"off" | "pw" | null>(null);
  const [pw, setPw] = useState("");
  const dirty = Number(daily) !== agent.daily || Number(monthly) !== agent.monthly;
  const pct = agent.monthly > 0 ? Math.min(100, Math.round((spent / agent.monthly) * 100)) : 0;

  async function save(patch: Record<string, unknown>, okText = "Saved") {
    const { ok, j } = await send(`/admin/agents/${agent.id}`, "PATCH", patch);
    setNote(ok ? { tone: "ok", text: okText } : { tone: "bad", text: String(j.error) });
    onChanged();
  }
  async function resetPw(e: React.FormEvent) {
    e.preventDefault();
    const { ok, j } = await send(`/admin/agents/${agent.id}/reset-password`, "POST", { password: pw });
    setNote(ok ? { tone: "ok", text: "Password reset" } : { tone: "bad", text: String(j.error) });
    if (ok) { setDialog(null); setPw(""); }
  }

  return (
    <tr>
      <td><strong>{agent.name}</strong></td>
      <td style={{ minWidth: 150 }}>
        <span className="num">{ngn(spent)}</span>
        {agent.monthly > 0 && (
          <div className={`progress${pct >= 90 ? " bad" : pct >= 70 ? " warn" : ""}`} title={`${pct}% of monthly cap`}>
            <span style={{ width: `${pct}%` }} />
          </div>
        )}
      </td>
      <td><input type="number" min={0} aria-label={`${agent.name} daily cap`} value={daily} onChange={(e) => setDaily(e.target.value)} style={{ width: 110 }} /></td>
      <td><input type="number" min={0} aria-label={`${agent.name} monthly cap`} value={monthly} onChange={(e) => setMonthly(e.target.value)} style={{ width: 120 }} /></td>
      <td>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <button
            role="switch" aria-checked={agent.active} aria-label={`Calling for ${agent.name}`} className="switch"
            onClick={() => (agent.active ? setDialog("off") : save({ active: true }, "Calling switched on"))}
          />
          <span className={agent.active ? "" : "muted"}>{agent.active ? "On" : "Off"}</span>
        </div>
      </td>
      <td>
        <div className="row" style={{ flexWrap: "nowrap", justifyContent: "flex-end" }}>
          {note && <span className={note.tone === "ok" ? "pill ok" : "pill bad"} role="status">{note.text}</span>}
          <button className={dirty ? "primary" : ""} disabled={!dirty}
            onClick={() => save({ daily_cap_ngn: Number(daily), monthly_cap_ngn: Number(monthly) }, "Caps saved")}>
            Save caps
          </button>
          <button onClick={() => setDialog("pw")}>Reset password</button>
        </div>

        {dialog === "off" && (
          <Modal title={`Switch off calling for ${agent.name}?`} onClose={() => setDialog(null)}>
            <p className="muted" style={{ margin: 0 }}>They won&apos;t be able to start new calls until you switch it back on.</p>
            <div className="modal-actions">
              <button onClick={() => setDialog(null)}>Cancel</button>
              <button className="danger" onClick={() => { setDialog(null); save({ active: false }, "Calling switched off"); }}>Switch off</button>
            </div>
          </Modal>
        )}
        {dialog === "pw" && (
          <Modal title={`Reset password for ${agent.name}`} onClose={() => { setDialog(null); setPw(""); }}>
            <form onSubmit={resetPw}>
              <Field label="New temporary password" hint="At least 8 characters.">
                <input type="password" minLength={8} required autoFocus value={pw} onChange={(e) => setPw(e.target.value)} />
              </Field>
              <div className="modal-actions">
                <button type="button" onClick={() => { setDialog(null); setPw(""); }}>Cancel</button>
                <button className="primary">Reset password</button>
              </div>
            </form>
          </Modal>
        )}
      </td>
    </tr>
  );
}

export function NewAgentForm({ onChanged }: { onChanged: () => void }) {
  const [f, setF] = useState({ fullName: "", email: "", password: "" });
  const [note, setNote] = useNote();
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { ok, j } = await send("/admin/agents", "POST", { email: f.email, password: f.password, full_name: f.fullName });
    setBusy(false);
    setNote(ok ? { tone: "ok", text: `Agent ${f.fullName} created` } : { tone: "bad", text: String(j.error) });
    if (ok) {
      setF({ fullName: "", email: "", password: "" });
      onChanged();
    }
  }
  return (
    <Card title="Add agent" subtitle="Creates a login. Share the temporary password with them; they can change it after signing in.">
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Full name">
            <input required placeholder="e.g. Ada Obi" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} />
          </Field>
          <Field label="Email">
            <input type="email" required placeholder="ada@company.com" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label="Temporary password" hint="At least 8 characters">
            <input type="password" minLength={8} required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          </Field>
          <div style={{ paddingBottom: 21 }}><button className="primary" disabled={busy}>{busy ? "Creating…" : "Create agent"}</button></div>
        </div>
        {note && <Alert tone={note.tone}>{note.text}</Alert>}
      </form>
    </Card>
  );
}

export function AssignPanel({
  companies,
  agents,
  onChanged,
}: {
  onChanged: () => void;
  companies: { key: string; name: string; contacts: number; owner: string | null }[];
  agents: { id: string; name: string }[];
}) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [agentId, setAgentId] = useState("");
  const [onlyFree, setOnlyFree] = useState(true);
  const [q, setQ] = useState("");
  const [note, setNote] = useNote();
  const shown = companies.filter((c) => (!onlyFree || !c.owner) && c.name.toLowerCase().includes(q.trim().toLowerCase()));
  const allShown = shown.length > 0 && shown.every((c) => sel.has(c.key));

  async function assign(toAgent: string | null) {
    const { ok, j } = await send("/admin/assign", "POST", { agent_id: toAgent, company_keys: [...sel] });
    setNote(ok ? { tone: "ok", text: `${toAgent ? "Assigned" : "Unassigned"} ${sel.size} compan${sel.size === 1 ? "y" : "ies"}` } : { tone: "bad", text: String(j.error) });
    if (ok) {
      setSel(new Set());
      onChanged();
    }
  }
  function toggleAll(on: boolean) {
    const n = new Set(sel);
    shown.forEach((c) => (on ? n.add(c.key) : n.delete(c.key)));
    setSel(n);
  }

  return (
    <Card title="Assign companies" subtitle="A company belongs to one agent only; assigning moves it." flush>
      <div style={{ padding: "0 20px 14px" }}>
        <div className="search">
          <Search size={15} />
          <input type="search" aria-label="Search companies" placeholder="Search companies…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <select aria-label="Agent to assign to" value={agentId} onChange={(e) => setAgentId(e.target.value)} style={{ width: 190 }}>
            <option value="">Choose agent…</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button className="primary" disabled={!agentId || !sel.size} onClick={() => assign(agentId)}>Assign{sel.size ? ` ${sel.size}` : ""}</button>
          <button disabled={!sel.size} onClick={() => assign(null)}>Unassign</button>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0 0", color: "var(--ink)" }}>
          <input type="checkbox" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} style={{ width: "auto" }} /> Show unassigned only
        </label>
        {note && <Alert tone={note.tone}>{note.text}</Alert>}
      </div>
      <div className="table-wrap" style={{ maxHeight: 360, overflowY: "auto" }}>
        {shown.length > 0 && (
          <table>
            <thead>
              <tr>
                <th style={{ width: 28 }}>
                  <input type="checkbox" aria-label="Select all shown" checked={allShown} onChange={(e) => toggleAll(e.target.checked)} style={{ width: "auto" }} />
                </th>
                <th>Company</th><th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.key}>
                  <td style={{ width: 28 }}>
                    <input type="checkbox" aria-label={`Select ${c.name}`} checked={sel.has(c.key)} style={{ width: "auto" }}
                      onChange={(e) => { const n = new Set(sel); if (e.target.checked) n.add(c.key); else n.delete(c.key); setSel(n); }} />
                  </td>
                  <td>{c.name} <span className="muted">· {c.contacts} contact{c.contacts > 1 ? "s" : ""}</span></td>
                  <td>{c.owner ? <Pill>{c.owner}</Pill> : <Pill tone="ok">free</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!shown.length && (
          <EmptyState title={q ? "No matches" : onlyFree ? "No unassigned companies" : "No companies yet"}
            hint={q ? "Try a different search." : "Import a call list to add companies."} />
        )}
      </div>
    </Card>
  );
}

export function ImportForm({ onChanged }: { onChanged: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useNote();
  const input = useRef<HTMLInputElement>(null);

  function pick(f: File | undefined) {
    if (f) { setFile(f); setNote(null); }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const j = await api<{ imported: number; skipped: number; duplicates: number }>("/admin/import", { method: "POST", body: fd });
      setNote({ tone: "ok", text: `Imported ${j.imported} · skipped ${j.skipped} · duplicates ${j.duplicates}` });
      setFile(null);
      if (input.current) input.current.value = "";
      onChanged();
    } catch (err) {
      setNote({ tone: "bad", text: err instanceof Error ? err.message : "Import failed" });
    } finally {
      setBusy(false);
    }
  }
  const sample = "data:text/csv;charset=utf-8," + encodeURIComponent("Company,Name,Title,Phone,Switchboard,LinkedIn,Email\nAcme Ltd,Ada Obi,CEO,08031234567,,,ada@acme.com\n");

  return (
    <Card title="Import call list" subtitle="Upload a CSV. Nigerian numbers like 0803… are converted to +234…">
      <form onSubmit={submit}>
        <label
          className={`dropzone${over ? " over" : ""}`}
          style={{ margin: 0 }}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files[0]); }}
        >
          <UploadCloud size={26} />
          {file ? <strong>{file.name}</strong> : <span><strong>Click to choose</strong> or drag a CSV here</span>}
          <input ref={input} type="file" accept=".csv,text/csv" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        <p className="field-hint" style={{ margin: "8px 0 0" }}>
          Columns: Company, Name, Title, Phone, Switchboard, LinkedIn, Email. <a href={sample} download="call-list-sample.csv">Download sample</a>
        </p>
        <div style={{ marginTop: 14 }}>
          <button className="primary" disabled={!file || busy}>{busy ? "Importing…" : "Import"}</button>
        </div>
        {note && <Alert tone={note.tone}>{note.text}</Alert>}
      </form>
    </Card>
  );
}
