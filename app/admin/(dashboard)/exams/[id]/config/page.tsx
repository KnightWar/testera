"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Settings, Clock, Users, Shuffle, Eye, Minus, Upload,
  Download, Save, AlertCircle, CheckCircle2, Trash2,
  KeyRound, RefreshCw, Copy, Check
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { parseStudentList, generateStudentTemplate } from "@/lib/excel";
import { generateAccessCode, getExamAccessCode, setExamAccessCode } from "@/lib/grading";
import type { Database } from "@/lib/database.types";
import ExamSubNav from "@/components/admin/ExamSubNav";

type Exam = Database["public"]["Tables"]["exams"]["Row"] & { access_code?: string | null };
type Student = Database["public"]["Tables"]["students"]["Row"];

export default function ExamConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const [exam, setExam] = useState<Partial<Exam>>({});
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [studentFile, setStudentFile] = useState<File | null>(null);
  const [studentErrors, setStudentErrors] = useState<string[]>([]);
  const [saveMsg, setSaveMsg] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    async function load() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const examRes = await (supabase.from("exams") as any).select("*").eq("id", id).single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const studentsRes = await (supabase.from("students") as any).select("*").eq("exam_id", id).order("roll_no");

      if (examRes.data) {
        const examData = examRes.data as Exam;
        // Extract access code from description
        let code = getExamAccessCode(examData.description);
        if (!code) {
          code = generateAccessCode();
          const newDesc = setExamAccessCode(examData.description, code);
          await supabase.from("exams").update({ description: newDesc }).eq("id", id);
          examData.description = newDesc;
          
          // Also update all existing students' access codes
          await supabase.from("students").update({ access_code: code }).eq("exam_id", id);
        }
        examData.access_code = code;
        setExam(examData);
      }
      setStudents((studentsRes.data ?? []) as Student[]);
      setLoading(false);
    }
    load();
  }, [id]);

  // Auto-calculate end_at when start_at or duration_mins changes
  const recalcEndAt = useCallback((startAt: string | null | undefined, durationMins: number | null | undefined) => {
    if (!startAt || !durationMins) return;
    const start = new Date(startAt);
    const end = new Date(start.getTime() + durationMins * 60 * 1000);
    setExam((p) => ({ ...p, end_at: end.toISOString() }));
  }, []);

  function handleDurationChange(val: number) {
    setExam((p) => {
      const updated = { ...p, duration_mins: val };
      if (p.start_at) {
        const start = new Date(p.start_at);
        const end = new Date(start.getTime() + val * 60 * 1000);
        updated.end_at = end.toISOString();
      }
      return updated;
    });
  }

  function handleStartAtChange(val: string) {
    setExam((p) => {
      const updated = { ...p, start_at: val ? new Date(val).toISOString() : null };
      if (val && p.duration_mins) {
        const start = new Date(val);
        const end = new Date(start.getTime() + (p.duration_mins as number) * 60 * 1000);
        updated.end_at = end.toISOString();
      }
      return updated;
    });
  }

  async function handleRegenerateCode() {
    const code = generateAccessCode();
    const newDesc = setExamAccessCode(exam.description, code);
    await supabase.from("exams").update({ description: newDesc }).eq("id", id);
    
    // Also update all existing students' access codes
    await supabase.from("students").update({ access_code: code }).eq("exam_id", id);
    
    setExam((p) => ({ ...p, description: newDesc, access_code: code }));
    setSaveMsg("New access code generated!");
    setTimeout(() => setSaveMsg(""), 2500);
  }

  function handleCopyCode() {
    if (exam.access_code) {
      navigator.clipboard.writeText(exam.access_code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  }

  async function handleSaveConfig() {
    setSaving(true);
    const { error } = await supabase.from("exams").update({
      duration_mins: Number(exam.duration_mins) || 60,
      start_at: exam.start_at || null,
      end_at: exam.end_at || null,
      shuffle_questions: exam.shuffle_questions ?? true,
      show_score_immediately: exam.show_score_immediately ?? false,
      negative_marking: exam.negative_marking ?? false,
      negative_fraction: Number(exam.negative_fraction) || 0.25,
      pool_size: exam.pool_size ? Number(exam.pool_size) : null,
    } as any).eq("id", id);

    if (error) setSaveMsg("Error: " + error.message);
    else setSaveMsg("Saved!");
    setSaving(false);
    setTimeout(() => setSaveMsg(""), 2500);
  }

  async function handleStudentUpload() {
    if (!studentFile) return;
    const buffer = await studentFile.arrayBuffer();
    const { students: parsed, errors } = parseStudentList(buffer);
    setStudentErrors(errors);
    if (errors.length > 0) return;

    // Students share the exam access code — no per-student code needed
    const toInsert = parsed.map((s) => ({
      exam_id: id,
      roll_no: s.roll_no,
      name: s.name,
      access_code: exam.access_code || generateAccessCode(),
    }));

    const { error } = await supabase.from("students").upsert(toInsert as any, { onConflict: "exam_id,roll_no" });
    if (!error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from("students") as any).select("*").eq("exam_id", id).order("roll_no");
      setStudents(data ?? []);
      setStudentFile(null);
    }
  }

  function handleDownloadStudentTemplate() {
    const bytes = generateStudentTemplate();
    const blob = new Blob([bytes as any], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "testera_student_template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="flex items-center gap-2 pt-12"><span className="spinner" /> Loading…</div>;

  const startAtLocal = exam.start_at ? new Date(exam.start_at).toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).slice(0, 16) : "";
  const endAtLocal = exam.end_at ? new Date(exam.end_at).toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).slice(0, 16) : "";

  return (
    <div className="max-w-7xl mx-auto space-y-8 fade-in text-[#F1F5F9]">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex-1">
          <ExamSubNav examId={id} examTitle={exam.title} />
        </div>
        <button onClick={handleSaveConfig} className="btn btn-primary h-fit" disabled={saving}>
          {saving ? <><span className="spinner" />Saving…</> : <><Save size={16} />Save Config</>}
        </button>
      </div>

      {saveMsg && (
        <div className="flex items-center gap-2 p-3 rounded-xl text-sm"
          style={{ background: "rgba(52,211,153,0.1)", color: "var(--success)", border: "1px solid rgba(52,211,153,0.3)" }}>
          <CheckCircle2 size={16} />{saveMsg}
        </div>
      )}

      {/* Exam Access Code Banner */}
      <div className="glass-card p-6 border-l-4" style={{ borderLeftColor: "var(--accent-secondary)" }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(124,58,237,0.15)" }}>
              <KeyRound size={20} style={{ color: "var(--accent-primary)" }} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: "var(--text-muted)" }}>
                Exam Access Code — Share with all students
              </p>
              <div className="flex items-center gap-3">
                <span className="font-mono text-2xl font-bold tracking-[0.25em]" style={{ color: "var(--accent-secondary)" }}>
                  {exam.access_code ?? "—"}
                </span>
                <button onClick={handleCopyCode} className="btn btn-secondary btn-sm py-1 px-2" title="Copy code">
                  {codeCopied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                </button>
              </div>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Valid only during the exam window (Opens At → Closes At). All students in this exam use this single code.
              </p>
            </div>
          </div>
          <button onClick={handleRegenerateCode} className="btn btn-secondary btn-sm shrink-0 flex items-center gap-2">
            <RefreshCw size={14} /> Regenerate Code
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Timer + Window */}
          <div className="glass-card p-6">
            <h2 className="font-bold mb-5 flex items-center gap-2"><Clock size={17} style={{ color: "var(--accent-primary)" }} />Timing</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="form-group">
                <label className="form-label">Duration (minutes)</label>
                <input type="number" className="form-input" min={5} max={300}
                  value={exam.duration_mins ?? 60}
                  onChange={(e) => handleDurationChange(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label className="form-label">Opens At</label>
                <input type="datetime-local" className="form-input"
                  value={startAtLocal}
                  onChange={(e) => handleStartAtChange(e.target.value)} />
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Sets when access code becomes valid</p>
              </div>
              <div className="form-group">
                <label className="form-label">Closes At <span className="text-xs font-normal text-purple-400">(auto-calculated)</span></label>
                <input type="datetime-local" className="form-input"
                  value={endAtLocal}
                  onChange={(e) => setExam((p) => ({ ...p, end_at: e.target.value ? new Date(e.target.value).toISOString() : null }))} />
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Auto-fills from Opens At + Duration. Override manually if needed.</p>
              </div>
            </div>
          </div>

          {/* Question Settings */}
          <div className="glass-card p-6">
            <h2 className="font-bold mb-5 flex items-center gap-2"><Shuffle size={17} style={{ color: "var(--accent-primary)" }} />Question Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <label className="flex items-center justify-between p-4 rounded-xl cursor-pointer"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)" }}>
                <div>
                  <p className="font-medium text-sm">Shuffle Question Order</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Each student gets a different order</p>
                </div>
                <input type="checkbox" className="w-5 h-5 accent-purple-500"
                  checked={exam.shuffle_questions ?? true}
                  onChange={(e) => setExam((p) => ({ ...p, shuffle_questions: e.target.checked }))} />
              </label>

              <div className="form-group">
                <label className="form-label">Question Pool Size (optional)</label>
                <input type="number" className="form-input" placeholder="Leave blank to use all questions"
                  min={1} value={exam.pool_size ?? ""}
                  onChange={(e) => setExam((p) => ({ ...p, pool_size: e.target.value ? Number(e.target.value) : null }))} />
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>e.g. 30 from a bank of 60</p>
              </div>
            </div>
          </div>

          {/* Grading Settings */}
          <div className="glass-card p-6">
            <h2 className="font-bold mb-5 flex items-center gap-2"><Settings size={17} style={{ color: "var(--accent-primary)" }} />Grading & Results</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <label className="flex items-center justify-between p-4 rounded-xl cursor-pointer"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)" }}>
                <div>
                  <p className="font-medium text-sm">Show Score Immediately</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>After submit, student sees their score</p>
                </div>
                <input type="checkbox" className="w-5 h-5 accent-purple-500"
                  checked={exam.show_score_immediately ?? false}
                  onChange={(e) => setExam((p) => ({ ...p, show_score_immediately: e.target.checked }))} />
              </label>

              <label className="flex items-center justify-between p-4 rounded-xl cursor-pointer"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)" }}>
                <div>
                  <p className="font-medium text-sm">Negative Marking</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Deduct fraction of marks for wrong MCQ</p>
                </div>
                <input type="checkbox" className="w-5 h-5 accent-purple-500"
                  checked={exam.negative_marking ?? false}
                  onChange={(e) => setExam((p) => ({ ...p, negative_marking: e.target.checked }))} />
              </label>

              {exam.negative_marking && (
                <div className="form-group">
                  <label className="form-label">Negative Fraction (e.g. 0.25 = ¼ mark)</label>
                  <input type="number" className="form-input" min={0.1} max={1} step={0.05}
                    value={exam.negative_fraction ?? 0.25}
                    onChange={(e) => setExam((p) => ({ ...p, negative_fraction: Number(e.target.value) }))} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Students */}
        <div className="lg:col-span-1">
          <div className="glass-card p-6">
            <h2 className="font-bold mb-4 flex items-center gap-2"><Users size={17} style={{ color: "var(--accent-primary)" }} />Students ({students.length})</h2>

            <div className="space-y-4 mb-5">
              <div className="form-group mb-0">
                <div className="flex items-center justify-between mb-1">
                  <label className="form-label mb-0">Upload Student List</label>
                  <button
                    onClick={handleDownloadStudentTemplate}
                    className="text-[10px] text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 hover:underline border-none bg-transparent cursor-pointer"
                  >
                    <Download size={10} /> Template (.xlsx)
                  </button>
                </div>
                <input type="file" accept=".xlsx,.csv" className="form-input text-xs bg-[#172037]"
                  onChange={(e) => setStudentFile(e.target.files?.[0] ?? null)} />
              </div>
              <div className="flex gap-2">
                <button onClick={handleStudentUpload} disabled={!studentFile} className="btn btn-secondary btn-sm flex-1">
                  <Upload size={14} /> Import
                </button>
              </div>
            </div>

            {studentErrors.length > 0 && (
              <div className="mb-4 p-3 rounded-xl text-xs" style={{ background: "rgba(248,113,113,0.1)", color: "var(--danger)", border: "1px solid rgba(248,113,113,0.3)" }}>
                <AlertCircle size={12} className="inline mr-1 shrink-0" />
                {studentErrors.join(" · ")}
              </div>
            )}

            {students.length > 0 && (
              <div className="overflow-hidden rounded-xl border max-h-[350px] overflow-y-auto" style={{ borderColor: "var(--border-subtle)" }}>
                <table className="w-full text-xs">
                  <thead style={{ background: "rgba(255,255,255,0.03)" }} className="sticky top-0 z-10">
                    <tr className="border-b" style={{ borderColor: "var(--border-subtle)", background: "#11121C" }}>
                      {["Roll No", "Name"].map((h) => (
                        <th key={h} className="text-left px-3 py-2 font-semibold uppercase tracking-wider text-[10px]"
                          style={{ color: "var(--text-muted)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.id} className="border-t" style={{ borderColor: "var(--border-subtle)" }}>
                        <td className="px-3 py-2 font-mono text-[11px] truncate max-w-[80px]">{s.roll_no}</td>
                        <td className="px-3 py-2 font-medium truncate max-w-[120px]">{s.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
