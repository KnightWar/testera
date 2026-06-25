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
}

function getStatus(exam: Exam): "draft" | "upcoming" | "live" | "ended" {
  const now = new Date();
  if (!exam.start_at) return "draft";
  if (now < new Date(exam.start_at)) return "upcoming";
  if (exam.end_at && now > new Date(exam.end_at)) return "ended";
  return "live";
}

const statusColors = {
  draft: "badge-neutral",
  upcoming: "badge-info",
  live: "badge-success",
  ended: "badge-warning",
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
      <div className="flex items-center justify-center pt-20 gap-3" style={{ color: "var(--text-muted)" }}>
        <Loader2 size={20} className="animate-spin" /> Loading exams…
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Exam Manager</h1>
          <p style={{ color: "var(--text-secondary)" }}>Create, configure, and monitor all exams</p>
        </div>
        <Link href="/admin/exams/new" className="btn btn-primary">
          <Plus size={16} /> Create Exam
        </Link>
      </div>

      {/* Confirm delete banner */}
      {confirmId && (
        <div className="flex items-center justify-between gap-4 p-4 rounded-xl"
          style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "var(--danger)" }}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            <span className="font-semibold text-sm">
              Delete &ldquo;{exams.find((e) => e.id === confirmId)?.title}&rdquo;? This will permanently remove all questions, students, and results.
            </span>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => handleDelete(confirmId)} className="btn btn-sm"
              style={{ background: "rgba(248,113,113,0.2)", color: "var(--danger)" }}>
              Yes, Delete
            </button>
            <button onClick={() => setConfirmId(null)} className="btn btn-secondary btn-sm">Cancel</button>
          </div>
        </div>
      )}

      {exams.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <p className="text-5xl mb-4">📝</p>
          <h2 className="text-xl font-bold mb-2">No exams yet</h2>
          <p className="mb-6" style={{ color: "var(--text-secondary)" }}>Create your first exam to get started</p>
          <Link href="/admin/exams/new" className="btn btn-primary">
            <Plus size={16} /> Create First Exam
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {exams.map((exam) => {
            const status = getStatus(exam);
            const isDeleting = deletingId === exam.id;

            return (
              <div key={exam.id} className="glass-card p-6" style={{ opacity: isDeleting ? 0.5 : 1, transition: "opacity 0.2s" }}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-lg font-bold">{exam.title}</h2>
                      <span className={`badge ${statusColors[status]}`}>{status}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm" style={{ color: "var(--text-secondary)" }}>
                      <span>{exam.duration_mins} min</span>
                      {exam.start_at && <span>Opens: {new Date(exam.start_at).toLocaleString()}</span>}
                      {exam.end_at && <span>Closes: {new Date(exam.end_at).toLocaleString()}</span>}
                      {exam.shuffle_questions && <span>🔀 Shuffled</span>}
                      {exam.negative_marking && <span>➖ Negative marking</span>}
                      {exam.pool_size && <span>🎲 Pool: {exam.pool_size} Qs</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4 flex-wrap justify-end">
                    <Link href={`/admin/exams/${exam.id}/upload`} className="btn btn-secondary btn-sm">
                      <Upload size={13} /> Questions
                    </Link>
                    <Link href={`/admin/exams/${exam.id}/config`} className="btn btn-secondary btn-sm">
                      <Settings size={13} /> Config
                    </Link>
                    <Link href={`/admin/exams/${exam.id}/results`} className="btn btn-secondary btn-sm">
                      <BarChart3 size={13} /> Results
                    </Link>
                    <Link href={`/admin/exams/${exam.id}/edit`} className="btn btn-secondary btn-sm"
                      title="Edit exam title/description">
                      <Pencil size={13} /> Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(exam.id)}
                      disabled={isDeleting}
                      className="btn btn-sm"
                      style={{ background: "rgba(248,113,113,0.12)", color: "var(--danger)" }}
                      title="Delete exam"
                    >
                      {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      Delete
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
