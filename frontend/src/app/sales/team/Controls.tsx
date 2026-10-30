"use client";
import { useState } from "react";
import { ngn } from "@/lib/common";
import { api } from "@/lib/api";

async function send(url: string, method: string, body: unknown) {
  try {
    return { ok: true, j: await api<Record<string, unknown>>(url, { method, json: body }) };
  } catch (e) {
    return { ok: false, j: { error: e instanceof Error ? e.message : "Failed" } as Record<string, unknown> };
  }
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
  const [msg, setMsg] = useState("");

  async function save(patch: Record<string, unknown>) {
    const { ok, j } = await send(`/admin/agents/${agent.id}`, "PATCH", patch);
    setMsg(ok ? "Saved" : String(j.error));
    onChanged();
  }

  return (
    <tr>
      <td>{agent.name}</td>
      <td className="num">{ngn(spent)}</td>
      <td><input type="number" min={0} value={daily} onChange={(e) => setDaily(e.target.value)} style={{ width: 110 }} /></td>
      <td><input type="number" min={0} value={monthly} onChange={(e) => setMonthly(e.target.value)} style={{ width: 120 }} /></td>
      <td>
        <div className="row">
          <button onClick={() => save({ daily_cap_ngn: Number(daily), monthly_cap_ngn: Number(monthly) })}>Save caps</button>
          <button className={agent.active ? "danger" : "call"} onClick={() => save({ active: !agent.active })}>
            {agent.active ? "Switch off" : "Switch on"}
          </button>
          <button
            onClick={async () => {
              const pw = window.prompt(`New temporary password for ${agent.name} (8+ characters):`);
              if (!pw) return;
              const { ok, j } = await send(`/admin/agents/${agent.id}/reset-password`, "POST", { password: pw });
              setMsg(ok ? "Password reset" : String(j.error));
            }}
          >
            Reset password
          </button>
          <span className="muted">{msg}</span>
        </div>
      </td>
    </tr>
  );
}

export function NewAgentForm({ onChanged }: { onChanged: () => void }) {
  const [f, setF] = useState({ fullName: "", email: "", password: "" });
  const [msg, setMsg] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { ok, j } = await send("/admin/agents", "POST", { email: f.email, password: f.password, full_name: f.fullName });
    setMsg(ok ? "Agent created" : String(j.error));
    if (ok) {
      setF({ fullName: "", email: "", password: "" });
      onChanged();
    }
  }
  return (
    <form onSubmit={submit} style={{ marginTop: 16 }}>
      <h3>Add agent</h3>
      <div className="row">
        <input placeholder="Full name" required value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} style={{ width: 180 }} />
        <input placeholder="Email" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} style={{ width: 220 }} />
        <input placeholder="Temp password (8+)" type="password" minLength={8} required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} style={{ width: 180 }} />
        <button className="primary">Create</button>
        <span className="muted">{msg}</span>
      </div>
    </form>
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
  const [msg, setMsg] = useState("");
  const shown = companies.filter((c) => !onlyFree || !c.owner);

  async function assign(toAgent: string | null) {
    const { ok, j } = await send("/admin/assign", "POST", { agent_id: toAgent, company_keys: [...sel] });
    setMsg(ok ? "Done" : String(j.error));
    if (ok) {
      setSel(new Set());
      onChanged();
    }
  }

  return (
    <div className="card">
      <h2>Assign companies</h2>
      <p className="muted">A company belongs to one agent only; assigning moves it.</p>
      <div className="row">
        <select value={agentId} onChange={(e) => setAgentId(e.target.value)} style={{ width: 200 }}>
          <option value="">Choose agent…</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <button className="primary" disabled={!agentId || !sel.size} onClick={() => assign(agentId)}>Assign {sel.size || ""}</button>
        <button disabled={!sel.size} onClick={() => assign(null)}>Unassign</button>
        <label style={{ margin: 0 }}><input type="checkbox" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} style={{ width: "auto" }} /> unassigned only</label>
        <span className="muted">{msg}</span>
      </div>
      <div className="table-wrap" style={{ maxHeight: 360, overflowY: "auto", marginTop: 8 }}>
        <table>
          <tbody>
            {shown.map((c) => (
              <tr key={c.key}>
                <td style={{ width: 28 }}>
                  <input type="checkbox" checked={sel.has(c.key)} style={{ width: "auto" }}
                    onChange={(e) => { const n = new Set(sel); e.target.checked ? n.add(c.key) : n.delete(c.key); setSel(n); }} />
                </td>
                <td>{c.name} <span className="muted">· {c.contacts} contact{c.contacts > 1 ? "s" : ""}</span></td>
                <td>{c.owner ? <span className="pill">{c.owner}</span> : <span className="pill ok">free</span>}</td>
              </tr>
            ))}
            {!shown.length && <tr><td className="muted">Nothing to show.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ImportForm({ onChanged }: { onChanged: () => void }) {
  const [msg, setMsg] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      const j = await api<{ imported: number; skipped: number; duplicates: number }>("/admin/import", {
        method: "POST",
        body: new FormData(e.currentTarget),
      });
      setMsg(`Imported ${j.imported}, skipped ${j.skipped}, duplicates ${j.duplicates}`);
      onChanged();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }
  return (
    <form className="card" onSubmit={submit}>
      <h2>Import call list (CSV)</h2>
      <p className="muted">Columns: Company, Name, Title, Phone, Switchboard, LinkedIn, Email. Nigerian numbers like 0803… are converted to +234…</p>
      <input type="file" name="file" accept=".csv,text/csv" required />
      <div style={{ marginTop: 12 }}><button className="primary">Import</button> <span className="muted">{msg}</span></div>
    </form>
  );
}
