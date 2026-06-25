"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { FileText, ArrowRight } from "lucide-react";

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

    const supabase = createClient();
    const { data: user } = await supabase.auth.getUser();

    const { data, error: dbError } = await supabase
      .from("exams")
      .insert({ title: title.trim(), description: description.trim() || null, created_by: user.user?.id })
      .select()
      .single();

    if (dbError) { setError(dbError.message); setLoading(false); return; }
    router.push(`/admin/exams/${data.id}/upload`);
  }

  return (
    <div className="max-w-xl fade-in">
      <h1 className="text-2xl font-bold mb-2">Create New Exam</h1>
      <p className="mb-8" style={{ color: "var(--text-secondary)" }}>
        Start by naming your exam. You'll add questions and configure settings next.
      </p>

      <div className="glass-card p-8">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6"
          style={{ background: "rgba(108,99,255,0.15)" }}>
          <FileText size={24} style={{ color: "var(--accent-primary)" }} />
        </div>

        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label className="form-label">Exam Title *</label>
            <input type="text" className="form-input" placeholder="e.g. BCA Semester 4 — Data Structures"
              value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Description (optional)</label>
            <textarea className="form-input resize-none h-24" placeholder="Instructions for students..."
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {error && <p className="mb-4 text-sm" style={{ color: "var(--danger)" }}>{error}</p>}

          <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading || !title.trim()}>
            {loading ? <><span className="spinner" />Creating…</> : <>Create & Add Questions <ArrowRight size={18} /></>}
          </button>
        </form>
      </div>
    </div>
  );
}
