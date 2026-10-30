import type { ReactNode } from "react";

export function Card({
  title, subtitle, action, children, flush, grow,
}: { title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; flush?: boolean; grow?: boolean }) {
  return (
    <section className={`card panel${grow ? " grow" : ""}`}>
      {(title || action) && (
        <header className="card-head">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p className="card-sub">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={flush ? "card-body flush" : "card-body"}>{children}</div>
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Pill({ tone, children }: { tone?: "ok" | "warn" | "bad"; children: ReactNode }) {
  return <span className={`pill${tone ? ` ${tone}` : ""}`}>{children}</span>;
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="stat">
      <div className="l">{label}</div>
      <div className="v num">{value}</div>
      {sub && <div className="s">{sub}</div>}
    </div>
  );
}

export function Alert({ tone, children }: { tone: "ok" | "bad"; children: ReactNode }) {
  if (!children) return null;
  return <div className={`alert ${tone}`} role={tone === "bad" ? "alert" : "status"}>{children}</div>;
}

export function EmptyState({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      <div className="empty-title">{title}</div>
      {hint && <div className="empty-hint">{hint}</div>}
      {action}
    </div>
  );
}

export function Skeleton({ h = 16, w = "100%" }: { h?: number; w?: number | string }) {
  return <div className="skeleton" style={{ height: h, width: w }} aria-hidden />;
}

export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <Skeleton h={28} w={220} />
      <div style={{ height: 8 }} />
      <Skeleton h={14} w={360} />
      <div style={{ height: 24 }} />
      <div className="stats grid">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} h={78} />)}
      </div>
      <div style={{ height: 16 }} />
      <Skeleton h={220} />
    </div>
  );
}
