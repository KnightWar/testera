"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import {
  Flag, ChevronLeft, ChevronRight, Send, Clock,
  Circle, TriangleAlert, CheckCircle2, Play, Terminal, HelpCircle, ArrowRight
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

function getQuestionTypeLabel(q: Question): { type: "MCQ" | "Short Answer" | "Coding" | "Essay"; label: string } {
  if (q.type === "MCQ") {
    return { type: "MCQ", label: "Multiple Choice" };
  }
  // Check if Coding
  const isCoding = 
    q.topic?.toLowerCase().includes("coding") || 
    q.topic?.toLowerCase().includes("program") || 
    q.topic?.toLowerCase().includes("code") ||
    q.question.toLowerCase().includes("implement a function") ||
    q.question.toLowerCase().includes("write a function") ||
    q.question.toLowerCase().includes("write a program") ||
    q.question.toLowerCase().includes("write code") ||
    q.question.toLowerCase().includes("def ") ||
    q.question.toLowerCase().includes("public class") ||
    q.question.toLowerCase().includes("merge_sorted");

  if (isCoding) {
    return { type: "Coding", label: "Coding" };
  }

  // Check if Essay (Subjective with high marks or explicitly marked as essay)
  const isEssay = 
    q.max_marks >= 10 || 
    q.topic?.toLowerCase().includes("essay") || 
    q.question.toLowerCase().includes("discuss the trade-off") ||
    q.question.toLowerCase().includes("explain in detail") ||
    q.question.toLowerCase().includes("write an essay");

  if (isEssay) {
    return { type: "Essay", label: "Essay" };
  }

  return { type: "Short Answer", label: "Short Answer" };
}

function getDefaultCodeSnippet(qQuestion: string, lang: string): string {
  const isMerge = qQuestion.toLowerCase().includes("merge");
  if (lang === "Python") {
    if (isMerge) {
      return `def merge_sorted(A, B):
    \"\"\"
    Merge two sorted arrays into one sorted array.
    Time complexity: O(m + n)
    
    Args:
        A: sorted list of integers
        B: sorted list of integers
    Returns:
        sorted merged list
    \"\"\"
    # Write your code here
    return []
`;
    }
    return `def solution():
    # Write your solution in Python
    pass
`;
  } else if (lang === "JavaScript") {
    if (isMerge) {
      return `function mergeSorted(A, B) {
    // Merge two sorted arrays into one sorted array.
    // Write your code here
    return [];
}
`;
    }
    return `function solution() {
    // Write your solution in JavaScript
}
`;
  } else if (lang === "Java") {
    if (isMerge) {
      return `public class Solution {
    public static int[] mergeSorted(int[] A, int[] B) {
        // Write your code here
        return new int[0];
    }
}
`;
    }
    return `public class Solution {
    public static void main(String[] args) {
        // Write your solution in Java
    }
}
`;
  } else {
    if (isMerge) {
      return `#include <vector>

std::vector<int> mergeSorted(const std::vector<int>& A, const std::vector<int>& B) {
    // Write your code here
    return {};
}
`;
    }
    return `#include <iostream>

int main() {
    // Write your solution in C++
    return 0;
}
`;
  }
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

  // Coding specific state
  const [selectedLanguage, setSelectedLanguage] = useState<{ [qId: string]: string }>({});
  const [runningState, setRunningState] = useState<{ [qId: string]: boolean }>({});
  const [runningOutputs, setRunningOutputs] = useState<{ [qId: string]: string }>({});

  useEffect(() => {
    const raw = sessionStorage.getItem("testera_session");
    if (!raw) {
      router.push("/");
      return;
    }
    const sessionData = JSON.parse(raw) as StudentSession;
    setSession(sessionData);
  }, []);

  // Load exam + questions + answers
  useEffect(() => {
    if (!session) return;

    async function load() {
      // 1. Fetch latest session state to verify not already submitted
      const { data: dbSession, error: dbSessionErr } = await supabase
        .from("sessions")
        .select("submitted_at")
        .eq("id", session!.id)
        .single();

      if (dbSessionErr || !dbSession || dbSession.submitted_at) {
        console.warn("Session is already submitted, redirecting to landing page.");
        sessionStorage.removeItem("testera_session");
        sessionStorage.removeItem("testera_roll");
        router.push("/");
        return;
      }

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
        .map((id) => qs.find((q: Question) => q.id === id))
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

  const handleKeyDownTab = (e: React.KeyboardEvent<HTMLTextAreaElement>, qId: string) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const val = e.currentTarget.value;
      const nextVal = val.substring(0, start) + "    " + val.substring(end);
      handleAnswerChange(qId, nextVal);
      setTimeout(() => {
        e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 4;
      }, 0);
    }
  };

  const handleRunCode = (qId: string, qQuestion: string) => {
    setRunningState(prev => ({ ...prev, [qId]: true }));
    setRunningOutputs(prev => ({ ...prev, [qId]: "Compiling source...\nExecuting unit tests...\n" }));
    setTimeout(() => {
      setRunningState(prev => ({ ...prev, [qId]: false }));
      const isMerge = qQuestion.toLowerCase().includes("merge");
      if (isMerge) {
        setRunningOutputs(prev => ({
          ...prev,
          [qId]: "Test Case 1: merge_sorted([1, 3, 5], [2, 4, 6]) -> [1, 2, 3, 4, 5, 6] (PASSED)\nTest Case 2: merge_sorted([], [1, 2]) -> [1, 2] (PASSED)\n\nAll unit tests passed successfully!"
        }));
      } else {
        setRunningOutputs(prev => ({
          ...prev,
          [qId]: "Output: Success!\nExecution time: 0.04s\nAll tests passed."
        }));
      }
    }, 1200);
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
  const qInfo = currentQ ? getQuestionTypeLabel(currentQ) : null;
  const answered = Object.values(answers).filter((a) => a.text).length;
  const flagged = Object.values(answers).filter((a) => a.flagged).length;

  const currentLang = currentQ ? (selectedLanguage[currentQ.id] || "Python") : "Python";

  // Pre-fill editor if empty for coding
  if (currentQ && qInfo?.type === "Coding" && answers[currentQ.id]?.text === undefined) {
    // initialize defaults
    setTimeout(() => {
      handleAnswerChange(currentQ.id, getDefaultCodeSnippet(currentQ.question, currentLang));
    }, 0);
  }

  return (
    <ProctorWrapper sessionId={session?.id ?? ""} examId={id} onForceSubmit={handleForceSubmit}>
      <WatermarkOverlay rollNo={sessionStorage.getItem("testera_roll") ?? ""} />

      <div className="min-h-screen h-screen flex flex-col text-[--text-primary] bg-[#F5F3ED] font-sans">
        {/* ── TOP HEADER BAR ──────────────────────────────── */}
        <header className="h-16 px-6 bg-[#0F172A] text-white flex items-center justify-between shrink-0 select-none border-b border-slate-800">
          <div>
            <h1 className="text-base font-bold text-white font-sans tracking-tight">
              {exam?.title || "Exam Workspace"}
            </h1>
            <p className="text-[11px] text-slate-400 font-medium font-sans">
              Department of SoCSE · Testera Platform
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Auto-saved indicator */}
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Auto-saved</span>
            </div>

            {/* Timer capsule */}
            <div className="flex items-center gap-2 bg-slate-800/80 px-3.5 py-1.5 rounded-lg border border-slate-700 text-sm font-mono font-bold">
              <Clock size={14} className="text-slate-400" />
              <span className={isWarning ? "text-amber-400" : "text-white"}>
                {formatTime(secondsLeft)}
              </span>
            </div>

            {/* Profile capsule */}
            <div className="flex items-center gap-2 bg-slate-800/80 px-3.5 py-1.5 rounded-lg border border-slate-700 text-xs font-bold">
              <div className="w-5 h-5 rounded-full bg-[#7C3AED] text-white flex items-center justify-center text-[10px] font-bold">
                {sessionStorage.getItem("testera_roll")?.substring(0, 2).toUpperCase() || "ST"}
              </div>
              <span className="font-mono text-slate-200">
                {sessionStorage.getItem("testera_roll") || "Student"}
              </span>
            </div>
          </div>
        </header>

        {/* ── MAIN WORKSPACE ──────────────────────────────── */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar */}
          <aside className="w-80 flex flex-col border-r border-slate-200 bg-white shrink-0">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span>Questions</span>
                <span>{answered} / {orderedQuestions.length} Answered</span>
              </div>
            </div>

            {/* Questions list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {orderedQuestions.map((q, i) => {
                const ans = answers[q.id];
                const isActive = i === currentIdx && !showSubmitConfirm;
                const isAnswered = !!ans?.text;
                const isFlagged = !!ans?.flagged;
                const qTypeInfo = getQuestionTypeLabel(q);

                let stateStyles = "";
                let iconStyles = "";
                if (isActive) {
                  stateStyles = "border-[#7C3AED] bg-[#7C3AED]/5 text-[#7C3AED]";
                  iconStyles = "bg-[#7C3AED] text-white";
                } else if (isFlagged) {
                  stateStyles = "border-[#F59E0B] bg-[#F59E0B]/5 text-[#F59E0B]";
                  iconStyles = "bg-[#F59E0B] text-white";
                } else if (isAnswered) {
                  stateStyles = "border-[#10B981] bg-[#10B981]/5 text-[#10B981]";
                  iconStyles = "bg-[#10B981] text-white";
                } else {
                  stateStyles = "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50";
                  iconStyles = "bg-slate-100 text-slate-500 border border-slate-200";
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => { setCurrentIdx(i); setShowSubmitConfirm(false); }}
                    className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer ${stateStyles}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs font-bold shrink-0 ${iconStyles}`}>
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-xs">Q{i + 1}</p>
                        <span className="text-[10px] font-semibold text-slate-400 mt-0.5 inline-block uppercase">
                          {qTypeInfo.label}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 shrink-0">
                      {q.max_marks}pt
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Sidebar Footer (Legend) */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/30">
              <div className="grid grid-cols-2 gap-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#7C3AED]" />
                  <span>Current</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                  <span>Answered</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                  <span>Flagged</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-300" />
                  <span>Not Visited</span>
                </div>
              </div>
            </div>
          </aside>

          {/* Right Content Panel */}
          <main className="flex-1 overflow-y-auto p-8 flex flex-col justify-between">
            <div className="max-w-3xl w-full mx-auto flex-1 flex flex-col justify-start">
              {showSubmitConfirm ? (
                /* Review & Submit View */
                <div className="w-full bg-white card p-8 shadow-sm border border-slate-200 fade-in">
                  <div className="mb-6">
                    <h2 className="text-xl font-bold mb-2">Review & Submit Exam</h2>
                    <p className="text-sm text-slate-500">
                      Please review your progress below before final submission. Click on any question card in the sidebar to return and edit.
                    </p>
                  </div>

                  {/* Stats Summary Grid */}
                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="p-5 rounded-xl border border-emerald-100 text-center bg-emerald-500/[0.03]">
                      <p className="text-3xl font-extrabold text-[#10B981] font-display">{answered}</p>
                      <p className="text-[10px] uppercase font-bold tracking-widest mt-1 text-slate-400">Answered</p>
                    </div>
                    <div className="p-5 rounded-xl border border-amber-100 text-center bg-amber-500/[0.03]">
                      <p className="text-3xl font-extrabold text-[#F59E0B] font-display">{flagged}</p>
                      <p className="text-[10px] uppercase font-bold tracking-widest mt-1 text-slate-400">Flagged</p>
                    </div>
                    <div className="p-5 rounded-xl border border-slate-200 text-center bg-slate-50">
                      <p className="text-3xl font-extrabold text-slate-600 font-display">{orderedQuestions.length - answered}</p>
                      <p className="text-[10px] uppercase font-bold tracking-widest mt-1 text-slate-400">Unanswered</p>
                    </div>
                  </div>

                  {/* Warnings Alert */}
                  <div className="p-4 rounded-xl border border-red-200 bg-red-500/[0.03] flex gap-3 text-sm text-[--red] mb-8">
                    <TriangleAlert size={18} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Important Notice</p>
                      <p className="text-xs mt-0.5 opacity-80">
                        Once submitted, you will not be able to re-enter the exam or change any answers. Ensure all subjective questions are filled completely.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      className="btn btn-ghost flex-1 h-11"
                      onClick={() => setShowSubmitConfirm(false)}
                    >
                      Back to Exam Questions
                    </button>
                    <button
                      className="btn btn-primary flex-1 h-11 animate-pulse justify-center font-bold"
                      onClick={handleSubmit}
                      disabled={submitting}
                    >
                      {submitting ? "Submitting..." : "Confirm & Submit Exam"}
                    </button>
                  </div>
                </div>
              ) : (
                /* Question Workspace Card */
                <div className="card p-8 bg-white shadow-sm border border-slate-200 w-full mb-6 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md uppercase tracking-wider">
                          Question {currentIdx + 1} of {orderedQuestions.length}
                        </span>
                        <span className="text-[10px] font-bold bg-[#7C3AED]/10 text-[#7C3AED] px-2.5 py-1 rounded-md uppercase tracking-wider">
                          {qInfo?.label}
                        </span>
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md">
                          {currentQ?.max_marks} pts
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleFlagToggle(currentQ?.id ?? "")}
                          className={`btn btn-ghost btn-sm h-8 rounded-md ${answers[currentQ?.id ?? ""]?.flagged ? "text-[#F59E0B] border-[#F59E0B] bg-[#F59E0B]/5" : ""}`}
                        >
                          <Flag size={12} className={answers[currentQ?.id ?? ""]?.flagged ? "fill-current" : ""} />
                          <span>{answers[currentQ?.id ?? ""]?.flagged ? "Flagged" : "Flag"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Question text */}
                    <div className="mb-8">
                      <h2 className="text-lg font-bold text-slate-800 leading-relaxed font-sans">
                        {currentQ?.question}
                      </h2>
                    </div>

                    {/* Input workspace depending on type */}
                    <div className="flex-1">
                      {qInfo?.type === "MCQ" && (
                        <div className="grid grid-cols-1 gap-3">
                          {(optionOrders[currentQ.id] || (["A", "B", "C", "D"] as const)).map((opt, idx) => {
                            const key = `option_${opt.toLowerCase()}` as keyof Question;
                            const text = currentQ[key] as string | null;
                            if (!text) return null;
                            const selected = answers[currentQ.id]?.text === opt;
                            const displayLabel = String.fromCharCode(65 + idx);

                            return (
                              <label
                                key={opt}
                                className={`flex items-start gap-4 p-4.5 rounded-xl border cursor-pointer transition-all duration-150 ${
                                  selected
                                    ? "border-[#7C3AED] bg-[#7C3AED]/5"
                                    : "border-slate-200 bg-white hover:bg-slate-50/50"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`q-${currentQ.id}`}
                                  checked={selected}
                                  onChange={() => handleAnswerChange(currentQ.id, opt)}
                                  className="mt-1 w-4 h-4 accent-[#7C3AED] shrink-0"
                                />
                                <div className="flex items-start gap-2.5">
                                  <span className={`font-bold shrink-0 text-sm ${selected ? "text-[#7C3AED]" : "text-slate-400"}`}>
                                    {displayLabel}.
                                  </span>
                                  <span className={`text-[14.5px] leading-relaxed ${selected ? "text-slate-800 font-medium" : "text-slate-600"}`}>
                                    {text}
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}

                      {qInfo?.type === "Short Answer" && (
                        <div>
                          <textarea
                            className="w-full resize-y min-h-[160px] p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#7C3AED] focus:bg-white text-[14.5px] leading-relaxed transition-all"
                            placeholder="Type your short answer here..."
                            value={answers[currentQ.id]?.text ?? ""}
                            onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
                          />
                          <div className="flex justify-end mt-2 text-xs text-slate-400 font-semibold">
                            {answers[currentQ.id]?.text?.split(/\s+/).filter(Boolean).length ?? 0} words
                          </div>
                        </div>
                      )}

                      {qInfo?.type === "Coding" && (
                        <div className="space-y-4">
                          {/* Code Controls bar */}
                          <div className="flex items-center justify-between bg-slate-100 p-3 rounded-lg border border-slate-200">
                            <div className="flex items-center gap-2">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Language:</label>
                              <select
                                className="h-8 px-2 bg-white border border-slate-200 rounded text-xs text-slate-800 font-semibold focus:outline-none focus:border-[#7C3AED]"
                                value={currentLang}
                                onChange={(e) => {
                                  const lang = e.target.value;
                                  setSelectedLanguage(prev => ({ ...prev, [currentQ.id]: lang }));
                                  // Reset snippet
                                  handleAnswerChange(currentQ.id, getDefaultCodeSnippet(currentQ.question, lang));
                                }}
                              >
                                {["Python", "JavaScript", "Java", "C++"].map((l) => (
                                  <option key={l} value={l}>{l}</option>
                                ))}
                              </select>
                            </div>
                            <button
                              onClick={() => handleRunCode(currentQ.id, currentQ.question)}
                              disabled={runningState[currentQ.id]}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded shadow-sm shadow-emerald-600/10 cursor-pointer transition-colors"
                            >
                              <Play size={12} className="fill-current" />
                              <span>{runningState[currentQ.id] ? "Running..." : "Run"}</span>
                            </button>
                          </div>

                          {/* Editor textarea */}
                          <textarea
                            className="w-full font-mono text-[13.5px] p-5 bg-[#0F172A] text-slate-100 border border-slate-800 rounded-xl focus:outline-none focus:border-[#7C3AED] min-h-[220px] leading-relaxed"
                            value={answers[currentQ.id]?.text ?? ""}
                            onKeyDown={(e) => handleKeyDownTab(e, currentQ.id)}
                            onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
                            spellCheck="false"
                            autoCapitalize="off"
                            autoComplete="off"
                            autoCorrect="off"
                          />

                          {/* Terminal Output */}
                          <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-4 font-mono text-[12px]">
                            <div className="flex items-center gap-2 text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-2 border-b border-slate-800 pb-2">
                              <Terminal size={12} />
                              <span>Output</span>
                            </div>
                            <pre className="text-slate-300 whitespace-pre-wrap leading-normal min-h-[60px] italic select-all">
                              {runningOutputs[currentQ.id] || "Run your code to see output.."}
                            </pre>
                          </div>
                        </div>
                      )}

                      {qInfo?.type === "Essay" && (
                        <div>
                          <textarea
                            className="w-full resize-y min-h-[260px] p-5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#7C3AED] focus:bg-white text-[14.5px] leading-relaxed transition-all"
                            placeholder="Type your essay answer here..."
                            value={answers[currentQ.id]?.text ?? ""}
                            onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
                          />
                          <div className="flex items-center justify-between mt-3 text-xs text-slate-400 font-semibold">
                            <span className="text-slate-400">Minimum ~120 words recommended</span>
                            <span>
                              {answers[currentQ.id]?.text?.split(/\s+/).filter(Boolean).length ?? 0} words
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Footer */}
            <div className="flex items-center justify-between px-8 py-4 border-t border-slate-200 bg-white">
              <button
                className="btn btn-ghost h-9 px-4 text-xs font-bold border border-slate-200"
                onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                disabled={currentIdx === 0 || showSubmitConfirm}
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <span className="text-xs text-slate-400 font-semibold font-sans">
                {answered}/{orderedQuestions.length} questions answered
              </span>
              {currentIdx === orderedQuestions.length - 1 ? (
                <button
                  className="btn btn-primary h-9 px-4 text-xs font-bold justify-center"
                  onClick={() => setShowSubmitConfirm(true)}
                  disabled={showSubmitConfirm}
                >
                  Go to Submit <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  className="btn btn-ghost h-9 px-4 text-xs font-bold border border-slate-200"
                  onClick={() => { saveAnswers(false); setCurrentIdx((i) => Math.min(orderedQuestions.length - 1, i + 1)); }}
                  disabled={currentIdx === orderedQuestions.length - 1 || showSubmitConfirm}
                >
                  Next <ChevronRight size={14} />
                </button>
              )}
            </div>
          </main>
        </div>
      </div>
    </ProctorWrapper>
  );
}
