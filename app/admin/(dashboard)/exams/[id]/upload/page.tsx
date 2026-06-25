"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Upload, Download, AlertCircle, CheckCircle2,
  Table2, Trash2, Edit2, ChevronDown, ChevronUp, X
} from "lucide-react";
import { parseExcelQuestions, generateQuestionTemplate, type ParsedQuestion } from "@/lib/excel";
import { createClient } from "@/lib/supabase";

export default function ExamUploadPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<"idle" | "preview" | "saving" | "done">("idle");
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [errors, setErrors] = useState<{ row: number; field: string; message: string }[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  function handleDownloadTemplate() {
    const bytes = generateQuestionTemplate();
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "testera_question_template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    const result = parseExcelQuestions(buffer);
    setQuestions(result.questions);
    setErrors(result.errors);
    setStage("preview");
  }

  async function handleConfirmUpload() {
    setSaving(true);
    const supabase = createClient();

    // Delete existing questions for this exam
    await supabase.from("questions").delete().eq("exam_id", params.id);

    // Insert all questions
    const toInsert = questions.map((q) => ({
      exam_id: params.id,
      q_no: q.q_no,
      question: q.question,
      type: q.type,
      option_a: q.option_a ?? null,
      option_b: q.option_b ?? null,
      option_c: q.option_c ?? null,
      option_d: q.option_d ?? null,
      correct_answer: q.correct_answer ?? null,
      max_marks: q.max_marks,
      topic: q.topic ?? null,
      shuffle_options: q.shuffle_options,
    }));

    const { error } = await supabase.from("questions").insert(toInsert);

    if (error) {
      alert("Upload failed: " + error.message);
    } else {
      setStage("done");
      setTimeout(() => router.push(`/admin/exams/${params.id}/config`), 1500);
    }
    setSaving(false);
  }

  return (
    <div className="max-w-5xl fade-in">
      <h1 className="text-2xl font-bold mb-2">Upload Questions</h1>
      <p className="mb-8" style={{ color: "var(--text-secondary)" }}>
        Upload an Excel file following the Testera template. Questions will replace any existing ones for this exam.
      </p>

      {stage === "idle" && (
        <div className="space-y-4">
          {/* Download template */}
          <div className="glass-card p-6 flex items-center justify-between">
            <div>
              <p className="font-semibold mb-1">Step 1: Download Template</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Pre-formatted .xlsx with instructions and sample rows
              </p>
            </div>
            <button onClick={handleDownloadTemplate} className="btn btn-secondary">
              <Download size={16} /> Download Template
            </button>
          </div>

          {/* Upload zone */}
          <div
            className="glass-card border-2 border-dashed p-12 text-center cursor-pointer hover:border-purple-500 transition-colors"
            style={{ borderColor: "var(--border-subtle)" }}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) {
                const dt = new DataTransfer();
                dt.items.add(file);
                if (fileRef.current) { fileRef.current.files = dt.files; }
                handleFileChange({ target: { files: dt.files } } as any);
              }
            }}
          >
            <Upload size={40} className="mx-auto mb-4" style={{ color: "var(--accent-primary)" }} />
            <p className="font-semibold mb-1">Drop your Excel file here or click to browse</p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>.xlsx files only · Max 10 MB</p>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleFileChange} />
        </div>
      )}

      {stage === "preview" && (
        <div className="space-y-5">
          {/* Validation summary */}
          {errors.length > 0 && (
            <div className="glass-card p-5" style={{ borderColor: "rgba(248,113,113,0.3)" }}>
              <div className="flex items-center gap-2 mb-3 font-semibold" style={{ color: "var(--danger)" }}>
                <AlertCircle size={18} /> {errors.length} Validation Error{errors.length > 1 ? "s" : ""}
              </div>
              <ul className="space-y-1">
                {errors.map((err, i) => (
                  <li key={i} className="text-sm flex gap-3">
                    <span className="badge badge-danger shrink-0">Row {err.row}</span>
                    <span style={{ color: "var(--text-secondary)" }}>
                      <strong>{err.field}:</strong> {err.message}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {errors.length === 0 && (
            <div className="flex items-center gap-2 p-4 rounded-xl"
              style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", color: "var(--success)" }}>
              <CheckCircle2 size={18} />
              <span className="font-medium">{questions.length} questions parsed successfully — ready to upload</span>
            </div>
          )}

          {/* Preview table */}
          <div className="glass-card overflow-hidden">
            <div className="flex items-center gap-2 p-5 border-b font-semibold" style={{ borderColor: "var(--border-subtle)" }}>
              <Table2 size={18} style={{ color: "var(--accent-primary)" }} />
              Question Preview ({questions.length} questions)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: "rgba(255,255,255,0.03)" }}>
                  <tr>
                    {["#", "Question", "Type", "Marks", "Topic", ""].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider"
                        style={{ color: "var(--text-muted)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q, i) => (
                    <>
                      <tr
                        key={q.q_no}
                        className="border-t hover:bg-white/[0.02] transition-colors cursor-pointer"
                        style={{ borderColor: "var(--border-subtle)" }}
                        onClick={() => setExpanded(expanded === i ? null : i)}
                      >
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-muted)" }}>{q.q_no}</td>
                        <td className="px-4 py-3 max-w-xs truncate">{q.question}</td>
                        <td className="px-4 py-3">
                          <span className={`badge ${q.type === "MCQ" ? "badge-info" : "badge-warning"}`}>{q.type}</span>
                        </td>
                        <td className="px-4 py-3 font-semibold">{q.max_marks}</td>
                        <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{q.topic ?? "—"}</td>
                        <td className="px-4 py-3">
                          {expanded === i ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </td>
                      </tr>
                      {expanded === i && (
                        <tr key={`${q.q_no}-exp`} style={{ background: "rgba(255,255,255,0.02)" }}>
                          <td colSpan={6} className="px-6 py-4 text-sm" style={{ color: "var(--text-secondary)" }}>
                            <strong className="block mb-2" style={{ color: "var(--text-primary)" }}>{q.question}</strong>
                            {q.type === "MCQ" && (
                              <ul className="space-y-1">
                                {(["A", "B", "C", "D"] as const).map((opt) => {
                                  const key = `option_${opt.toLowerCase()}` as keyof ParsedQuestion;
                                  if (!q[key]) return null;
                                  return (
                                    <li key={opt} className={`flex gap-2 ${q.correct_answer === opt ? "text-green-400 font-semibold" : ""}`}>
                                      <span className="shrink-0">{opt}.</span> {q[key] as string}
                                      {q.correct_answer === opt && <CheckCircle2 size={14} className="ml-1 shrink-0" />}
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button onClick={() => { setStage("idle"); setQuestions([]); setErrors([]); }} className="btn btn-secondary">
              <X size={16} /> Re-upload
            </button>
            <button
              onClick={handleConfirmUpload}
              className="btn btn-primary"
              disabled={errors.length > 0 || saving}
            >
              {saving ? <><span className="spinner" /> Saving…</> : `Confirm & Upload ${questions.length} Questions`}
            </button>
          </div>
        </div>
      )}

      {stage === "done" && (
        <div className="glass-card p-12 text-center">
          <CheckCircle2 size={56} className="mx-auto mb-4" style={{ color: "var(--success)" }} />
          <h2 className="text-xl font-bold mb-2">Questions uploaded!</h2>
          <p style={{ color: "var(--text-secondary)" }}>Redirecting to exam configuration…</p>
        </div>
      )}
    </div>
  );
}
