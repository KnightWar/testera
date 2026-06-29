"use client";

import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, CheckCircle2, AlertCircle, Award, BookOpen, Clock, BarChart3, HelpCircle
} from "lucide-react";
import { createClient } from "@/lib/supabase";

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
  started_at: string | null;
}

export default function StudentResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: examId } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [examTitle, setExamTitle] = useState("");

  const handleExit = useCallback(() => {
    sessionStorage.removeItem("testera_session");
    sessionStorage.removeItem("testera_roll");
    router.push("/");
  }, [router]);

  const loadData = useCallback(async (sessionId: string) => {
    try {
      const [sessRes, examRes] = await Promise.all([
        fetch(`/api/sessions/${sessionId}/detail`),
        fetch(`/api/exams/${examId}/detail`),
      ]);

      if (sessRes.ok) {
        const data = await sessRes.json();
        setSession(data.session);
        setQuestions(data.questions);
        setAnswers(data.answers);
        setScores(data.scores);
      } else {
        throw new Error("Failed to load results details.");
      }

      if (examRes.ok) {
        const examData = await examRes.json();
        setExamTitle(examData.title ?? "");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error loading results.");
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    // 1. Try to load session from sessionStorage
    const storedSessionRaw = sessionStorage.getItem("testera_session");
    if (storedSessionRaw) {
      try {
        const stored = JSON.parse(storedSessionRaw);
        if (stored && stored.id && stored.exam_id === examId) {
          loadData(stored.id);
          return;
        }
      } catch (e) {
        console.error("Error parsing sessionStorage session", e);
      }
    }

    // 2. Safety fallback - find session via roll number
    const rollNo = sessionStorage.getItem("testera_roll");
    if (!rollNo) {
      router.push("/");
      return;
    }

    async function fetchSessionByRoll() {
      // Find student
      const { data: student } = await supabase
        .from("students")
        .select("id")
        .eq("exam_id", examId)
        .eq("roll_no", rollNo)
        .single();

      if (!student) {
        setErrorMsg("Student record not found.");
        setLoading(false);
        return;
      }

      // Find session
      const { data: sess } = await supabase
        .from("sessions")
        .select("id")
        .eq("student_id", student.id)
        .eq("exam_id", examId)
        .single();

      if (!sess) {
        setErrorMsg("Exam session not found.");
        setLoading(false);
      } else {
        loadData(sess.id);
      }
    }

    fetchSessionByRoll();
  }, [examId, supabase, loadData]);

  const getAnswer = (qid: string) => answers.find((a) => a.question_id === qid);
  const getScore = (qid: string) => scores.find((s) => s.question_id === qid);

  const totalScore = scores.reduce((s, sc) => s + sc.marks_awarded, 0);
  const totalPossible = questions.reduce((s, q) => s + q.max_marks, 0);
  const percentage = totalPossible > 0 ? ((totalScore / totalPossible) * 100).toFixed(1) : "0.0";

  if (loading) {
    return (
      <div className="min-h-screen bg-[--bg-base] text-[--text-primary] flex items-center justify-center gap-3">
        <span className="spinner border-2" />
        <span className="text-sm font-semibold text-[--text-secondary]">Retrieving your results…</span>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-[--bg-base] text-[--text-primary] flex items-center justify-center p-6">
        <div className="card max-w-md w-full p-8 text-center border-red-500/20">
          <div className="w-16 h-16 rounded-full bg-[--red-bg] flex items-center justify-center mx-auto mb-5">
            <AlertCircle size={28} className="text-[--red]" />
          </div>
          <h2 className="text-xl font-bold text-[--red] mb-3">Error Loading Results</h2>
          <p className="text-sm text-[--text-secondary] mb-6">{errorMsg}</p>
          <Link href="/student/login" className="btn btn-ghost w-full justify-center">
            Return to Login Portal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[--bg-base] text-[--text-primary] font-sans pb-16">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Prav-AI Logo" className="w-9 h-9 object-contain" />
            <div>
              <p className="text-sm font-bold text-slate-900 leading-none tracking-tight">Prav-AI</p>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">Results Portal</p>
            </div>
          </div>
          <button onClick={handleExit} className="btn btn-ghost text-xs px-3 py-1.5 h-8 flex items-center gap-1.5 border border-slate-200 cursor-pointer">
            <ArrowLeft size={13} /> Exit Portal
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 pt-10 space-y-8 fade-in">
        {/* Exam Title & Results Summary */}
        <div className="flex flex-col md:flex-row items-stretch justify-between gap-6">
          <div className="flex-1 space-y-2">
            <p className="text-xs font-bold text-[--text-accent] uppercase tracking-widest">{examTitle || "Completed Exam"}</p>
            <h1 className="text-3xl font-display font-extrabold tracking-tight">Your Scorecard</h1>
            <p className="text-sm text-[--text-secondary] leading-relaxed">
              Below is the detailed evaluation breakdown. Correct answers for MCQs and model reference schemes for subjective inputs are displayed where available.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm min-w-[240px] flex items-center justify-between gap-6 shrink-0">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">Your Total Marks</p>
              <p className="text-4xl font-display font-black text-slate-900 leading-none pt-2">
                {totalScore.toFixed(1)} <span className="text-xl font-normal text-slate-400">/ {totalPossible}</span>
              </p>
              <p className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full w-fit mt-3">
                Score Percentage: {percentage}%
              </p>
            </div>
            <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
              <Award size={32} className="text-[--accent]" />
            </div>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="space-y-5">
          <h2 className="text-lg font-bold tracking-tight">Evaluation Breakdown</h2>

          <div className="space-y-4">
            {questions.map((q) => {
              const answer = getAnswer(q.id);
              const score = getScore(q.id);
              const mark = score ? score.marks_awarded : 0;
              const isCorrectMCQ = q.type === "MCQ" &&
                answer?.answer_text?.toUpperCase() === q.correct_answer?.toUpperCase();

              return (
                <div key={q.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                  {/* Question Title Bar */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-violet-50 text-[--accent] rounded-md">
                          Q{q.q_no}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-50 text-slate-500 rounded-md uppercase tracking-wider">
                          {q.type}
                        </span>
                        {q.topic && (
                          <span className="text-xs text-slate-400">· {q.topic}</span>
                        )}
                      </div>
                      <p className="font-semibold text-slate-950 leading-snug">{q.question}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold font-mono text-slate-900">
                        {mark.toFixed(1)} / {q.max_marks}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium tracking-wide uppercase mt-0.5">
                        Marks Awarded
                      </p>
                    </div>
                  </div>

                  {/* MCQ Options Display */}
                  {q.type === "MCQ" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      {(["a", "b", "c", "d"] as const).map((opt) => {
                        const optKey = `option_${opt}` as keyof Question;
                        const val = q[optKey] as string | null;
                        if (!val) return null;

                        const optLabel = opt.toUpperCase();
                        const isCorrect = optLabel === q.correct_answer?.toUpperCase();
                        const isStudentAnswer = optLabel === answer?.answer_text?.toUpperCase();

                        return (
                          <div
                            key={opt}
                            className="px-3.5 py-2.5 rounded-xl text-xs transition-colors"
                            style={{
                              background: isCorrect
                                ? "rgba(16,185,129,0.06)"
                                : isStudentAnswer && !isCorrect
                                  ? "rgba(239,68,68,0.06)"
                                  : "rgba(241,245,249,0.5)",
                              border: `1px solid ${
                                isCorrect
                                  ? "rgba(16,185,129,0.18)"
                                  : isStudentAnswer && !isCorrect
                                    ? "rgba(239,68,68,0.18)"
                                    : "rgba(226,232,240,0.6)"
                              }`,
                              color: isCorrect ? "var(--success)" : isStudentAnswer && !isCorrect ? "var(--danger)" : "var(--text-primary)",
                            }}
                          >
                            <span className="font-bold mr-2">{optLabel}.</span>
                            {val}
                            {isCorrect && <span className="ml-2 font-semibold">✓ Correct Answer</span>}
                            {isStudentAnswer && !isCorrect && <span className="ml-2 font-semibold">← Selected</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Student Answer Block */}
                  <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Your Submitted Answer
                    </p>
                    {answer?.answer_text ? (
                      <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                        {answer.answer_text}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-400 italic">No answer was submitted for this question.</p>
                    )}
                  </div>

                  {/* Subjective Reference Answers / AI Feedbacks */}
                  {q.type === "Subjective" && (
                    <div className="space-y-3 pt-2">
                      {q.option_a && (
                        <div className="bg-emerald-50/30 border border-emerald-500/10 rounded-xl p-4 space-y-1">
                          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">
                            Model Reference Answer / Key Outline
                          </p>
                          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-sans">
                            {q.option_a}
                          </p>
                        </div>
                      )}

                      {score?.ai_feedback && (
                        <div className="bg-violet-50/30 border border-violet-500/10 rounded-xl p-4 space-y-1">
                          <p className="text-[10px] font-bold text-violet-600 uppercase tracking-widest mb-1">
                            Evaluator Feedback
                          </p>
                          <p className="text-xs text-slate-700 leading-relaxed font-sans">
                            {score.ai_feedback}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
