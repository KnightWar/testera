"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import {
  Download, BarChart3, UserCheck, AlertTriangle,
  CheckCircle, Clock, Brain, Trash2, Loader2,
  AlertCircle, FileSpreadsheet
} from "lucide-react";
import ExamSubNav from "@/components/admin/ExamSubNav";

interface Session {
  id: string;
  submitted_at: string | null;
  is_active: boolean;
  tab_switches: number;
  fullscreen_exits: number;
  devtools_attempts: number;
  scores: { marks_awarded: number; graded_by: string; question_id: string }[];
  students: { roll_no: string; name: string } | null;
}

interface Question { id: string; max_marks: number; }
interface Exam { id: string; title: string; }

export default function ExamResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [exam, setExam] = useState<Exam | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = useCallback(async () => {
    const [examRes, sessRes, qRes] = await Promise.all([
      fetch(`/api/exams/${id}/detail`),
      fetch(`/api/results/${id}`),
      fetch(`/api/questions/${id}`),
    ]);
    if (examRes.ok) setExam(await examRes.json());
    if (sessRes.ok) setSessions(await sessRes.json());
    if (qRes.ok) setQuestions(await qRes.json());
    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const totalPossible = questions.reduce((s, q) => s + q.max_marks, 0);

  function getScore(session: Session) {
    return session.scores?.reduce((s, sc) => s + sc.marks_awarded, 0) ?? 0;
  }

  function violationTotal(session: Session) {
    return (session.tab_switches ?? 0) + (session.fullscreen_exits ?? 0) + (session.devtools_attempts ?? 0);
  }

  const submitted = sessions.filter((s) => s.submitted_at);
  const active = sessions.filter((s) => s.is_active && !s.submitted_at);
  const avgScore = submitted.length > 0
    ? (submitted.reduce((s, sess) => s + getScore(sess), 0) / submitted.length).toFixed(1)
    : "N/A";

  async function handleDeleteSession(sessionId: string) {
    if (confirmDeleteId !== sessionId) {
      setConfirmDeleteId(sessionId);
      setTimeout(() => setConfirmDeleteId(null), 4000);
      return;
    }
    setDeletingId(sessionId);
    setConfirmDeleteId(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        setMsg({ type: "success", text: "Session deleted." });
      } else {
        setMsg({ type: "error", text: "Failed to delete session." });
      }
    } finally {
      setDeletingId(null);
      setTimeout(() => setMsg(null), 3000);
    }
  }

  async function handleAIGradeAll(sessionId: string) {
    setAiLoadingId(sessionId);
    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      // Reload data to reflect new grades
      await loadData();
      setMsg({ type: "success", text: "Auto-grading complete!" });
    } catch (err: any) {
      setMsg({ type: "error", text: `Auto-grading failed: ${err.message}` });
    } finally {
      setAiLoadingId(null);
      setTimeout(() => setMsg(null), 3000);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center pt-20 gap-3" style={{ color: "var(--text-muted)" }}>
        <Loader2 size={20} className="animate-spin" /> Loading results…
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 fade-in text-[#F1F5F9]">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex-1">
          <ExamSubNav examId={id} examTitle={exam?.title} />
        </div>
        <div className="flex gap-2 h-fit flex-wrap">
          <a href={`/api/export?type=class_summary&exam_id=${id}`} className="btn btn-secondary btn-sm">
            <Download size={14} /> Summary
          </a>
          <a href={`/api/export?type=analytics&exam_id=${id}`} className="btn btn-secondary btn-sm">
            <BarChart3 size={14} /> Analytics
          </a>
          <a href={`/api/export?type=detailed_results&exam_id=${id}`} className="btn btn-primary btn-sm">
            <FileSpreadsheet size={14} /> Full Excel Export
          </a>
        </div>
      </div>

      {msg && (
        <div className="flex items-center gap-2 p-3 rounded-xl text-sm"
          style={{
            background: msg.type === "success" ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
            color: msg.type === "success" ? "var(--success)" : "var(--danger)",
            border: `1px solid ${msg.type === "success" ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
          }}>
          {msg.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {msg.text}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              {sessions.map((s) => {
                const score = getScore(s);
                const pct = totalPossible > 0 ? ((score / totalPossible) * 100).toFixed(1) : "N/A";
                const vTotal = violationTotal(s);
                const isDeleting = deletingId === s.id;
                const isConfirmingDelete = confirmDeleteId === s.id;
                const isAiLoading = aiLoadingId === s.id;

                return (
                  <tr key={s.id}
                    className="border-t hover:bg-white/[0.02] transition-colors"
                    style={{
                      borderColor: "var(--border-subtle)",
                      opacity: isDeleting ? 0.4 : 1,
                      background: isConfirmingDelete ? "rgba(248,113,113,0.06)" : undefined,
                    }}>
                    <td className="px-4 py-3 font-mono text-xs">{s.students?.roll_no}</td>
                    <td className="px-4 py-3 font-medium">{s.students?.name}</td>
                    <td className="px-4 py-3 font-bold"
                      style={{ color: totalPossible > 0 && score / totalPossible >= 0.5 ? "var(--success)" : "var(--danger)" }}>
                      {score.toFixed(1)} / {totalPossible}
                    </td>
                    <td className="px-4 py-3">{pct}%</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${s.submitted_at ? "badge-success" : s.is_active ? "badge-info" : "badge-neutral"}`}>
                        {s.submitted_at ? "Submitted" : s.is_active ? "In Progress" : "Not started"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {vTotal > 0 ? (
                        <span className="badge badge-warning">
                          <AlertTriangle size={10} /> {vTotal}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>None</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        <Link href={`/admin/exams/${id}/results/${s.id}`} className="btn btn-secondary btn-sm">
                          Grade
                        </Link>
                        <button
                          onClick={() => handleAIGradeAll(s.id)}
                          disabled={isAiLoading}
                          className="btn btn-sm"
                          style={{ background: "rgba(167,139,250,0.15)", color: "var(--accent-secondary)" }}
                          title="Auto-grade all answers (MCQ + keyword rules)"
                        >
                          {isAiLoading ? <Loader2 size={12} className="animate-spin" /> : <Brain size={12} />}
                          Auto
                        </button>
                        <button
                          onClick={() => handleDeleteSession(s.id)}
                          disabled={isDeleting}
                          className="btn btn-sm"
                          style={{
                            background: isConfirmingDelete ? "rgba(248,113,113,0.25)" : "rgba(248,113,113,0.1)",
                            color: "var(--danger)",
                          }}
                          title={isConfirmingDelete ? "Click again to confirm deletion" : "Delete session"}
                        >
                          {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          {isConfirmingDelete ? "Confirm?" : "Delete"}
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
