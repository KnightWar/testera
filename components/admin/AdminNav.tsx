"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, FileText, Users, Activity,
  Upload, Settings, BarChart3, LogOut
} from "lucide-react";
import { createClient } from "@/lib/supabase";

export default function AdminNav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();

  // Extract current exam ID from pathname if active inside an exam route
  const match = pathname.match(/\/admin\/exams\/([^\/]+)/);
  const currentExamId = match && match[1] !== "new" ? match[1] : null;

  async function handleLogout() {
    if (typeof window !== "undefined" && !window.confirm("Are you sure you want to sign out?")) {
      return;
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
  }

  const initials = userEmail[0]?.toUpperCase() ?? "A";

  const overviewItems = [
    { href: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/admin/exams", icon: FileText, label: "Exams" },
    { href: "/admin/students", icon: Users, label: "Students" },
    { href: "/admin/monitor", icon: Activity, label: "Live Monitor" },
  ];

  const manageItems = [
    {
      href: currentExamId ? `/admin/exams/${currentExamId}/upload` : "/admin/exams",
      icon: Upload,
      label: "Questions",
      disabled: !currentExamId,
    },
    {
      href: currentExamId ? `/admin/exams/${currentExamId}/config` : "/admin/exams",
      icon: Settings,
      label: "Configuration",
      disabled: !currentExamId,
    },
    {
      href: currentExamId ? `/admin/exams/${currentExamId}/results` : "/admin/exams",
      icon: BarChart3,
      label: "Results",
      disabled: !currentExamId,
    },
  ];

  const renderNavItem = (item: { href: string; icon: any; label: string; disabled?: boolean }) => {
    const Icon = item.icon;
    const isActive = pathname === item.href || (item.href !== "/admin/exams" && pathname.startsWith(item.href + "/"));

    return (
      <Link
        key={item.label}
        href={item.href}
        className={`group relative flex items-center gap-3 h-10 px-3.5 rounded-md text-sm font-medium transition-all duration-150 border border-transparent ${isActive
          ? "bg-[#E85D04] text-white border-transparent"
          : item.disabled
            ? "text-slate-300 cursor-not-allowed opacity-50"
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        onClick={(e) => {
          if (item.disabled) {
            e.preventDefault();
          }
        }}
      >
        <Icon size={16} className={isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600 transition-colors"} />
        <span className="flex-1 truncate">{item.label}</span>
        {item.disabled && (
          <span className="text-[9px] uppercase font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 tracking-wider">
            Lock
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside className="fixed top-0 left-0 w-[220px] h-screen bg-white border-r border-slate-200 flex flex-col z-30 transition-all duration-200">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200/80">
        <img src="/logo.png" alt="Prav-AI Logo" className="w-8 h-8 object-contain" />
        <div>
          <p className="text-sm font-bold text-slate-900 leading-none tracking-tight">PRAV-AI</p>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">SKILL ENHANCER PLATFORM</p>
        </div>
      </div>

      {/* Nav groups */}
      <div className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {/* Overview section */}
        <div className="space-y-1">
          <p className="px-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
            Overview
          </p>
          {overviewItems.map(renderNavItem)}
        </div>

        {/* Manage section */}
        <div className="space-y-1">
          <p className="px-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
            Manage
          </p>
          {manageItems.map(renderNavItem)}
        </div>
      </div>

      {/* User profile footer */}
      <div className="p-3 border-t border-slate-200/80 space-y-2">
        <div className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-slate-50 transition-colors group cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-[#E85D04] flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-white">
              {initials}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate">{userEmail}</p>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">SoCSE Admin</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-xs font-semibold text-slate-500 hover:text-red-650 hover:bg-red-50 transition-all duration-150 border border-transparent cursor-pointer"
        >
          <LogOut size={13} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
