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
    <div className="mb-8">
      {/* Back Link + Page Title */}
      <div className="mb-6">
        <Link
          href="/admin/exams"
          className="inline-flex items-center gap-1.5 text-xs text-[--text-secondary] hover:px-4 hover:bg-[#00457F]/80 hover:text-white rounded transition-colors mb-3 font-semibold"
        >
          <ArrowLeft size={12} />
          Back to Exam Manager
        </Link>
        <h1 className="text-2xl font-display font-bold text-[--text-primary]">
          {examTitle || "Loading Exam Details..."}
        </h1>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-0 border-b border-[--border-base] mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = pathname === tab.href;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`
                flex items-center gap-2
                px-4 py-3
                text-sm font-display font-medium
                border-b-2 -mb-px
                transition-all duration-150
                ${active
                  ? 'border-[--accent] text-[--accent]'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
                }
              `}
            >
              <Icon size={15} />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
