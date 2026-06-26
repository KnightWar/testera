"use client";

import { useState, useRef, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  Upload, Download, AlertCircle, CheckCircle2,
  Table2, Trash2, Edit2, ChevronDown, ChevronUp, X
} from "lucide-react";
import { parseExcelQuestions, generateQuestionTemplate, type ParsedQuestion } from "@/lib/excel";
import { createClient } from "@/lib/supabase";
import ExamSubNav from "@/components/admin/ExamSubNav";

export default function ExamUploadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<"idle" | "preview" | "saving" | "done">("idle");
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [errors, setErrors] = useState<{ row: number; field: string; message: string }[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [examTitle, setExamTitle] = useState("");
  const [existingCount, setExistingCount] = useState<number>(0);
  const [loadingExisting, setLoadingExisting] = useState<boolean>(true);

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      // 1. Get exam title
      const { data } = await supabase.from("exams").select("title").eq("id", id).single();
      if (data) setExamTitle(data.title);

      // 2. Get existing count
      const { count, error } = await supabase
        .from("questions")
        .select("*", { count: "exact", head: true })
        .eq("exam_id", id);
      
      if (!error && count !== null) {
        setExistingCount(count);
      }
      setLoadingExisting(false);
    }
    load();
  }, [id]);

  async function handleDeleteAllQuestions() {
    if (!confirm("Are you sure you want to delete all questions for this exam? This action cannot be undone.")) {
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("questions").delete().eq("exam_id", id);
    if (error) {
      alert("Delete failed: " + error.message);
    } else {
      setExistingCount(0);
      alert("All questions deleted successfully.");
    }
    setSaving(false);
  }

  function handleDownloadTemplate() {
    const bytes = generateQuestionTemplate();
    const blob = new Blob([bytes as any], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
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
    await supabase.from("questions").delete().eq("exam_id", id);

    // Insert all questions
    const toInsert = questions.map((q) => ({
      exam_id: id,
      q_no: q.q_no,
      question: q.question,
      type: q.type,
      option_a: q.option_a ?? null,
      option_b: q.option_b ?? null,
      option_c: q.option_c ?? null,
      option_d: q.option_d ?? null,
      correct_answer: q.correct_answer || null,
      max_marks: q.max_marks,
      topic: q.topic ?? null,
      shuffle_options: q.shuffle_options,
    }));

    const { error } = await supabase.from("questions").insert(toInsert);

    if (error) {
      alert("Upload failed: " + error.message);
    } else {
      setExistingCount(questions.length);
      setStage("done");
      setTimeout(() => router.push(`/admin/exams/${id}/config`), 1500);
    }
    setSaving(false);
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 fade-in text-[#F1F5F9]">
      <ExamSubNav examId={id} examTitle={examTitle} />

      {stage === "idle" && (
        <div className="space-y-6">
          {loadingExisting ? (
            <div className="glass-card p-6 text-sm flex items-center gap-2 text-slate-400">
              <span className="spinner" /> Loading current questions state…
            </div>
          ) : existingCount > 0 ? (
            <div className="glass-card p-6 border-l-4 border-l-purple-500 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-500/10">
                  <CheckCircle2 className="text-purple-400" size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Questions Already Uploaded</h3>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    This exam currently has <strong className="text-purple-400">{existingCount}</strong> questions configured.
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    To replace or re-upload questions, upload a new Excel file below. It will overwrite the current list.
                  </p>
                </div>
              </div>
              <button
                onClick={handleDeleteAllQuestions}
                disabled={saving}
                className="btn btn-danger btn-sm whitespace-nowrap shrink-0 flex items-center gap-1.5"
              >
                <Trash2 size={14} /> Delete Questions
              </button>
            </div>
          ) : (
            <div className="glass-card p-6 border-l-4 border-l-amber-500 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-500/10">
                <AlertCircle className="text-amber-400" size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-lg">No Questions Uploaded</h3>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  This exam does not have any questions yet. Download the template, format your questions, and drop them below.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Download template */}
            <div className="glass-card p-6 flex flex-col justify-between h-full">
              <div>
                <h3 className="font-semibold text-lg mb-1">Download Template</h3>
                <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
                  Get the official pre-formatted Excel template with instructions and samples.
                </p>
              </div>
              <button onClick={handleDownloadTemplate} className="btn btn-secondary w-fit">
                <Download size={16} /> Download Template (.xlsx)
              </button>
            </div>

            {/* Upload zone */}
            <div
              className="glass-card border-2 border-dashed p-6 text-center cursor-pointer hover:border-purple-500 transition-colors flex flex-col justify-center items-center h-full"
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
              <Upload size={32} className="mb-2" style={{ color: "var(--accent-primary)" }} />
              <p className="font-semibold text-sm mb-1">Drop your Excel file here or click to browse</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>.xlsx files only · Max 10 MB</p>
            </div>
          </div>

          {/* Concrete Template Preview Guide */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              <Table2 size={20} className="text-purple-400" />
              Unified Question Template Reference
            </h3>
            <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
              Testera parses MCQs and Subjective questions from the same sheet. Format your columns exactly as shown below:
            </p>
            <div className="overflow-x-auto border rounded-xl" style={{ borderColor: "var(--border-subtle)", background: "rgba(255,255,255,0.01)" }}>
              <table className="w-full text-xs text-left border-collapse min-w-[900px]">
                <thead style={{ background: "rgba(255,255,255,0.03)" }}>
                  <tr className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
                    <th className="p-3 font-semibold text-slate-400">Q_No</th>
                    <th className="p-3 font-semibold text-slate-400">Question</th>
                    <th className="p-3 font-semibold text-slate-400">Type</th>
                    <th className="p-3 font-semibold text-slate-400">Option_A</th>
                    <th className="p-3 font-semibold text-slate-400">Option_B</th>
                    <th className="p-3 font-semibold text-slate-400">Option_C</th>
                    <th className="p-3 font-semibold text-slate-400">Option_D</th>
                    <th className="p-3 font-semibold text-slate-400">Correct_Answer</th>
                    <th className="p-3 font-semibold text-slate-400">Max_Marks</th>
                    <th className="p-3 font-semibold text-slate-400">Topic</th>
                    <th className="p-3 font-semibold text-slate-400">Shuffle_Options</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b hover:bg-white/[0.01]" style={{ borderColor: "var(--border-subtle)" }}>
                    <td className="p-3 font-mono font-bold text-purple-400">1</td>
                    <td className="p-3 font-medium max-w-[200px] truncate">What does CPU stand for?</td>
                    <td className="p-3"><span className="badge badge-info">MCQ</span></td>
                    <td className="p-3">Central Processing Unit</td>
                    <td className="p-3">Core Processing Utility</td>
                    <td className="p-3">Computer Power Unit</td>
                    <td className="p-3">Central Power Unit</td>
                    <td className="p-3 font-mono font-bold text-green-400 text-center">A</td>
                    <td className="p-3 font-bold text-center">2</td>
                    <td className="p-3 text-slate-400">Hardware</td>
                    <td className="p-3 text-slate-400 text-center">YES</td>
                  </tr>
                  <tr className="hover:bg-white/[0.01]">
                    <td className="p-3 font-mono font-bold text-purple-400">2</td>
                    <td className="p-3 font-medium max-w-[200px] truncate">Explain the concept of the CIA triad in cybersecurity.</td>
                    <td className="p-3"><span className="badge badge-warning">Subjective</span></td>
                    <td className="p-3 text-slate-600 italic">— leave empty —</td>
                    <td className="p-3 text-slate-600 italic">— leave empty —</td>
                    <td className="p-3 text-slate-600 italic">— leave empty —</td>
                    <td className="p-3 text-slate-600 italic">— leave empty —</td>
                    <td className="p-3 text-slate-600 italic text-center">—</td>
                    <td className="p-3 font-bold text-center">5</td>
                    <td className="p-3 text-slate-400">Security</td>
                    <td className="p-3 text-slate-500 text-center">NO</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-xs">
              <div className="p-4 rounded-xl h-full flex flex-col justify-between" style={{ background: "rgba(108,99,255,0.06)", border: "1px solid rgba(108,99,255,0.15)" }}>
                <div>
                  <strong className="block mb-2 text-purple-300" style={{ fontSize: "0.85rem" }}>MCQ Questions (Multiple Choice)</strong>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li>Must set <code className="text-purple-300">Type</code> to <code className="font-semibold text-purple-200">MCQ</code></li>
                    <li>Requires at least <code className="text-purple-300">Option_A</code> and <code className="text-purple-300">Option_B</code></li>
                    <li><code className="text-purple-300">Correct_Answer</code> must be exactly <code className="font-semibold text-green-300">A</code>, <code className="font-semibold text-green-300">B</code>, <code className="font-semibold text-green-300">C</code>, or <code className="font-semibold text-green-300">D</code></li>
                    <li>Set <code className="text-purple-300">Shuffle_Options</code> to <code className="text-purple-300">YES</code> to randomize option order for each student</li>
                  </ul>
                </div>
              </div>
              <div className="p-4 rounded-xl h-full flex flex-col justify-between" style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}>
                <div>
                  <strong className="block mb-2 text-amber-300" style={{ fontSize: "0.85rem" }}>Subjective Questions (Prose/Written)</strong>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li>Must set <code className="text-amber-300">Type</code> to <code className="font-semibold text-amber-200">Subjective</code></li>
                    <li>Leave Options A–D and Correct_Answer blank (empty cells)</li>
                    <li>Students will answer with a rich, multiline text box</li>
                    <li>Graded automatically using AI semantic evaluation or manually by faculty</li>
                  </ul>
                </div>
              </div>
            </div>
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
