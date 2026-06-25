"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Settings, Clock, Users, Shuffle, Eye, Minus, Upload,
  Download, Save, AlertCircle, CheckCircle2, Trash2
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { parseStudentList } from "@/lib/excel";
import { generateAccessCode } from "@/lib/grading";
import type { Database } from "@/lib/database.types";

type Exam = Database["public"]["Tables"]["exams"]["Row"];
type Student = Database["public"]["Tables"]["students"]["Row"];

export default function ExamConfigPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const supabase = createClient();
  const [exam, setExam] = useState<Partial<Exam>>({});
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [studentFile, setStudentFile] = useState<File | null>(null);
  const [studentErrors, setStudentErrors] = useState<string[]>([]);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    async function load() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const examRes = await (supabase.from("exams") as any).select("*").eq("id", params.id).single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const studentsRes = await (supabase.from("students") as any).select("*").eq("exam_id", params.id).order("roll_no");
      if (examRes.data) setExam(examRes.data as Exam);
      setStudents((studentsRes.data ?? []) as Student[]);
      setLoading(false);
    }
    load();
  }, [params.id]);

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
    }).eq("id", params.id);

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

    // Upsert students with generated access codes
    const toInsert = parsed.map((s) => ({
      exam_id: params.id,
      roll_no: s.roll_no,
      name: s.name,
      access_code: generateAccessCode(),
    }));

    const { error } = await supabase.from("students").upsert(toInsert, { onConflict: "exam_id,roll_no" });
    if (!error) {
      const { data } = await supabase.from("students").select("*").eq("exam_id", params.id).order("roll_no");
      setStudents(data ?? []);
      setStudentFile(null);
    }
  }

  function handleDownloadCodes() {
    // Simple CSV download of roll_no + access_code
    const csv = "Roll No,Name,Access Code\n" + students.map((s) => `${s.roll_no},${s.name},${s.access_code}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "student_access_codes.csv";
    a.click();
  }

  if (loading) return <div className="flex items-center gap-2 pt-12"><span className="spinner" /> Loading…</div>;

  return (
    <div className="max-w-4xl fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{exam.title}</h1>
          <p style={{ color: "var(--text-secondary)" }}>Exam Configuration</p>
        </div>
        <button onClick={handleSaveConfig} className="btn btn-primary" disabled={saving}>
          {saving ? <><span className="spinner" />Saving…</> : <><Save size={16} />Save Config</>}
        </button>
      </div>

      {saveMsg && (
        <div className="flex items-center gap-2 p-3 rounded-xl text-sm"
          style={{ background: "rgba(52,211,153,0.1)", color: "var(--success)", border: "1px solid rgba(52,211,153,0.3)" }}>
          <CheckCircle2 size={16} />{saveMsg}
        </div>
      )}

      {/* Timer + Window */}
      <div className="glass-card p-6">
        <h2 className="font-bold mb-5 flex items-center gap-2"><Clock size={17} style={{ color: "var(--accent-primary)" }} />Timing</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="form-group">
            <label className="form-label">Duration (minutes)</label>
            <input type="number" className="form-input" min={5} max={300}
              value={exam.duration_mins ?? 60}
              onChange={(e) => setExam((p) => ({ ...p, duration_mins: Number(e.target.value) }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Opens At</label>
            <input type="datetime-local" className="form-input"
              value={exam.start_at ? exam.start_at.slice(0, 16) : ""}
              onChange={(e) => setExam((p) => ({ ...p, start_at: e.target.value ? new Date(e.target.value).toISOString() : null }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Closes At</label>
            <input type="datetime-local" className="form-input"
              value={exam.end_at ? exam.end_at.slice(0, 16) : ""}
              onChange={(e) => setExam((p) => ({ ...p, end_at: e.target.value ? new Date(e.target.value).toISOString() : null }))} />
          </div>
        </div>
      </div>

      {/* Question Settings */}
      <div className="glass-card p-6">
        <h2 className="font-bold mb-5 flex items-center gap-2"><Shuffle size={17} style={{ color: "var(--accent-primary)" }} />Question Settings</h2>
        <div className="grid grid-cols-2 gap-5">
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
        <div className="grid grid-cols-2 gap-5">
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

      {/* Student Management */}
      <div className="glass-card p-6">
        <h2 className="font-bold mb-5 flex items-center gap-2"><Users size={17} style={{ color: "var(--accent-primary)" }} />Students ({students.length})</h2>

        <div className="flex items-end gap-3 mb-5">
          <div className="form-group flex-1 mb-0">
            <label className="form-label">Upload Student List (.xlsx with Roll_No, Name columns)</label>
            <input type="file" accept=".xlsx,.csv" className="form-input"
              onChange={(e) => setStudentFile(e.target.files?.[0] ?? null)} />
          </div>
          <button onClick={handleStudentUpload} disabled={!studentFile} className="btn btn-secondary shrink-0">
            <Upload size={16} /> Import
          </button>
          {students.length > 0 && (
            <button onClick={handleDownloadCodes} className="btn btn-success shrink-0">
              <Download size={16} /> Download Codes
            </button>
          )}
        </div>

        {studentErrors.length > 0 && (
          <div className="mb-4 p-3 rounded-xl text-sm" style={{ background: "rgba(248,113,113,0.1)", color: "var(--danger)", border: "1px solid rgba(248,113,113,0.3)" }}>
            <AlertCircle size={14} className="inline mr-1" />
            {studentErrors.join(" · ")}
          </div>
        )}

        {students.length > 0 && (
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border-subtle)" }}>
            <table className="w-full text-sm">
              <thead style={{ background: "rgba(255,255,255,0.03)" }}>
                <tr>
                  {["Roll No", "Name", "Access Code"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                      style={{ color: "var(--text-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id} className="border-t" style={{ borderColor: "var(--border-subtle)" }}>
                    <td className="px-4 py-3 font-mono text-xs">{s.roll_no}</td>
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 font-mono text-sm" style={{ color: "var(--accent-secondary)" }}>{s.access_code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
