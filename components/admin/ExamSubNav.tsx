"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Upload, Settings, BarChart3 } from "lucide-react";

interface ExamSubNavProps {
  examId: string;
  examTitle?: string;
}

export default function ExamSubNav({ examId, examTitle }: ExamSubNavProps) {
  const pathname = usePathname();

  const tabs = [
    {
      href: `/admin/exams/${examId}/upload`,
      label: "Questions Upload",
      icon: Upload,
    },
    {
      href: `/admin/exams/${examId}/config`,
      label: "Configuration",
      icon: Settings,
    },
    {
      href: `/admin/exams/${examId}/results`,
      label: "Results & Analytics",
      icon: BarChart3,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Back to List Header */}
      <div className="flex flex-col gap-2">
        <Link 
          href="/admin/exams" 
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-purple-300 transition-colors w-fit"
        >
          <ArrowLeft size={12} /> Back to Exam Manager
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            {examTitle || "Loading Exam Details..."}
          </h1>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <nav className="flex gap-6 -mb-px">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = pathname === tab.href;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex items-center gap-2 py-3 px-1 text-sm font-semibold border-b-2 transition-all"
                style={{
                  color: active ? "var(--accent-secondary)" : "var(--text-secondary)",
                  borderColor: active ? "var(--accent-primary)" : "transparent",
                }}
              >
                <Icon size={16} />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
