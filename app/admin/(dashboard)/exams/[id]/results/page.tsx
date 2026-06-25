import { createServerSideClient } from "@/lib/supabase-server";
import Link from "next/link";
import {
  Download, BarChart3, UserCheck, AlertTriangle,
  CheckCircle, Clock, Brain
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Results" };

export default async function ExamResultsPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSideClient();

  const [examRes, sessionsRes, questionsRes] = await Promise.all([
    supabase.from("exams").select("*").eq("id", params.id).single(),
    supabase
      .from("sessions")
      .select("*, students(roll_no, name), scores(marks_awarded, graded_by, question_id)")
      .eq("exam_id", params.id)
      .order("created_at"),
    supabase.from("questions").select("id, max_marks").eq("exam_id", params.id),
  ]);

  const exam = examRes.data as any;
  const sessions = (sessionsRes.data ?? []) as any[];
  const questions = (questionsRes.data ?? []) as any[];
  const totalPossible = questions.reduce((s: number, q: any) => s + q.max_marks, 0);

  const submitted = sessions.filter((s) => s.submitted_at);
  const active = sessions.filter((s) => s.is_active && !s.submitted_at);

  function getScore(session: (typeof sessions)[0]) {
    return session.scores?.reduce((s: number, sc: any) => s + sc.marks_awarded, 0) ?? 0;
  }

  function violationBadge(session: (typeof sessions)[0]) {
    const total = (session.tab_switches ?? 0) + (session.fullscreen_exits ?? 0) + (session.devtools_attempts ?? 0);
    if (total === 0) return null;
    return (
      <span className="badge badge-warning">
        <AlertTriangle size={10} /> {total} violations
      </span>
    );
  }

  const avgScore = submitted.length > 0
    ? (submitted.reduce((s, sess) => s + getScore(sess), 0) / submitted.length).toFixed(1)
    : "N/A";

  return (
    <div className="fade-in space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{exam?.title}</h1>
          <p style={{ color: "var(--text-secondary)" }}>Results & Analysis</p>
        </div>
        <div className="flex gap-3">
          <a href={`/api/export?type=class_summary&exam_id=${params.id}`} className="btn btn-secondary">
            <Download size={16} /> Class Summary
          </a>
          <a href={`/api/export?type=analytics&exam_id=${params.id}`} className="btn btn-secondary">
            <BarChart3 size={16} /> Analytics
          </a>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Submitted", value: submitted.length, color: "var(--success)", icon: CheckCircle },
          { label: "In Progress", value: active.length, color: "var(--info)", icon: Clock },
          { label: "Avg Score", value: `${avgScore} / ${totalPossible}`, color: "var(--accent-secondary)", icon: BarChart3 },
          { label: "Total Marks", value: totalPossible, color: "var(--text-muted)", icon: UserCheck },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="glass-card p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</p>
              <Icon size={16} style={{ color }} />
            </div>
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Results Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-5 border-b font-bold" style={{ borderColor: "var(--border-subtle)" }}>
          Student Results
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "rgba(255,255,255,0.03)" }}>
              <tr>
                {["Roll No", "Name", "Score", "%", "Status", "Violations", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center" style={{ color: "var(--text-muted)" }}>
                    No submissions yet
                  </td>
                </tr>
              )}
              {sessions.map((s: any) => {
                const score = getScore(s);
                const pct = totalPossible > 0 ? ((score / totalPossible) * 100).toFixed(1) : "N/A";
                return (
                  <tr key={s.id} className="border-t hover:bg-white/[0.02] transition-colors"
                    style={{ borderColor: "var(--border-subtle)" }}>
                    <td className="px-4 py-3 font-mono text-xs">{s.students?.roll_no}</td>
                    <td className="px-4 py-3 font-medium">{s.students?.name}</td>
                    <td className="px-4 py-3 font-bold"
                      style={{ color: score / totalPossible >= 0.5 ? "var(--success)" : "var(--danger)" }}>
                      {score.toFixed(1)} / {totalPossible}
                    </td>
                    <td className="px-4 py-3">{pct}%</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${s.submitted_at ? "badge-success" : s.is_active ? "badge-info" : "badge-neutral"}`}>
                        {s.submitted_at ? "Submitted" : s.is_active ? "In Progress" : "Not started"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {violationBadge(s) ?? <span style={{ color: "var(--text-muted)" }}>None</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link href={`/admin/exams/${params.id}/results/${s.id}`} className="btn btn-secondary btn-sm">
                          Detail
                        </Link>
                        <button
                          className="btn btn-sm"
                          style={{ background: "rgba(167,139,250,0.15)", color: "var(--accent-secondary)" }}
                          title="Trigger AI grading for subjective answers"
                        >
                          <Brain size={12} /> AI Grade
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
