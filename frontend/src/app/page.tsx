"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    api<{ role: string }>("/me")
      .then((me) => router.replace(me.role === "admin" ? "/sales/team" : "/sales/my-calls"))
      .catch(() => router.replace("/login"));
  }, [router]);
  return <p style={{ padding: 24 }}>Loading…</p>;
}
