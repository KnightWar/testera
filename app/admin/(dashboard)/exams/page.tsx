"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus, Pencil, Trash2, Loader2, AlertTriangle
} from "lucide-react";

interface Exam {
  id: string;
  title: string;
  duration_mins: number;
  start_at: string | null;
  end_at: string | null;
  shuffle_questions: boolean;
  negative_marking: boolean;
  pool_size: number | null;
  created_at: string;
  questions_count?: number;
  students_count?: number;
}

function getStatus(exam: Exam): "draft" | "upcoming" | "live" | "ended" {
  const now = new Date();
  if (!exam.start_at) return "draft";
  if (now < new Date(exam.start_at)) return "upcoming";
  if (exam.end_at && now > new Date(exam.end_at)) return "ended";
  return "live";
}

export default function ExamsListPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const fetchExams = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/exams/list");
    if (res.ok) setExams(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchExams(); }, [fetchExams]);

  async function handleDelete(id: string) {
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setDeletingId(id);
    setConfirmId(null);
    try {
      const res = await fetch(`/api/exams/${id}`, { method: "DELETE" });
      if (res.ok) {
        setExams((prev) => prev.filter((e) => e.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center pt-20 gap-3 text-[--text-secondary]">
        <Loader2 size={20} className="animate-spin text-[--accent]" /> Loading exams…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between border-b border-[--border] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-[--text-primary] tracking-tight">Exam Manager</h1>
          <p className="text-sm text-[--text-secondary] mt-1 font-sans">Create, configure, and monitor all exams</p>
        </div>
        <Link href="/admin/exams/new" className="btn btn-primary btn-sm h-8 rounded-md">
          <Plus size={14} /> Create Exam
        </Link>
      </div>

      {/* Confirm delete banner */}
      {confirmId && (
        <div className="flex items-center justify-between gap-4 p-4 rounded-md border bg-red-500/10 border-red-500/20 text-[--red]">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            <span className="font-semibold text-sm">
              Delete &ldquo;{exams.find((e) => e.id === confirmId)?.title}&rdquo;? This will permanently remove all questions, students, and results.
            </span>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => handleDelete(confirmId)} className="btn btn-danger btn-sm">
              Yes, Delete
            </button>
            <button onClick={() => setConfirmId(null)} className="btn btn-ghost btn-sm">Cancel</button>
          </div>
        </div>
      )}

      {exams.length === 0 ? (
        <div className="card p-16 text-center">
          <p className="text-5xl mb-4">📝</p>
          <h2 className="text-lg font-bold mb-2">No exams yet</h2>
          <p className="mb-6 text-[--text-secondary]">Create your first exam to get started</p>
          <Link href="/admin/exams/new" className="btn btn-primary">
            <Plus size={16} /> Create First Exam
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-[14px]">
          {exams.map((exam) => {
            const status = getStatus(exam).toUpperCase();
            const isDeleting = deletingId === exam.id;

            const statusBadgeStyles: Record<string, string> = {
              LIVE: 'badge-green',
              ENDED: 'badge-muted',
              UPCOMING: 'badge-muted',
              DRAFT: 'badge-muted',
            };

            const displayStatus = status === "LIVE" ? "In Progress" : status === "UPCOMING" ? "Upcoming" : status === "DRAFT" ? "Draft" : "Ended";

            return (
              <div
                key={exam.id}
                className="card flex flex-col justify-between hover:-translate-y-0.5 hover:border-[--border-accent] transition-all duration-200 group bg-white"
                style={{ opacity: isDeleting ? 0.5 : 1 }}
              >
                <div>
                  {/* Card header */}
                  <div className="px-6 pt-6 pb-2 flex items-start justify-between">
                    <div className="flex-1 min-w-0 pr-3">
                      <h3 className="text-base font-display font-bold text-[--text-primary] tracking-tight truncate">{exam.title}</h3>
                      <div className="text-xs text-[--text-secondary] mt-2 space-y-1">
                        <p className="flex items-center gap-1.5">
                          <span>📅</span> Opens: {exam.start_at ? new Date(exam.start_at).toLocaleString() : "No start date"}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" /> Closes: {exam.end_at ? new Date(exam.end_at).toLocaleString() : "No close date"}
                        </p>
                      </div>
                    </div>
                    <span className={`badge ${statusBadgeStyles[status] || 'badge-muted'} text-[10px] uppercase font-bold shrink-0 tracking-wider`}>
                      <span className="badge-dot" /> {displayStatus}
                    </span>
                  </div>

                  {/* Meta metrics strip */}
                  <div className="border-y border-[--border] py-3 px-6 my-4 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-sm font-display font-bold text-[--text-primary] leading-none">{exam.duration_mins}m</p>
                      <p className="text-[9px] font-bold text-slate-400 tracking-wider uppercase mt-1">Duration</p>
                    </div>
                    <div>
                      <p className="text-sm font-display font-bold text-[--text-primary] leading-none">{exam.questions_count ?? 0}</p>
                      <p className="text-[9px] font-bold text-slate-400 tracking-wider uppercase mt-1">Questions</p>
                    </div>
                    <div>
                      <p className="text-sm font-display font-bold text-[--text-primary] leading-none">{exam.students_count ?? 0}</p>
                      <p className="text-[9px] font-bold text-slate-400 tracking-wider uppercase mt-1">Students</p>
                    </div>
                  </div>

                  {/* Metadata tags */}
                  <div className="px-6 pb-4 flex flex-wrap gap-2">
                    {exam.shuffle_questions && (
                      <span className="badge badge-amber text-[10px]">
                        Shuffled
                      </span>
                    )}
                    <span className="badge badge-purple text-[10px]">
                      Questions
                    </span>
                    {exam.negative_marking && (
                      <span className="badge badge-red text-[10px]">
                        Negative Marking
                      </span>
                    )}
                  </div>
                </div>

                {/* Card footer / actions */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-[--border] bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/exams/${exam.id}/config`}
                      className="btn btn-primary btn-sm h-8 px-4 rounded"
                    >
                      Manage
                    </Link>
                    <Link
                      href="/admin/monitor"
                      className="btn btn-ghost btn-sm h-8 px-4 rounded"
                    >
                      Monitor
                    </Link>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/admin/exams/${exam.id}/edit`}
                      className="flex items-center justify-center w-8 h-8 bg-transparent hover:bg-[--bg-hover] text-[--text-secondary] hover:text-[--text-primary] rounded-md border border-[--border] transition-all duration-150"
                      title="Edit exam details"
                    >
                      <Pencil size={13} />
                    </Link>
                    <button
                      onClick={() => handleDelete(exam.id)}
                      disabled={isDeleting}
                      className="flex items-center justify-center w-8 h-8 bg-transparent hover:bg-[--red-bg] text-[--text-secondary] hover:text-[--red] rounded-md border border-[--border] hover:border-red/10 transition-all duration-150 cursor-pointer"
                      title="Delete exam"
                    >
                      {isDeleting ? <Loader2 size={13} className="animate-spin text-[--accent]" /> : <Trash2 size={13} />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
