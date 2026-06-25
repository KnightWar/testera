"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  GraduationCap, LayoutDashboard, FileText,
  Users, LogOut, ChevronRight, Activity
} from "lucide-react";
import { createClient } from "@/lib/supabase";

const navItems = [
  { href: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/exams",     icon: FileText,        label: "Exams" },
  { href: "/admin/students",  icon: Users,           label: "Students" },
  { href: "/admin/monitor",   icon: Activity,        label: "Live Monitor" },
];

export default function AdminNav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
  }

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-64 flex flex-col border-r z-40"
      style={{ background: "rgba(255,255,255,0.02)", borderColor: "var(--border-subtle)" }}
    >
      {/* Logo */}
      <div className="p-6 border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #6C63FF, #8B5CF6)" }}>
            <GraduationCap size={18} />
          </div>
          <div>
            <p className="font-bold text-sm gradient-text">Testera</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Admin Portal</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group"
              style={{
                background: active ? "rgba(108,99,255,0.15)" : "transparent",
                color: active ? "var(--accent-secondary)" : "var(--text-secondary)",
                borderLeft: active ? "2px solid var(--accent-primary)" : "2px solid transparent",
              }}
            >
              <Icon size={17} />
              {label}
              {active && <ChevronRight size={14} className="ml-auto opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="p-4 border-t" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: "rgba(108,99,255,0.2)", color: "var(--accent-secondary)" }}>
            {userEmail[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: "var(--text-secondary)" }}>{userEmail}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>SoCSE Admin</p>
          </div>
        </div>
        <button onClick={handleLogout} className="btn btn-secondary w-full btn-sm">
          <LogOut size={14} /> Sign Out
        </button>
      </div>
    </aside>
  );
}
