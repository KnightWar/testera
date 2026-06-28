"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import {
  Download, BarChart3, UserCheck, AlertTriangle,
  CheckCircle, Clock, Brain, Trash2, Loader2,
  AlertCircle, FileSpreadsheet, Target
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
    <div className="max-w-7xl mx-auto space-y-6 fade-in text-[--text-1]">
      <ExamSubNav examId={id} examTitle={exam?.title} />

      {msg && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm border ${
          msg.type === "success"
            ? "bg-[--success-muted] text-[--success] border-[--success-border]"
            : "bg-[--danger-muted] text-[--danger] border-[--danger-border]"
        }`}>
          {msg.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {msg.text}
        </div>
      )}

      {/* Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Submitted', value: submitted.length, icon: CheckCircle, color: 'text-[--success]' },
          { label: 'In Progress', value: active.length, icon: Clock, color: 'text-[--info]' },
          { label: 'Avg Score', value: `${avgScore} / ${totalPossible}`, icon: Target, color: 'text-[--accent]' },
          { label: 'Total Marks', value: totalPossible, icon: BarChart3, color: 'text-[--text-1]' },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-[--bg-surface] border border-[--border-base] rounded-xl px-5 py-4 flex items-center gap-4 shadow-sm">
              <Icon size={18} className={stat.color} />
              <div>
                <p className="text-[11px] font-body text-[--text-3] uppercase tracking-wide">{stat.label}</p>
                <p className="text-xl font-display font-bold text-[--text-1]">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sub-actions */}
      <div className="flex items-center gap-3 mb-5">
        <h2 className="text-sm font-display font-semibold text-[--text-1] flex-1">Student Results</h2>
        <a href={`/api/export?type=class_summary&exam_id=${id}`} className="inline-flex items-center gap-2 px-3 py-1.5 bg-transparent hover:bg-[--bg-hover] text-[--text-2] hover:text-[--text-1] font-display font-medium text-xs rounded-lg border border-[--border-base] transition-all duration-150">
          <Download size={13} /> Summary
        </a>
        <a href={`/api/export?type=analytics&exam_id=${id}`} className="inline-flex items-center gap-2 px-3 py-1.5 bg-transparent hover:bg-[--bg-hover] text-[--text-2] hover:text-[--text-1] font-display font-medium text-xs rounded-lg border border-[--border-base] transition-all duration-150">
          <BarChart3 size={13} /> Analytics
        </a>
        <a href={`/api/export?type=detailed_results&exam_id=${id}`} className="inline-flex items-center gap-2 px-3 py-1.5 bg-[--accent] hover:bg-[--accent-light] text-white font-display font-semibold text-xs rounded-lg border border-[--accent-border] shadow-sm transition-all duration-150 cursor-pointer">
          <FileSpreadsheet size={13} /> Full Excel Export
        </a>
      </div>

      {/* Results Table */}
      <div className="rounded-xl border border-[--border-base] overflow-hidden shadow-sm bg-[--bg-surface]">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[--bg-surface] border-b border-[--border-base]">
              {['Roll No', 'Name', 'Score', '%', 'Status', 'Violations', 'Actions'].map(col => (
                <th key={col} className="px-5 py-3 text-left text-[11px] font-body font-medium text-[--text-3] uppercase tracking-[0.07em]">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <AlertCircle size={32} className="text-[--text-3]" />
                    <p className="text-sm font-display font-medium text-[--text-2]">No submissions yet</p>
                    <p className="text-xs text-[--text-3]">Student results will appear here once the exam is taken</p>
                  </div>
                </td>
              </tr>
            ) : (
              sessions.map(sub => {
                const score = getScore(sub);
                const pct = totalPossible > 0 ? ((score / totalPossible) * 100).toFixed(1) : "N/A";
                const violations = violationTotal(sub);
                const isDeleting = deletingId === sub.id;
                const isConfirmingDelete = confirmDeleteId === sub.id;
                const isAiLoading = aiLoadingId === sub.id;

                const statusText = sub.submitted_at ? "SUBMITTED" : sub.is_active ? "IN PROGRESS" : "NOT STARTED";
                const statusBadgeStyles = {
                  SUBMITTED: 'bg-[--success-muted] text-[--success] border-[--success-border]',
                  'IN PROGRESS': 'bg-[--info-muted] text-[--info] border-[--border-base]',
                  'NOT STARTED': 'bg-[--bg-elevated] text-[--text-3] border-[--border-base]',
                };

                return (
                  <tr key={sub.id} className="border-b border-[--border-dim] last:border-0 hover:bg-[--bg-hover] transition-colors duration-100 group">
                    <td className="px-5 py-4 font-mono text-xs text-[--text-2]">{sub.students?.roll_no}</td>
                    <td className="px-5 py-4 text-sm font-display font-medium text-[--text-1]">{sub.students?.name}</td>
                    <td className="px-5 py-4 text-sm font-mono text-[--text-1] font-semibold">{score.toFixed(1)} / {totalPossible}</td>
                    <td className="px-5 py-4 text-sm text-[--text-2]">{pct}%</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 text-[11px] font-display font-semibold uppercase tracking-wide rounded-pill border ${statusBadgeStyles[statusText]}`}>
                        {statusText}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {violations > 0 ? (
                        <span className="text-xs font-mono font-bold text-[--danger] bg-[--danger-muted] border border-[--danger-border] px-2 py-0.5 rounded">{violations}</span>
                      ) : (
                        <span className="text-[--text-3]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2 opacity-60 hover:opacity-100 transition-opacity duration-150">
                        <Link href={`/admin/exams/${id}/results/${sub.id}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[--bg-elevated] hover:bg-[--bg-hover] text-[--text-2] hover:text-[--text-1] font-display font-semibold text-xs rounded-lg border border-[--border-base] transition-all duration-150">
                          Grade
                        </Link>
                        <button
                          onClick={() => handleAIGradeAll(sub.id)}
                          disabled={isAiLoading}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[--accent-muted] text-[--text-accent] hover:bg-[--accent] hover:text-white font-display font-semibold text-xs rounded-lg border border-[--accent-border] transition-all duration-150 cursor-pointer"
                          title="Auto-grade all answers (MCQ + keyword rules)"
                        >
                          {isAiLoading ? <Loader2 size={12} className="animate-spin" /> : <Brain size={12} />}
                          Auto
                        </button>
                        <button
                          onClick={() => handleDeleteSession(sub.id)}
                          disabled={isDeleting}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[--danger-muted] text-[--danger] hover:bg-[--danger] hover:text-white font-display font-semibold text-xs rounded-lg border border-[--danger-border] transition-all duration-150 cursor-pointer"
                          title={isConfirmingDelete ? "Click again to confirm deletion" : "Delete session"}
                        >
                          {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          {isConfirmingDelete ? "Confirm?" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
