"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus, Settings, Upload, BarChart3, Pencil, Trash2,
  Loader2, AlertTriangle
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

const statusColors: Record<string, string> = {
  draft: "chip--neutral",
  upcoming: "chip--purple",
  live: "chip--teal",
  ended: "chip--neutral",
};

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
      <div className="flex items-center justify-center pt-20 gap-3 text-secondary">
        <Loader2 size={20} className="animate-spin" /> Loading exams…
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Exam Manager</h1>
          <p className="text-secondary">Create, configure, and monitor all exams</p>
        </div>
        <Link href="/admin/exams/new" className="btn btn--primary">
          <Plus size={16} /> Create Exam
        </Link>
      </div>

      {/* Confirm delete banner */}
      {confirmId && (
        <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-muted"
          style={{ background: "var(--color-danger-subtle)", borderColor: "rgba(228,92,92,0.3)", color: "var(--color-danger)" }}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            <span className="font-semibold text-sm">
              Delete &ldquo;{exams.find((e) => e.id === confirmId)?.title}&rdquo;? This will permanently remove all questions, students, and results.
            </span>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => handleDelete(confirmId)} className="btn btn--danger btn--sm">
              Yes, Delete
            </button>
            <button onClick={() => setConfirmId(null)} className="btn btn--secondary btn--sm">Cancel</button>
          </div>
        </div>
      )}

      {exams.length === 0 ? (
        <div className="card card--elevated p-16 text-center">
          <p className="text-5xl mb-4">📝</p>
          <h2 className="text-xl font-bold mb-2">No exams yet</h2>
          <p className="mb-6 text-secondary">Create your first exam to get started</p>
          <Link href="/admin/exams/new" className="btn btn--primary">
            <Plus size={16} /> Create First Exam
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-6">
          {exams.map((exam) => {
            const status = getStatus(exam);
            const isDeleting = deletingId === exam.id;

            return (
              <div key={exam.id} className="exam-card" style={{ opacity: isDeleting ? 0.5 : 1 }}>
                <div className={`exam-card__accent ${status === 'live' ? 'exam-card__accent--live' : status === 'ended' ? 'exam-card__accent--ended' : ''}`} />
                <div className="flex flex-col h-full">
                  <div className="flex-1">
                    <span className={`exam-card__status ${status === 'live' ? 'exam-card__status--live' : status === 'ended' ? 'exam-card__status--ended' : 'chip chip--purple'}`}>
                      {status.toUpperCase()}
                    </span>
                    <h2 className="exam-card__title">{exam.title}</h2>
                    <div className="exam-card__meta flex flex-wrap gap-2">
                      {exam.start_at && <span>Opens: {new Date(exam.start_at).toLocaleString()}</span>}
                      {exam.end_at && <span>Closes: {new Date(exam.end_at).toLocaleString()}</span>}
                    </div>

                    <div className="exam-card__stats">
                      <div className="exam-card__stat">
                        <div className="exam-card__stat-value">{exam.duration_mins}m</div>
                        <div className="exam-card__stat-label">Duration</div>
                      </div>
                      <div className="exam-card__stat">
                        <div className="exam-card__stat-value">{exam.questions_count ?? 0}</div>
                        <div className="exam-card__stat-label">Questions</div>
                      </div>
                      <div className="exam-card__stat">
                        <div className="exam-card__stat-value">{exam.students_count ?? 0}</div>
                        <div className="exam-card__stat-label">Students</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-3 mb-6">
                      {exam.shuffle_questions && <span className="chip chip--neutral">🔀 Shuffled</span>}
                      {exam.negative_marking && <span className="chip chip--neutral">➖ Negative marking</span>}
                      {exam.pool_size && <span className="chip chip--neutral">🎲 Pool: {exam.pool_size}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap pt-4 border-t border-muted mt-auto">
                    <Link href={`/admin/exams/${exam.id}/upload`} className="btn btn--secondary btn--sm flex-1">
                      <Upload size={13} /> Questions
                    </Link>
                    <Link href={`/admin/exams/${exam.id}/config`} className="btn btn--secondary btn--sm flex-1">
                      <Settings size={13} /> Config
                    </Link>
                    <Link href={`/admin/exams/${exam.id}/results`} className="btn btn--secondary btn--sm flex-1">
                      <BarChart3 size={13} /> Results
                    </Link>
                    <Link href={`/admin/exams/${exam.id}/edit`} className="btn btn--secondary btn--sm" title="Edit exam title/description">
                      <Pencil size={13} />
                    </Link>
                    <button
                      onClick={() => handleDelete(exam.id)}
                      disabled={isDeleting}
                      className="btn btn--danger btn--sm"
                      title="Delete exam"
                    >
                      {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
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
