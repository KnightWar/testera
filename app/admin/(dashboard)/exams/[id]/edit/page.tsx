"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { cleanExamDescription } from "@/lib/grading";

export default function EditExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from("exams") as any).select("title, description").eq("id", id).single();
      if (data) {
        setTitle(data.title ?? "");
        setDescription(cleanExamDescription(data.description));
      }
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleSave() {
    if (!title.trim()) {
      setMsg({ type: "error", text: "Title cannot be empty." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/exams/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      setMsg({ type: "success", text: "Exam updated successfully!" });
      setTimeout(() => router.push("/admin/exams"), 1200);
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center pt-20 gap-3" style={{ color: "var(--text-muted)" }}>
        <Loader2 size={20} className="animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 fade-in text-[#F1F5F9]">
      <div className="flex items-center gap-3">
        <Link href="/admin/exams" className="btn btn-secondary btn-sm">
          <ArrowLeft size={14} /> Exams
        </Link>
        <h1 className="text-xl font-bold">Edit Exam</h1>
      </div>

      {msg && (
        <div
          className="flex items-center gap-2 p-3 rounded-xl text-sm"
          style={{
            background: msg.type === "success" ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
            color: msg.type === "success" ? "var(--success)" : "var(--danger)",
            border: `1px solid ${msg.type === "success" ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
          }}
        >
          {msg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {msg.text}
        </div>
      )}

      <div className="glass-card p-6 space-y-5">
        <div className="form-group">
          <label className="form-label">Exam Title *</label>
          <input
            type="text"
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Mid-Term Examination 2025"
            maxLength={120}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Description (optional)</label>
          <textarea
            className="form-input"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add any notes about this exam…"
            style={{ resize: "vertical" }}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : <><Save size={15} /> Save Changes</>}
          </button>
          <Link href="/admin/exams" className="btn btn-secondary">
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}
