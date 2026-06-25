import { createServerSideClient } from "@/lib/supabase-server";
import Link from "next/link";
import { Plus, FileText, Users, Activity, TrendingUp } from "lucide-react";
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
    { label: "Total Exams", value: totalExams, icon: FileText, color: "#6C63FF" },
    { label: "Enrolled Students", value: totalStudents, icon: Users, color: "#34D399" },
    { label: "Live Sessions", value: activeSessions, icon: Activity, color: "#FBBF24" },
  ];

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p style={{ color: "var(--text-secondary)" }}>SoCSE — Exam Management Overview</p>
        </div>
        <Link href="/admin/exams/new" className="btn btn-primary">
          <Plus size={16} /> New Exam
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-5 mb-8">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass-card p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{label}</p>
                <p className="text-4xl font-bold" style={{ color }}>{value}</p>
              </div>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: `${color}1A` }}>
                <Icon size={22} style={{ color }} />
              </div>
            </div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${Math.min(100, value * 5)}%`, background: color }} />
            </div>
          </div>
        ))}
      </div>

      {/* Recent Exams */}
      <div className="glass-card">
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: "var(--border-subtle)" }}>
          <h2 className="font-bold flex items-center gap-2">
            <TrendingUp size={18} style={{ color: "var(--accent-primary)" }} />
            Recent Exams
          </h2>
          <Link href="/admin/exams" className="text-sm btn btn-secondary btn-sm">View All</Link>
        </div>

        {exams.length === 0 ? (
          <div className="p-12 text-center" style={{ color: "var(--text-muted)" }}>
            No exams yet.{" "}
            <Link href="/admin/exams/new" className="underline" style={{ color: "var(--accent-secondary)" }}>
              Create your first exam →
            </Link>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
            {exams.slice(0, 8).map((exam) => (
              <div key={exam.id} className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors">
                <div>
                  <p className="font-medium">{exam.title}</p>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    {exam.duration_mins} min &nbsp;·&nbsp;
                    {exam.start_at ? new Date(exam.start_at).toLocaleDateString() : "No start date"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`badge ${
                    new Date() < new Date(exam.start_at ?? 0) ? "badge-info" :
                    exam.end_at && new Date() > new Date(exam.end_at) ? "badge-neutral" : "badge-success"
                  }`}>
                    {!exam.start_at ? "Draft" :
                     new Date() < new Date(exam.start_at) ? "Upcoming" :
                     exam.end_at && new Date() > new Date(exam.end_at) ? "Ended" : "Live"}
                  </span>
                  <Link href={`/admin/exams/${exam.id}`} className="btn btn-secondary btn-sm">
                    Manage
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
