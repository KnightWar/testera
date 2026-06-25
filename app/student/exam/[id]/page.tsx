"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import {
  Flag, ChevronLeft, ChevronRight, Send, Clock,
  CheckCircle, Circle, TriangleAlert, Maximize2
} from "lucide-react";
import ProctorWrapper from "@/components/exam/ProctorWrapper";
import WatermarkOverlay from "@/components/exam/WatermarkOverlay";
import { createClient } from "@/lib/supabase";
import { seededShuffle } from "@/lib/grading";

interface Question {
  id: string;
  q_no: number;
  question: string;
  type: "MCQ" | "Subjective";
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  max_marks: number;
  topic: string | null;
  shuffle_options: boolean;
}

interface StudentSession {
  id: string;
  student_id: string;
  exam_id: string;
  question_order: string[];
  started_at: string;
}

interface ExamMeta {
  id: string;
  title: string;
  duration_mins: number;
  negative_marking: boolean;
}

interface AnswerMap {
  [questionId: string]: { text: string; flagged: boolean };
}

export default function StudentExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [optionOrders, setOptionOrders] = useState<{ [qId: string]: ("A" | "B" | "C" | "D")[] }>({});
  const [session, setSession] = useState<StudentSession | null>(null);
  const [exam, setExam] = useState<ExamMeta | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [orderedQuestions, setOrderedQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Load session from sessionStorage
  useEffect(() => {
    const raw = sessionStorage.getItem("testera_session");
    if (!raw) {
      router.push("/student/login");
      return;
    }
    const sessionData = JSON.parse(raw) as StudentSession;
    setSession(sessionData);
  }, []);

  // Load exam + questions + answers
  useEffect(() => {
    if (!session) return;

    async function load() {
      const [examRes, questionsRes, answersRes] = await Promise.all([
        supabase.from("exams").select("id,title,duration_mins,negative_marking").eq("id", session!.exam_id).single(),
        supabase.from("questions").select("*").eq("exam_id", session!.exam_id),
        supabase.from("answers").select("question_id, answer_text, is_flagged").eq("session_id", session!.id),
      ]);

      if (examRes.data) setExam(examRes.data as ExamMeta);

      const qs = questionsRes.data ?? [];
      setQuestions(qs as Question[]);

      // Order questions per session.question_order
      let ordered = session!.question_order
        .map((id) => qs.find((q) => q.id === id))
        .filter(Boolean) as Question[];

      // FALLBACK: if questions were re-uploaded by the admin (causing UUIDs to change),
      // session.question_order will have zero matches. We heal the session by using the new questions.
      if (ordered.length === 0 && qs.length > 0) {
        ordered = qs as Question[];
        const newIds = ordered.map((q) => q.id);
        
        // Update database in background
        supabase
          .from("sessions")
          .update({ question_order: newIds })
          .eq("id", session!.id)
          .then(() => {
            // Update local state and storage
            const updatedSession = { ...session!, question_order: newIds };
            setSession(updatedSession);
            sessionStorage.setItem("testera_session", JSON.stringify(updatedSession));
          });
      }

      setOrderedQuestions(ordered);

      // Generate randomized option orders deterministically per question
      const orderMap: { [qId: string]: ("A" | "B" | "C" | "D")[] } = {};
      ordered.forEach((q) => {
        const opts: ("A" | "B" | "C" | "D")[] = ["A", "B", "C", "D"];
        if (q.type === "MCQ") {
          if (q.shuffle_options) {
            orderMap[q.id] = seededShuffle(opts, `${session!.id}-${q.id}`);
          } else {
            orderMap[q.id] = opts;
          }
        }
      });
      setOptionOrders(orderMap);

      // Load existing answers
      const initialAnswers: AnswerMap = {};
      answersRes.data?.forEach((ans) => {
        initialAnswers[ans.question_id] = {
          text: ans.answer_text || "",
          flagged: ans.is_flagged || false,
        };
      });
      setAnswers(initialAnswers);

      // Compute timer
      const elapsed = (Date.now() - new Date(session!.started_at).getTime()) / 1000;
      const totalSecs = (examRes.data?.duration_mins ?? 60) * 60;
      setSecondsLeft(Math.max(0, Math.floor(totalSecs - elapsed)));

      setLoading(false);
    }
    load();
  }, [session]);

  // Countdown timer
  useEffect(() => {
    if (!exam || submitted) return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          handleAutoSubmit();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [exam, submitted]);

  // Auto-save every 10 seconds
  useEffect(() => {
    if (!session) return;
    autoSaveRef.current = setInterval(() => saveAnswers(false), 10000);
    return () => clearInterval(autoSaveRef.current);
  }, [session, answers]);

  const saveAnswers = useCallback(async (isFinal: boolean) => {
    if (!session) return;
    const toUpsert = Object.entries(answers).map(([question_id, { text, flagged }]) => ({
      session_id: session.id,
      question_id,
      answer_text: text || null,
      is_flagged: flagged,
      auto_saved_at: isFinal ? null : new Date().toISOString(),
      submitted_at: isFinal ? new Date().toISOString() : null,
    }));
    if (toUpsert.length > 0) {
      await supabase.from("answers").upsert(toUpsert, { onConflict: "session_id,question_id" });
    }
    if (isFinal) {
      await supabase.from("sessions").update({ submitted_at: new Date().toISOString(), is_active: false }).eq("id", session.id);
    }
  }, [session, answers]);

  const handleAutoSubmit = useCallback(async () => {
    await saveAnswers(true);
    setSubmitted(true);
  }, [saveAnswers]);

  const handleForceSubmit = useCallback(async () => {
    // Auto-submit triggered by proctoring violations (3+ fullscreen exits)
    await saveAnswers(true);
    // Trigger grading immediately
    if (session) {
      await fetch(`/api/grade`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: session.id }),
      }).catch(() => {});
    }
    setSubmitted(true);
  }, [saveAnswers, session]);

  async function handleSubmit() {
    setSubmitting(true);
    await saveAnswers(true);

    // Trigger grading
    await fetch(`/api/grade`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session_id: session!.id }),
    });

    setSubmitted(true);
    setSubmitting(false);

    if (exam) {
      const examRes = await supabase.from("exams").select("show_score_immediately").eq("id", exam.id).single();
      if (examRes.data?.show_score_immediately) {
        router.push(`/student/results/${session!.exam_id}`);
      } else {
        router.push("/student/submitted");
      }
    }
  }

  function handleAnswerChange(questionId: string, text: string) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], text, flagged: prev[questionId]?.flagged ?? false },
    }));
  }

  function handleFlagToggle(questionId: string) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], text: prev[questionId]?.text ?? "", flagged: !prev[questionId]?.flagged },
    }));
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const isWarning = secondsLeft <= 300 && secondsLeft > 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <span className="spinner mx-auto block mb-4" style={{ width: 40, height: 40 }} />
          <p style={{ color: "var(--text-secondary)" }}>Loading your exam…</p>
        </div>
      </div>
    );
  }

  const currentQ = orderedQuestions[currentIdx];
  const answered = Object.values(answers).filter((a) => a.text).length;
  const flagged = Object.values(answers).filter((a) => a.flagged).length;

  return (
    <ProctorWrapper sessionId={session?.id ?? ""} examId={id} onForceSubmit={handleForceSubmit}>
      <WatermarkOverlay rollNo={sessionStorage.getItem("testera_roll") ?? ""} />

      <div className="student-theme min-h-screen h-screen flex overflow-hidden text-white bg-[#080D0A]">
        {/* ── LEFT PANEL ─────────────────────────────────── */}
        <aside className="w-72 flex flex-col border-r" style={{ borderColor: "var(--border-subtle)", background: "rgba(255,255,255,0.02)" }}>
          {/* Timer */}
          <div className="p-5 border-b" style={{ borderColor: "var(--border-subtle)" }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Time Remaining</p>
            <div className={`text-4xl font-mono font-bold ${isWarning ? "text-yellow-400" : ""}`}
              style={{ color: isWarning ? "var(--warning)" : "var(--text-primary)" }}>
              {formatTime(secondsLeft)}
            </div>
            {isWarning && (
              <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: "var(--warning)" }}>
                <TriangleAlert size={12} /> Less than 5 minutes left!
              </div>
            )}
            <div className="progress-bar-track mt-3">
              <div className="progress-bar-fill"
                style={{
                  width: `${exam ? (secondsLeft / (exam.duration_mins * 60)) * 100 : 0}%`,
                  background: isWarning ? "var(--warning)" : undefined,
                }} />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 p-5 border-b" style={{ borderColor: "var(--border-subtle)" }}>
            <div className="text-center">
              <p className="text-2xl font-bold" style={{ color: "var(--success)" }}>{answered}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Answered</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold" style={{ color: "var(--warning)" }}>{flagged}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Flagged</p>
            </div>
          </div>

          {/* Question Navigator */}
          <div className="flex-1 p-5 overflow-y-auto">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
              Questions ({orderedQuestions.length})
            </p>
            <div className="grid grid-cols-5 gap-2">
              {orderedQuestions.map((q, i) => {
                const ans = answers[q.id];
                const isActive = i === currentIdx && !showSubmitConfirm;
                const isAnswered = !!ans?.text;
                const isFlagged = !!ans?.flagged;
                return (
                  <button
                    key={q.id}
                    onClick={() => { setCurrentIdx(i); setShowSubmitConfirm(false); }}
                    className={`q-pill ${isActive ? "q-pill-active" : isFlagged ? "q-pill-flagged" : isAnswered ? "q-pill-answered" : "q-pill-unanswered"}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-4 space-y-2">
              {[
                { cls: "q-pill-answered", label: "Answered" },
                { cls: "q-pill-unanswered", label: "Unanswered" },
                { cls: "q-pill-flagged", label: "Flagged" },
              ].map(({ cls, label }) => (
                <div key={label} className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  <div className={`q-pill ${cls} w-6 h-6 text-xs`} style={{ fontSize: 10 }}>•</div> {label}
                </div>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <div className="p-5 border-t" style={{ borderColor: "var(--border-subtle)" }}>
            {showSubmitConfirm ? (
              <button
                className="btn btn-secondary w-full"
                onClick={() => setShowSubmitConfirm(false)}
              >
                Back to Questions
              </button>
            ) : (
              <button
                className="btn btn-primary w-full"
                onClick={() => setShowSubmitConfirm(true)}
                disabled={submitting}
                style={{ background: "linear-gradient(135deg, #059669, #34D399)", color: "white" }}
              >
                <Send size={16} /> Submit Exam
              </button>
            )}
          </div>
        </aside>

        {/* ── RIGHT PANEL ────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {showSubmitConfirm ? (
            /* Dedicated Review & Submit View (Inline layout, no overlays) */
            <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full fade-in">
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">Review & Submit Exam</h2>
                <p style={{ color: "var(--text-secondary)" }}>
                  Please review your progress below before final submission. Click on any question card to go back and edit your answer.
                </p>
              </div>

              {/* Stats Summary Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="p-5 rounded-xl border border-emerald-900/30 text-center" style={{ background: "rgba(16,185,129,0.06)" }}>
                  <p className="text-3xl font-extrabold" style={{ color: "var(--success)" }}>{answered}</p>
                  <p className="text-xs uppercase tracking-wider mt-1 text-slate-400">Answered</p>
                </div>
                <div className="p-5 rounded-xl border border-amber-900/30 text-center" style={{ background: "rgba(245,158,11,0.06)" }}>
                  <p className="text-3xl font-extrabold" style={{ color: "var(--warning)" }}>{flagged}</p>
                  <p className="text-xs uppercase tracking-wider mt-1 text-slate-400">Flagged for Review</p>
                </div>
                <div className="p-5 rounded-xl border border-slate-800 text-center" style={{ background: "var(--bg-input)" }}>
                  <p className="text-3xl font-extrabold" style={{ color: "var(--text-secondary)" }}>{orderedQuestions.length - answered}</p>
                  <p className="text-xs uppercase tracking-wider mt-1 text-slate-400">Unanswered</p>
                </div>
              </div>

              {/* Warnings Alert */}
              <div className="p-4 rounded-xl border border-red-900/30 mb-8 flex gap-3 text-sm" style={{ background: "rgba(239,68,68,0.05)", color: "var(--danger)" }}>
                <TriangleAlert size={18} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Important Notice</p>
                  <p className="text-xs mt-0.5 opacity-80">
                    Once submitted, you will not be able to re-enter the exam or change any answers. Ensure all subjective questions have been filled completely.
                  </p>
                </div>
              </div>

              {/* Question Summary Grid */}
              <div className="mb-10">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">Question Summary List</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {orderedQuestions.map((q, i) => {
                    const ans = answers[q.id];
                    const isAnswered = !!ans?.text;
                    const isFlagged = !!ans?.flagged;
                    
                    return (
                      <button
                        key={q.id}
                        onClick={() => { setCurrentIdx(i); setShowSubmitConfirm(false); }}
                        className="flex items-start justify-between p-4 rounded-xl border text-left hover:border-slate-500 transition-all cursor-pointer"
                        style={{
                          background: isFlagged ? "rgba(245,158,11,0.04)" : isAnswered ? "rgba(16,185,129,0.04)" : "var(--bg-input)",
                          borderColor: isFlagged ? "rgba(245,158,11,0.3)" : isAnswered ? "rgba(16,185,129,0.3)" : "var(--border-subtle)",
                        }}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="w-6 h-6 rounded flex items-center justify-center font-mono text-xs font-bold shrink-0 bg-slate-900 border border-slate-700">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-xs text-slate-300 truncate">{q.question}</p>
                            <span className="text-[10px] text-slate-500 font-medium uppercase mt-0.5 inline-block">{q.type} · {q.max_marks}m</span>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          isFlagged ? "bg-amber-500/20 text-amber-400" :
                          isAnswered ? "bg-emerald-500/20 text-emerald-400" :
                          "bg-slate-800 text-slate-500"
                        }`}>
                          {isFlagged ? "Flagged" : isAnswered ? "Answered" : "Unanswered"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 border-t pt-6" style={{ borderColor: "var(--border-subtle)" }}>
                <button
                  className="btn btn-secondary flex-1 btn-lg"
                  onClick={() => setShowSubmitConfirm(false)}
                >
                  Back to Exam Questions
                </button>
                <button
                  className="btn btn-primary flex-1 btn-lg animate-pulse"
                  style={{ background: "linear-gradient(135deg, #059669, #34D399)", color: "white", boxShadow: "0 4px 20px rgba(52,211,153,0.3)" }}
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? "Submitting..." : "Confirm & Submit Exam"}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Question Header */}
              <div className="flex items-center justify-between px-8 py-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
                <div className="flex items-center gap-3">
                  <span className="badge badge-neutral">Q {currentIdx + 1} of {orderedQuestions.length}</span>
                  {currentQ?.topic && <span className="badge badge-info">{currentQ.topic}</span>}
                  <span className="badge badge-neutral">{currentQ?.type}</span>
                  <span className="badge badge-neutral">{currentQ?.max_marks} marks</span>
                </div>
                <div className="flex items-center gap-2">
                  {exam?.negative_marking && (
                    <span className="text-xs text-red-400" style={{ color: "var(--danger)" }}>Negative marking active</span>
                  )}
                  <button
                    onClick={() => handleFlagToggle(currentQ?.id ?? "")}
                    className={`btn btn-sm ${answers[currentQ?.id ?? ""]?.flagged ? "btn-warning" : "btn-secondary"}`}
                    style={answers[currentQ?.id ?? ""]?.flagged ? { background: "rgba(251,191,36,0.15)", color: "var(--warning)" } : {}}
                  >
                    <Flag size={14} />
                    {answers[currentQ?.id ?? ""]?.flagged ? "Unflag" : "Flag for Review"}
                  </button>
                </div>
              </div>

              {/* Question Content */}
              <div className="flex-1 overflow-y-auto p-8">
                {currentQ && (
                  <div className="max-w-3xl mx-auto fade-in" key={currentQ.id}>
                    <h2 className="text-lg font-medium mb-8 leading-relaxed" style={{ fontSize: "1.125rem", lineHeight: 1.7 }}>
                      {currentQ.question}
                    </h2>

                    {currentQ.type === "MCQ" ? (
                      <div className="space-y-3">
                        {(optionOrders[currentQ.id] || (["A", "B", "C", "D"] as const)).map((opt, idx) => {
                          const key = `option_${opt.toLowerCase()}` as keyof Question;
                          const text = currentQ[key] as string | null;
                          if (!text) return null;
                          const selected = answers[currentQ.id]?.text === opt;
                          const displayLabel = String.fromCharCode(65 + idx);
                          return (
                            <label
                              key={opt}
                              className="flex items-start gap-4 p-5 rounded-xl cursor-pointer transition-all"
                              style={{
                                background: selected ? "rgba(5,150,105,0.1)" : "var(--bg-input)",
                                border: `1.5px solid ${selected ? "var(--accent-primary)" : "var(--border-subtle)"}`,
                              }}
                            >
                              <input
                                type="radio"
                                name={`q-${currentQ.id}`}
                                checked={selected}
                                onChange={() => handleAnswerChange(currentQ.id, opt)}
                                className="mt-0.5 w-5 h-5 accent-emerald-500 shrink-0"
                              />
                              <div className="flex items-start gap-3">
                                <span className="font-bold shrink-0" style={{ color: selected ? "var(--accent-secondary)" : "var(--text-muted)" }}>
                                  {displayLabel}.
                                </span>
                                <span className="text-base text-slate-100" style={{ lineHeight: 1.6 }}>{text}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <div>
                        <textarea
                          className="form-input resize-y min-h-[200px] text-base leading-relaxed bg-[#121E17] text-white border-emerald-900/30"
                          placeholder="Type your answer here…"
                          value={answers[currentQ.id]?.text ?? ""}
                          onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
                        />
                        <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
                          {answers[currentQ.id]?.text?.split(/\s+/).filter(Boolean).length ?? 0} words
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Navigation Footer */}
              <div className="flex items-center justify-between px-8 py-4 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                  disabled={currentIdx === 0}
                >
                  <ChevronLeft size={16} /> Previous
                </button>
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Auto-saved · {answered}/{orderedQuestions.length} answered
                </span>
                <button
                  className="btn btn-secondary"
                  onClick={() => { saveAnswers(false); setCurrentIdx((i) => Math.min(orderedQuestions.length - 1, i + 1)); }}
                  disabled={currentIdx === orderedQuestions.length - 1}
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </>
          )}
        </main>
      </div>
    </ProctorWrapper>
  );
}

