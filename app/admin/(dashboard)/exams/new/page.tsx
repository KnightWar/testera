"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, ArrowRight, ArrowLeft } from "lucide-react";

export default function NewExamPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "Failed to create exam.");
        setLoading(false);
      } else {
        router.push(`/admin/exams/${data.id}/upload`);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6 fade-in text-[--text-primary]">
      <div className="flex items-center gap-3">
        <Link href="/admin/exams" className="btn btn-secondary btn-sm h-8 rounded-md">
          <ArrowLeft size={14} /> Exams
        </Link>
        <h1 className="text-xl font-bold font-sans">Create New Exam</h1>
      </div>

      <div className="card p-8 bg-white border border-slate-200">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 bg-slate-50 border border-slate-200">
          <FileText size={24} className="text-[--accent]" />
        </div>

        <form onSubmit={handleCreate} className="space-y-5">
          <div className="form-group">
            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
              Exam Title *
            </label>
            <input
              type="text"
              className="w-full h-10 bg-[--bg-input] text-[--text-primary] placeholder:text-slate-400 border border-[--border] rounded-lg px-4 text-sm font-sans focus:outline-none focus:border-[--accent] transition-all duration-150"
              placeholder="e.g. BCA Semester 4 — Data Structures"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
              Description (optional)
            </label>
            <textarea
              className="w-full bg-[--bg-input] text-[--text-primary] placeholder:text-slate-400 border border-[--border] rounded-lg p-4 text-sm font-sans focus:outline-none focus:border-[--accent] transition-all duration-150 resize-none h-28"
              placeholder="Instructions for students..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg text-sm bg-[--danger-muted] text-[--danger] border border-[--danger-border]">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary w-full h-11 justify-center font-bold text-sm shadow-sm"
            disabled={loading || !title.trim()}
          >
            {loading ? (
              <>
                <span className="spinner" /> Creating…
              </>
            ) : (
              <>
                Create & Add Questions <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
