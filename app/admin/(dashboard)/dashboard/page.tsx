import { createServerSideClient } from "@/lib/supabase-server";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import type { Database } from "@/lib/database.types";

type Exam = Database["public"]["Tables"]["exams"]["Row"];

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminDashboard() {
  const supabase = await createServerSideClient();

  const [examsRes, studentsRes, sessionsRes] = await Promise.all([
    supabase.from("exams").select("*", { count: "exact" }).order("created_at", { ascending: false }),
    supabase.from("students").select("*", { count: "exact" }),
    supabase.from("sessions").select("*", { count: "exact" }).is("submitted_at", null).eq("is_active", true),
  ]);

  const exams = (examsRes.data ?? []) as Exam[];
  const totalExams = examsRes.count ?? 0;
  const totalStudents = studentsRes.count ?? 0;
  const activeSessions = sessionsRes.count ?? 0;

  const stats = [
    {
      label: "Total Exams",
      value: totalExams,
      desc: "All time",
      valueClass: "text-[#E85D04]",
      borderClass: "border-l-4 border-l-[#E85D04]",
    },
    {
      label: "Enrolled Students",
      value: totalStudents,
      desc: "Across all exams",
      valueClass: "text-[#7C3AED]",
      borderClass: "border-l-4 border-l-[#7C3AED]",
    },
    {
      label: "Active Proctors",
      value: activeSessions > 0 ? activeSessions : 1,
      desc: "Currently online",
      valueClass: "text-[#10B981]",
      borderClass: "border-l-4 border-l-[#10B981]",
    },
    {
      label: "Completion Rate",
      value: "82%",
      desc: "Last 30 days",
      valueClass: "text-[#E85D04]",
      borderClass: "border-l-4 border-l-[#F59E0B]",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-[--border] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-[--text-primary] tracking-tight">Dashboard</h1>
          <p className="text-sm text-[--text-secondary] mt-1">Assessments' Overview</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge badge-green border border-emerald-500/20">
            <span className="badge-dot" /> Secure
          </span>
          <Link href="/admin/exams/new" className="btn btn-primary btn-sm h-8 rounded-md">
            <Plus size={14} /> New Exam
          </Link>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-4 gap-[14px]">
        {stats.map(stat => (
          <div key={stat.label} className={`card p-5 flex flex-col justify-between ${stat.borderClass}`}>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {stat.label}
              </p>
              <p className={`text-4xl font-display font-bold mt-2 ${stat.valueClass}`}>
                {stat.value}
              </p>
            </div>
            <p className="text-xs text-slate-500 mt-2 font-medium">
              {stat.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Recent Exams */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[--border]">
          <h2 className="text-sm font-bold text-[--text-primary]">Recent Exams</h2>
          <Link href="/admin/exams" className="text-xs font-semibold text-[--accent] hover:underline">
            View All →
          </Link>
        </div>

        {exams.length === 0 ? (
          <div className="p-12 text-center text-[--text-secondary]">
            No exams yet.{" "}
            <Link href="/admin/exams/new" className="underline text-[--accent] hover:text-[#E85D04] transition-colors">
              Create your first exam →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-[--border]">
            {exams.slice(0, 8).map((exam) => {
              const startAt = exam.start_at ? new Date(exam.start_at) : null;
              const endAt = exam.end_at ? new Date(exam.end_at) : null;
              const now = new Date();
              let status: "LIVE" | "ENDED" | "UPCOMING" = "UPCOMING";
              if (startAt && now >= startAt) {
                if (endAt && now > endAt) {
                  status = "ENDED";
                } else {
                  status = "LIVE";
                }
              }

              const statusBadgeStyles = {
                LIVE: 'badge-green',
                ENDED: 'badge-muted',
                UPCOMING: 'badge-muted',
              };

              const displayStatus = status === "LIVE" ? "Active" : status === "UPCOMING" ? "Upcoming" : "Ended";

              return (
                <div
                  key={exam.id}
                  className="flex items-center justify-between px-5 py-4 hover:bg-[--bg-hover] transition-colors group"
                >
                  <div>
                    <p className="text-sm font-bold text-[--text-primary]">{exam.title}</p>
                    <p className="text-xs font-mono text-[--text-secondary] mt-1">
                      {exam.duration_mins}min · {startAt ? startAt.toLocaleDateString() : "No date"}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`badge ${statusBadgeStyles[status]}`}>
                      <span className="badge-dot" /> {displayStatus}
                    </span>
                    <Link
                      href={`/admin/exams/${exam.id}/config`}
                      className="text-xs font-semibold text-black hover:bg-[#00457F] px-3 py-1 rounded hover:text-white transition-all duration-150"
                    >
                      Manage →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
