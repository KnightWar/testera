"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Brain, Save, CheckCircle2, AlertCircle,
  User, Clock, AlertTriangle, Edit3, Loader2, Check
} from "lucide-react";

interface Question {
  id: string;
  q_no: number;
  question: string;
  type: "MCQ" | "Subjective";
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  correct_answer: string | null;
  max_marks: number;
  topic: string | null;
  keywords: any[] | null;
}

interface Answer {
  question_id: string;
  answer_text: string | null;
  is_flagged: boolean;
}

interface Score {
  question_id: string;
  marks_awarded: number;
  graded_by: "auto" | "admin" | "ai";
  ai_feedback: string | null;
}

interface Session {
  id: string;
  submitted_at: string | null;
  is_active: boolean;
  tab_switches: number;
  fullscreen_exits: number;
  devtools_attempts: number;
  started_at: string | null;
  students: { roll_no: string; name: string } | null;
}

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string; session_id: string }>;
}) {
  const { id: examId, session_id } = use(params);

  const [session, setSession] = useState<Session | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [aiLoadingIds, setAiLoadingIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [localMarks, setLocalMarks] = useState<Record<string, string>>({});
  const [modelAnswers, setModelAnswers] = useState<Record<string, string>>({});
  const [globalMsg, setGlobalMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [examTitle, setExamTitle] = useState("");

  const load = useCallback(async () => {
    const [sessRes, examRes] = await Promise.all([
      fetch(`/api/sessions/${session_id}/detail`),
      fetch(`/api/exams/${examId}/detail`),
    ]);

    if (sessRes.ok) {
      const data = await sessRes.json();
      setSession(data.session);
      setQuestions(data.questions);
      setAnswers(data.answers);
      setScores(data.scores);
      // Init local marks from existing scores
      const marks: Record<string, string> = {};
      for (const sc of data.scores as Score[]) {
        marks[sc.question_id] = String(sc.marks_awarded);
      }
      setLocalMarks(marks);

      // Populate model answers from question.option_a
      const modelAnss: Record<string, string> = {};
      for (const q of data.questions as Question[]) {
        if (q.type === "Subjective" && q.option_a) {
          modelAnss[q.id] = q.option_a;
        }
      }
      setModelAnswers(modelAnss);
    }
    if (examRes.ok) {
      const d = await examRes.json();
      setExamTitle(d.title ?? "");
    }
    setLoading(false);
  }, [session_id, examId]);

  useEffect(() => { load(); }, [load]);

  function getAnswer(qid: string) {
    return answers.find((a) => a.question_id === qid);
  }

  function getScore(qid: string): Score | undefined {
    return scores.find((s) => s.question_id === qid);
  }

  function totalScore() {
    return scores.reduce((s, sc) => s + sc.marks_awarded, 0);
  }

  function totalPossible() {
    return questions.reduce((s, q) => s + q.max_marks, 0);
  }

  async function handleSaveManual(qid: string) {
    const rawVal = localMarks[qid];
    if (rawVal === undefined || rawVal === "") return;
    setSavingIds((p) => new Set(p).add(qid));
    try {
      const res = await fetch("/api/grade", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id, question_id: qid, marks_awarded: Number(rawVal) }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setScores((prev) => {
        const existing = prev.find((s) => s.question_id === qid);
        if (existing) return prev.map((s) => s.question_id === qid ? { ...s, marks_awarded: data.marks_awarded, graded_by: "admin", ai_feedback: null } : s);
        return [...prev, { question_id: qid, marks_awarded: data.marks_awarded, graded_by: "admin", ai_feedback: null }];
      });
      setSavedIds((p) => { const n = new Set(p); n.add(qid); return n; });
      setTimeout(() => setSavedIds((p) => { const n = new Set(p); n.delete(qid); return n; }), 2000);
    } catch (err: any) {
      setGlobalMsg({ type: "error", text: err.message });
    } finally {
      setSavingIds((p) => { const n = new Set(p); n.delete(qid); return n; });
    }
  }

  async function handleAIGrade(question: Question) {
    const model = modelAnswers[question.id];
    if (!model?.trim()) {
      setGlobalMsg({ type: "error", text: `Please enter a model answer for Q${question.q_no} before triggering AI grade.` });
      return;
    }
    setAiLoadingIds((p) => new Set(p).add(question.id));
    try {
      const res = await fetch("/api/grade", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id, question_id: question.id, model_answer: model }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setScores((prev) => {
        const existing = prev.find((s) => s.question_id === question.id);
        if (existing) return prev.map((s) => s.question_id === question.id ? { ...s, marks_awarded: data.score, graded_by: "ai", ai_feedback: data.feedback } : s);
        return [...prev, { question_id: question.id, marks_awarded: data.score, graded_by: "ai", ai_feedback: data.feedback }];
      });
      setQuestions((prev) =>
        prev.map((q) => (q.id === question.id ? { ...q, option_a: model } : q))
      );
      setLocalMarks((p) => ({ ...p, [question.id]: String(data.score) }));
      setGlobalMsg({ type: "success", text: `AI graded Q${question.q_no}: ${data.score}/${question.max_marks}` });
    } catch (err: any) {
      setGlobalMsg({ type: "error", text: `AI grade failed: ${err.message}` });
    } finally {
      setAiLoadingIds((p) => { const n = new Set(p); n.delete(question.id); return n; });
    }
    setTimeout(() => setGlobalMsg(null), 4000);
  }

  const gradedByColors: Record<string, string> = {
    auto: "var(--info)",
    admin: "var(--success)",
    ai: "var(--accent-secondary)",
  };
  const gradedByLabels: Record<string, string> = { auto: "Auto", admin: "Manual", ai: "AI" };

  if (loading) {
    return (
      <div className="flex items-center justify-center pt-20 gap-3" style={{ color: "var(--text-muted)" }}>
        <Loader2 size={20} className="animate-spin" /> Loading session…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto pt-12 text-center">
        <p style={{ color: "var(--danger)" }}>Session not found.</p>
        <Link href={`/admin/exams/${examId}/results`} className="btn btn-secondary mt-4">
          ← Back to Results
        </Link>
      </div>
    );
  }

  const violations = (session.tab_switches ?? 0) + (session.fullscreen_exits ?? 0) + (session.devtools_attempts ?? 0);
  const tp = totalPossible();
  const ts = totalScore();
  const pct = tp > 0 ? ((ts / tp) * 100).toFixed(1) : "N/A";

  return (
    <div className="max-w-5xl mx-auto space-y-6 fade-in text-[--text-primary] pb-16">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href={`/admin/exams/${examId}/results`}
            className="btn btn-secondary btn-sm">
            <ArrowLeft size={14} /> Results
          </Link>
          <div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{examTitle}</p>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <User size={18} style={{ color: "var(--accent-primary)" }} />
              {session.students?.name ?? "Unknown"} — {session.students?.roll_no ?? "—"}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="glass-card px-4 py-2 text-center">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Total Score</p>
            <p className="text-xl font-bold" style={{ color: ts / tp >= 0.5 ? "var(--success)" : "var(--danger)" }}>
              {ts.toFixed(1)} / {tp}
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{pct}%</p>
          </div>
          {violations > 0 && (
            <div className="glass-card px-4 py-2 text-center" style={{ borderColor: "rgba(248,113,113,0.3)" }}>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Violations</p>
              <p className="text-xl font-bold" style={{ color: "var(--danger)" }}>{violations}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {session.tab_switches}T · {session.fullscreen_exits}F · {session.devtools_attempts}D
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Session Meta */}
      <div className="glass-card p-4 flex flex-wrap gap-4 text-sm" style={{ color: "var(--text-muted)" }}>
        <span className="flex items-center gap-1.5">
          <Clock size={13} />
          Started: {session.started_at ? new Date(session.started_at).toLocaleString() : "—"}
        </span>
        <span className="flex items-center gap-1.5">
          <Check size={13} />
          Submitted: {session.submitted_at ? new Date(session.submitted_at).toLocaleString() : "Not submitted"}
        </span>
        {violations > 0 && (
          <span className="flex items-center gap-1.5" style={{ color: "var(--danger)" }}>
            <AlertTriangle size={13} />
            {session.tab_switches} tab switch · {session.fullscreen_exits} fullscreen exit · {session.devtools_attempts} devtools
          </span>
        )}
      </div>

      {/* Global message */}
      {globalMsg && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm`}
          style={{
            background: globalMsg.type === "success" ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
            color: globalMsg.type === "success" ? "var(--success)" : "var(--danger)",
            border: `1px solid ${globalMsg.type === "success" ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
          }}>
          {globalMsg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {globalMsg.text}
        </div>
      )}

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((q) => {
          const answer = getAnswer(q.id);
          const score = getScore(q.id);
          const isSaving = savingIds.has(q.id);
          const isAiLoading = aiLoadingIds.has(q.id);
          const isSaved = savedIds.has(q.id);
          const currentMark = localMarks[q.id] ?? (score ? String(score.marks_awarded) : "");

          const isCorrectMCQ = q.type === "MCQ" &&
            answer?.answer_text?.toUpperCase() === q.correct_answer?.toUpperCase();

          return (
            <div key={q.id} className="glass-card p-6 space-y-4">
              {/* Question header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs px-2 py-0.5 rounded-md"
                      style={{ background: "rgba(124,58,237,0.2)", color: "var(--accent-secondary)" }}>
                      Q{q.q_no}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-md"
                      style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>
                      {q.type}
                    </span>
                    {q.topic && (
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>· {q.topic}</span>
                    )}
                    {answer?.is_flagged && (
                      <span className="badge badge-warning text-[10px]">Flagged</span>
                    )}
                  </div>
                  <p className="font-medium leading-snug">{q.question}</p>
                </div>
                <div className="text-right shrink-0">
                  {score && (
                    <span className="text-xs px-2 py-1 rounded-md font-semibold"
                      style={{ background: `${gradedByColors[score.graded_by]}22`, color: gradedByColors[score.graded_by] }}>
                      {gradedByLabels[score.graded_by]} graded
                    </span>
                  )}
                </div>
              </div>

              {/* MCQ Options */}
              {q.type === "MCQ" && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {(["a", "b", "c", "d"] as const).map((opt) => {
                    const optKey = `option_${opt}` as keyof Question;
                    const val = q[optKey] as string | null;
                    if (!val) return null;
                    const optLabel = opt.toUpperCase();
                    const isCorrect = optLabel === q.correct_answer?.toUpperCase();
                    const isStudentAnswer = optLabel === answer?.answer_text?.toUpperCase();
                    return (
                      <div key={opt}
                        className="px-3 py-2 rounded-lg text-sm"
                        style={{
                          background: isCorrect
                            ? "rgba(52,211,153,0.12)"
                            : isStudentAnswer && !isCorrect
                              ? "rgba(248,113,113,0.12)"
                              : "rgba(255,255,255,0.04)",
                          border: `1px solid ${isCorrect ? "rgba(52,211,153,0.3)" : isStudentAnswer && !isCorrect ? "rgba(248,113,113,0.3)" : "transparent"}`,
                          color: isCorrect ? "var(--success)" : isStudentAnswer && !isCorrect ? "var(--danger)" : "inherit",
                        }}>
                        <span className="font-bold mr-2">{optLabel}.</span>{val}
                        {isCorrect && <span className="ml-2 text-xs">✓ Correct</span>}
                        {isStudentAnswer && !isCorrect && <span className="ml-2 text-xs">← Student picked</span>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Student Answer */}
              <div className="rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-subtle)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                  Student&apos;s Answer
                </p>
                {answer?.answer_text ? (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {answer.answer_text}
                  </p>
                ) : (
                  <p className="text-sm italic" style={{ color: "var(--text-muted)" }}>No answer submitted</p>
                )}
              </div>

              {/* AI Feedback */}
              {score?.ai_feedback && (
                <div className="rounded-xl p-4"
                  style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)" }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1"
                    style={{ color: "var(--accent-secondary)" }}>
                    AI Feedback
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {score.ai_feedback}
                  </p>
                </div>
              )}

              {/* Grading Controls */}
              <div className="flex items-end gap-3 flex-wrap pt-1 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                {/* Score Input */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                    Marks (0–{q.max_marks})
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={q.max_marks}
                    step={0.5}
                    value={currentMark}
                    onChange={(e) => setLocalMarks((p) => ({ ...p, [q.id]: e.target.value }))}
                    className="form-input w-20 text-center text-sm py-1.5"
                    style={{ color: isCorrectMCQ ? "var(--success)" : "inherit" }}
                  />
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>/ {q.max_marks}</span>
                </div>

                {/* Save Manual */}
                <button
                  onClick={() => handleSaveManual(q.id)}
                  disabled={isSaving || currentMark === ""}
                  className="btn btn-sm"
                  style={{ background: "rgba(52,211,153,0.15)", color: "var(--success)" }}
                >
                  {isSaving ? <Loader2 size={13} className="animate-spin" /> : isSaved ? <CheckCircle2 size={13} /> : <Save size={13} />}
                  {isSaved ? "Saved!" : "Save"}
                </button>

                {/* AI Grade (Subjective only) */}
                {q.type === "Subjective" && (
                  <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                    <input
                      type="text"
                      placeholder="Model answer / marking scheme for AI…"
                      value={modelAnswers[q.id] ?? ""}
                      onChange={(e) => setModelAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
                      className="form-input text-xs py-1.5 flex-1"
                    />
                    <button
                      onClick={() => handleAIGrade(q)}
                      disabled={isAiLoading}
                      className="btn btn-sm shrink-0"
                      style={{ background: "rgba(167,139,250,0.15)", color: "var(--accent-secondary)" }}
                    >
                      {isAiLoading ? <Loader2 size={13} className="animate-spin" /> : <Brain size={13} />}
                      AI Grade
                    </button>
                  </div>
                )}

                {/* MCQ correct/wrong indicator */}
                {q.type === "MCQ" && answer?.answer_text && (
                  <span className="text-xs ml-auto" style={{ color: isCorrectMCQ ? "var(--success)" : "var(--danger)" }}>
                    {isCorrectMCQ ? "✓ Correct answer" : "✗ Wrong answer"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {questions.length === 0 && (
        <div className="glass-card p-12 text-center" style={{ color: "var(--text-muted)" }}>
          No questions found for this exam.
        </div>
      )}
    </div>
  );
}
