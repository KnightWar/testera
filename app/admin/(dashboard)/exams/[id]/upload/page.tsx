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
    <div className="max-w-7xl mx-auto space-y-8 fade-in text-[--text-1]">
      <ExamSubNav examId={id} examTitle={examTitle} />

      {stage === "idle" && (
        <div className="space-y-6">
          {loadingExisting ? (
            <div className="card p-6 text-sm flex items-center gap-2 text-[--text-secondary]">
              <span className="spinner" /> Loading current questions state…
            </div>
          ) : existingCount > 0 ? (
            <div className="flex items-start gap-3 p-4 mb-6 bg-[--accent-muted] border border-[--accent-border] text-[13px] rounded-lg">
              <CheckCircle2 size={16} className="text-[--accent] mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-[--text-primary]">
                  Questions Already Uploaded
                </p>
                <p className="text-[--text-secondary] mt-1">
                  This exam currently has <strong className="text-[--text-primary]">{existingCount}</strong> questions configured.
                  Upload a new Excel file below to overwrite.
                </p>
              </div>
              <button
                onClick={handleDeleteAllQuestions}
                disabled={saving}
                className="ml-auto text-xs font-semibold text-[--red] hover:underline flex items-center gap-1 bg-transparent border-0 cursor-pointer"
              >
                <Trash2 size={12} />
                Delete Questions
              </button>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-4 mb-6 bg-[--accent-muted] border border-[--accent-border] text-[13px] rounded-lg">
              <AlertCircle className="text-[--amber] mt-0.5 shrink-0" size={16} />
              <div>
                <p className="font-bold text-[--text-primary]">
                  No Questions Uploaded
                </p>
                <p className="text-[--text-secondary] mt-1">
                  This exam does not have any questions yet. Download the template, format your questions, and drop them below.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
            {/* Download Template block */}
            <div className="card p-6 flex flex-col justify-between bg-white">
              <div>
                <h3 className="text-sm font-bold text-[--text-primary] mb-1">Download Template</h3>
                <p className="text-xs text-[--text-secondary] mb-4">
                  Get the official pre-formatted Excel template with instructions and samples.
                </p>
              </div>
              <button onClick={handleDownloadTemplate} className="btn btn-ghost btn-sm w-fit">
                <Download size={14} /> Download Template (.xlsx)
              </button>
            </div>

            {/* File drop zone */}
            <div
              className="flex flex-col items-center justify-center min-h-[140px] rounded-xl border-2 border-dashed border-[--border-accent] bg-[--accent-muted] hover:bg-[#E85D04]/10 transition-all duration-200 cursor-pointer p-6"
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
              <Upload size={24} className="text-[--accent] mb-2" />
              <p className="text-sm font-semibold text-[--text-primary]">Drop your Excel file here or click to browse</p>
              <p className="text-xs text-[--text-secondary] mt-1">.xlsx files only · Max 10 MB</p>
            </div>
          </div>

          {/* Unified Question Template Reference */}
          <div className="card overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-[--border]">
              <Table2 size={14} className="text-[--accent-light]" />
              <h3 className="text-sm font-bold text-[--text-primary]">
                Unified Question Template Reference
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[900px]">
                <thead>
                  <tr className="bg-[--bg-surface] border-b border-[--border]">
                    {["Q_No", "Question", "Type", "Option_A", "Option_B", "Option_C", "Option_D", "Correct_Answer", "Max_Marks", "Topic", "Shuffle_Options"].map((col) => (
                      <th key={col} className="px-4 py-3 text-left font-mono text-[--text-secondary] text-[11px] uppercase tracking-wider border-r border-[--border] last:border-r-0">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[--border]">
                  <tr className="bg-[--bg-hover] hover:bg-[--bg-hover]/70 transition-colors duration-100">
                    <td className="px-4 py-3 font-mono text-[--text-secondary] border-r border-[--border]">1</td>
                    <td className="px-4 py-3 font-mono text-[--text-secondary] border-r border-[--border] max-w-[200px] truncate">What does CPU stand for?</td>
                    <td className="px-4 py-3 font-mono border-r border-[--border]"><span className="badge badge-green"><span className="badge-dot" /> MCQ</span></td>
                    <td className="px-4 py-3 font-mono text-[--text-secondary] border-r border-[--border]">Central Processing Unit</td>
                    <td className="px-4 py-3 font-mono text-[--text-secondary] border-r border-[--border]">Core Processing Utility</td>
                    <td className="px-4 py-3 font-mono text-[--text-secondary] border-r border-[--border]">Computer Power Unit</td>
                    <td className="px-4 py-3 font-mono text-[--text-secondary] border-r border-[--border]">Central Power Unit</td>
                    <td className="px-4 py-3 font-mono text-[--text-secondary] border-r border-[--border] font-bold text-center">A</td>
                    <td className="px-4 py-3 font-mono text-[--text-secondary] border-r border-[--border] text-center">2</td>
                    <td className="px-4 py-3 font-mono text-[--text-secondary] border-r border-[--border]">Hardware</td>
                    <td className="px-4 py-3 font-mono text-[--text-secondary] last:border-r-0 text-center">YES</td>
                  </tr>
                  <tr className="bg-[--bg-elevated] hover:bg-[--bg-elevated]/70 transition-colors duration-100">
                    <td className="px-4 py-3 font-mono text-[--text-secondary] border-r border-[--border]">2</td>
                    <td className="px-4 py-3 font-mono text-[--text-secondary] border-r border-[--border] max-w-[200px] truncate">Explain the CIA triad in cybersecurity.</td>
                    <td className="px-4 py-3 font-mono border-r border-[--border]"><span className="badge badge-amber"><span className="badge-dot" /> Subjective</span></td>
                    <td className="px-4 py-3 font-mono text-[--text-muted] border-r border-[--border] italic">—</td>
                    <td className="px-4 py-3 font-mono text-[--text-muted] border-r border-[--border] italic">—</td>
                    <td className="px-4 py-3 font-mono text-[--text-muted] border-r border-[--border] italic">—</td>
                    <td className="px-4 py-3 font-mono text-[--text-muted] border-r border-[--border] italic">—</td>
                    <td className="px-4 py-3 font-mono text-[--text-muted] border-r border-[--border] text-center">—</td>
                    <td className="px-4 py-3 font-mono text-[--text-secondary] border-r border-[--border] text-center">5</td>
                    <td className="px-4 py-3 font-mono text-[--text-secondary] border-r border-[--border]">Security</td>
                    <td className="px-4 py-3 font-mono text-[--text-secondary] last:border-r-0 text-center">NO</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* MCQ vs Subjective legend */}
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[--border] border-t border-[--border]">
              <div className="p-5 bg-[--bg-elevated]">
                <p className="text-sm font-bold text-[--text-primary] flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-[--green]" /> MCQ (Multiple Choice)
                </p>
                <ul className="space-y-1.5 text-xs text-[--text-secondary]">
                  <li className="flex items-start gap-2"><span>·</span> Must set Type to MCQ</li>
                  <li className="flex items-start gap-2"><span>·</span> Requires at least Option_A and Option_B</li>
                  <li className="flex items-start gap-2"><span>·</span> Correct_Answer must be exactly A, B, C, or D</li>
                  <li className="flex items-start gap-2"><span>·</span> Shuffle_Options randomizes choices per student</li>
                </ul>
              </div>
              <div className="p-5 bg-[--bg-elevated]">
                <p className="text-sm font-bold text-[--text-primary] flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-[--amber]" /> Subjective (Prose/Written)
                </p>
                <ul className="space-y-1.5 text-xs text-[--text-secondary]">
                  <li className="flex items-start gap-2"><span>·</span> Must set Type to Subjective</li>
                  <li className="flex items-start gap-2"><span>·</span> Leave options A–D and Correct_Answer blank</li>
                  <li className="flex items-start gap-2"><span>·</span> Students type written prose in a text editor</li>
                  <li className="flex items-start gap-2"><span>·</span> Evaluation is managed semi-automatically or manually</li>
                </ul>
              </div>
            </div>
          </div>

          <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleFileChange} />
        </div>
      )}

      {stage === "preview" && (
        <div className="space-y-5">
          {/* Validation errors */}
          {errors.length > 0 && (
            <div className="bg-[--bg-surface] border border-[--danger-border] rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3 font-semibold text-[--danger]">
                <AlertCircle size={18} /> {errors.length} Validation Error{errors.length > 1 ? "s" : ""}
              </div>
              <ul className="space-y-1.5 text-xs">
                {errors.map((err, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-display font-bold uppercase rounded-pill border bg-[--danger-muted] text-[--danger] border-[--danger-border] shrink-0">Row {err.row}</span>
                    <span className="text-[--text-2]">
                      <strong>{err.field}:</strong> {err.message}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {errors.length === 0 && (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-[--success-muted] border border-[--success-border] text-[--success] text-sm">
              <CheckCircle2 size={18} />
              <span className="font-semibold">{questions.length} questions parsed successfully — ready to upload</span>
            </div>
          )}

          {/* Preview list */}
          <div className="bg-[--bg-surface] border border-[--border-base] rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-[--border-dim] font-semibold text-[--text-1]">
              <Table2 size={18} className="text-[--text-accent]" />
              Question Preview ({questions.length} questions)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[--bg-surface] border-b border-[--border-base]">
                    {["#", "Question", "Type", "Marks", "Topic", ""].map((col) => (
                      <th key={col} className="px-4 py-3 text-left text-[11px] font-body font-medium text-[--text-3] uppercase tracking-[0.07em]">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q, i) => (
                    <>
                      <tr
                        key={q.q_no}
                        className="border-b border-[--border-dim] last:border-0 hover:bg-[--bg-hover] transition-colors duration-100 group cursor-pointer"
                        onClick={() => setExpanded(expanded === i ? null : i)}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-[--text-3]">{q.q_no}</td>
                        <td className="px-4 py-3 text-sm font-display font-medium text-[--text-1] max-w-xs truncate">{q.question}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-display font-bold uppercase rounded-pill border ${q.type === "MCQ" ? "bg-[--info-muted] text-[--info] border-[--border-base]" : "bg-[--warning-muted] text-[--warning] border-[--warning-border]"}`}>{q.type}</span>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-[--text-1]">{q.max_marks}</td>
                        <td className="px-4 py-3 text-xs text-[--text-2]">{q.topic ?? "—"}</td>
                        <td className="px-4 py-3 text-[--text-3] group-hover:text-[--text-1] transition-colors">
                          {expanded === i ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </td>
                      </tr>
                      {expanded === i && (
                        <tr key={`${q.q_no}-exp`} className="bg-[--bg-elevated]/50">
                          <td colSpan={6} className="px-6 py-4 border-b border-[--border-dim] text-sm text-[--text-2]">
                            <strong className="block mb-2 text-[--text-1]">{q.question}</strong>
                            {q.type === "MCQ" && (
                              <ul className="space-y-1.5 mt-2">
                                {(["A", "B", "C", "D"] as const).map((opt) => {
                                  const key = `option_${opt.toLowerCase()}` as keyof ParsedQuestion;
                                  if (!q[key]) return null;
                                  return (
                                    <li key={opt} className={`flex gap-2 text-xs ${q.correct_answer === opt ? "text-[--success] font-semibold" : "text-[--text-2]"}`}>
                                      <span className="shrink-0">{opt}.</span> {q[key] as string}
                                      {q.correct_answer === opt && <CheckCircle2 size={13} className="ml-1 shrink-0" />}
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
            <button onClick={() => { setStage("idle"); setQuestions([]); setErrors([]); }} className="inline-flex items-center gap-2 px-4 py-2.5 bg-transparent hover:bg-[--bg-elevated] text-[--text-2] hover:text-[--text-1] font-display font-medium text-sm rounded-lg border border-[--border-base] transition-all duration-150 cursor-pointer">
              <X size={16} /> Re-upload
            </button>
            <button
              onClick={handleConfirmUpload}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#10B981] hover:bg-[#0da772] active:scale-[0.98] text-white font-display font-semibold text-sm rounded-lg border border-[--accent-border] shadow-sm transition-all duration-150 focus-visible:outline-none focus-visible:shadow-focus cursor-pointer"
              disabled={errors.length > 0 || saving}
            >
              {saving ? <><span className="spinner" /> Saving…</> : `Confirm & Upload ${questions.length} Questions`}
            </button>
          </div>
        </div>
      )}

      {stage === "done" && (
        <div className="bg-[--bg-surface] border border-[--border-base] rounded-xl p-12 text-center shadow-sm">
          <CheckCircle2 size={56} className="mx-auto mb-4 text-[--success]" />
          <h2 className="text-xl font-bold mb-2">Questions uploaded!</h2>
          <p className="text-[--text-2]">Redirecting to exam configuration…</p>
        </div>
      )}
    </div>
  );
}
