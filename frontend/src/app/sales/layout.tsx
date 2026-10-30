"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { KeyRound, LayoutDashboard, LogOut, Menu, Phone, X } from "lucide-react";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase/browser";
import ThemeToggle from "@/components/ThemeToggle";

type Me = { full_name: string; role: "admin" | "sales_agent" };

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api<Me>("/me").then(setMe).catch(() => router.replace("/login"));
  }, [router]);
  useEffect(() => setOpen(false), [path]);

  if (!me) return <p className="muted" style={{ padding: 24 }}>Loading…</p>;

  const items = [
    me.role === "sales_agent" && { href: "/sales/my-calls", label: "My Calls", Icon: Phone },
    me.role === "admin" && { href: "/sales/team", label: "Team Overview", Icon: LayoutDashboard },
    { href: "/sales/account", label: "Change password", Icon: KeyRound },
  ].filter(Boolean) as { href: string; label: string; Icon: typeof Phone }[];

  async function logout() {
    await createClient().auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="shell">
      <div className="topbar">
        <button className="icon" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={18} /></button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" />
        <strong>KingiMaster</strong>
        <ThemeToggle />
      </div>

      <aside className={`side${open ? " open" : ""}`}>
        <div className="side-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="KingiMaster logo" />
          <div style={{ flex: 1 }}>
            <div className="t">KingiMaster</div>
            <div className="s">Sales Team</div>
          </div>
          {open && <button className="icon" onClick={() => setOpen(false)} aria-label="Close menu"><X size={16} /></button>}
        </div>
        <nav className="side-nav">
          <div className="group">Menu</div>
          {items.map(({ href, label, Icon }) => (
            <Link key={href} href={href} className={`nav-link${path === href ? " active" : ""}`}>
              <Icon size={18} /> {label}
            </Link>
          ))}
        </nav>
        <div className="side-foot">
          <div className="who">{me.full_name || "Signed in"}</div>
          <div className="who-sub">{me.role === "admin" ? "Admin" : "Sales agent"}</div>
          <div className="row">
            <button onClick={logout} style={{ flex: 1 }}>
              <LogOut size={14} style={{ verticalAlign: -2 }} /> Sign out
            </button>
            <span className="theme-desktop"><ThemeToggle /></span>
          </div>
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}
