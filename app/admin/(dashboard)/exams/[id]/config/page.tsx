"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Settings, Clock, Users, Shuffle, Save, AlertCircle, CheckCircle2, Trash2,
  KeyRound, RefreshCw, Copy, Check
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import ExamSubNav from "@/components/admin/ExamSubNav";

type Exam = Database["public"]["Tables"]["exams"]["Row"] & { access_code?: string | null };
type Student = Database["public"]["Tables"]["students"]["Row"];
type MasterStudent = Database["public"]["Tables"]["master_students"]["Row"];

export default function ExamConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const [exam, setExam] = useState<Partial<Exam>>({});
  const [students, setStudents] = useState<Student[]>([]);
  const [masterStudents, setMasterStudents] = useState<MasterStudent[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);

  async function loadData() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const examRes = await (supabase.from("exams") as any).select("*").eq("id", id).single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const studentsRes = await (supabase.from("students") as any).select("*").eq("exam_id", id).order("roll_no");
    const masterRes = await supabase.from("master_students").select("*").order("name");

    let currentStudents = (studentsRes.data ?? []) as Student[];
    let examData = examRes.data as Exam;

    if (examData) {
      let code = getExamAccessCode(examData.description);
      if (!code) {
        code = generateAccessCode();
        const newDesc = setExamAccessCode(examData.description, code);
        await supabase.from("exams").update({ description: newDesc }).eq("id", id);
        examData.description = newDesc;
        
        await supabase.from("students").update({ access_code: code }).eq("exam_id", id);
      }
      examData.access_code = code;
      setExam(examData);
    }

    // Dynamic Sync Block
    const assignedGroups = Array.from(
      new Set(currentStudents.map(s => s.group_name).filter(Boolean))
    ) as string[];

    if (assignedGroups.length > 0) {
      const { data: masterGroupStudents, error: masterErr } = await supabase
        .from("master_students")
        .select("roll_no, name, group_name")
        .in("group_name", assignedGroups);

      if (!masterErr && masterGroupStudents) {
        // Find missing students to add
        const toInsert: any[] = [];
        masterGroupStudents.forEach(ms => {
          const exists = currentStudents.some(s => s.roll_no === ms.roll_no);
          if (!exists) {
            toInsert.push({
              exam_id: id,
              roll_no: ms.roll_no,
              name: ms.name,
              group_name: ms.group_name,
              access_code: examData?.access_code || generateAccessCode(),
            });
          }
        });

        // Find stale students to delete
        const staleStudents = currentStudents.filter(s => {
          if (!s.group_name) return false;
          if (!assignedGroups.includes(s.group_name)) return false;
          const existsInMaster = masterGroupStudents.some(
            ms => ms.roll_no === s.roll_no && ms.group_name === s.group_name
          );
          return !existsInMaster;
        });

        let didChange = false;

        if (toInsert.length > 0) {
          const { error: insErr } = await supabase
            .from("students")
            .upsert(toInsert, { onConflict: "exam_id,roll_no" });
          if (!insErr) didChange = true;
        }

        if (staleStudents.length > 0) {
          const staleIds = staleStudents.map(s => s.id);
          const { error: delErr } = await supabase
            .from("students")
            .delete()
            .in("id", staleIds);
          if (!delErr) didChange = true;
        }

        if (didChange) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const reloadRes = await (supabase.from("students") as any).select("*").eq("exam_id", id).order("roll_no");
          currentStudents = (reloadRes.data ?? []) as Student[];
        }
      }
    }

    setStudents(currentStudents);
    
    if (masterRes.data) {
      setMasterStudents(masterRes.data);
      const uniqueGroups = Array.from(new Set(masterRes.data.map(s => s.group_name))).filter(Boolean).sort() as string[];
      setGroups(uniqueGroups);
      if (uniqueGroups.length > 0) {
        setSelectedGroup(uniqueGroups[0]);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
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

  async function handleAssignGroup() {
    if (!selectedGroup) return;
    setSaving(true);

    const { data: groupStudents, error: fetchErr } = await supabase
      .from("master_students")
      .select("roll_no, name, group_name")
      .eq("group_name", selectedGroup);

    if (fetchErr || !groupStudents) {
      alert("Failed to fetch group students: " + fetchErr?.message);
      setSaving(false);
      return;
    }

    const toInsert = groupStudents.map((s) => ({
      exam_id: id,
      roll_no: s.roll_no,
      name: s.name,
      group_name: s.group_name,
      access_code: exam.access_code || generateAccessCode(),
    }));

    const { error: insertErr } = await supabase
      .from("students")
      .upsert(toInsert as any, { onConflict: "exam_id,roll_no" });

    if (insertErr) {
      alert("Failed to assign group: " + insertErr.message);
    } else {
      const { data } = await supabase.from("students").select("*").eq("exam_id", id).order("roll_no");
      setStudents(data ?? []);
      setSaveMsg(`Assigned group "${selectedGroup}" successfully!`);
      setTimeout(() => setSaveMsg(""), 2500);
    }
    setSaving(false);
  }

  async function handleRemoveStudent(studentId: string) {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;

    const { error } = await supabase.from("students").delete().eq("id", studentId);
    if (error) {
      alert("Failed to unassign student: " + error.message);
    } else {
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
      // Delete from master directory as well to keep sync
      await supabase.from("master_students").delete().eq("roll_no", student.roll_no);
    }
  }



  if (loading) return <div className="flex items-center gap-2 pt-12 text-slate-300"><span className="spinner" /> Loading…</div>;

  const startAtLocal = exam.start_at ? new Date(exam.start_at).toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).slice(0, 16) : "";
  const endAtLocal = exam.end_at ? new Date(exam.end_at).toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).slice(0, 16) : "";

  const unassignedStudents = masterStudents.filter(
    (ms) => !students.some((s) => s.roll_no === ms.roll_no)
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 fade-in text-[var(--color-text-primary)]">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex-1">
          <ExamSubNav examId={id} examTitle={exam.title} />
        </div>
        <button onClick={handleSaveConfig} className="btn btn--primary h-fit" disabled={saving}>
          {saving ? <><span className="spinner" />Saving…</> : <><Save size={16} />Save Config</>}
        </button>
      </div>

      {saveMsg && (
        <div className="flex items-center gap-2 p-3 rounded-xl text-sm"
          style={{ background: "var(--color-success-subtle)", color: "var(--color-success)", border: "1px solid rgba(52,211,153,0.3)" }}>
          <CheckCircle2 size={16} />{saveMsg}
        </div>
      )}

      {/* Exam Access Code Banner */}
      <div className="card card--elevated p-6 border-l-4" style={{ borderLeftColor: "var(--color-accent-secondary)" }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--color-accent-subtle)" }}>
              <KeyRound size={20} style={{ color: "var(--color-accent)" }} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: "var(--color-text-muted)" }}>
                Exam Access Code — Share with all students
              </p>
              <div className="flex items-center gap-3">
                <span className="font-mono text-2xl font-bold tracking-[0.25em]" style={{ color: "var(--color-accent-secondary)" }}>
                  {exam.access_code ?? "—"}
                </span>
                <button onClick={handleCopyCode} className="btn btn--secondary btn--sm py-1 px-2" title="Copy code">
                  {codeCopied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                </button>
              </div>
              <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                Valid only during the exam window (Opens At → Closes At). All students in this exam use this single code.
              </p>
            </div>
          </div>
          <button onClick={handleRegenerateCode} className="btn btn--secondary btn--sm shrink-0 flex items-center gap-2">
            <RefreshCw size={14} /> Regenerate Code
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Timer + Window */}
          <div className="card card--elevated p-6">
            <h2 className="font-bold mb-5 flex items-center gap-2"><Clock size={17} style={{ color: "var(--color-accent)" }} />Timing</h2>
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
                <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Sets when access code becomes valid</p>
              </div>
              <div className="form-group">
                <label className="form-label">Closes At <span className="text-xs font-normal text-purple-400">(auto-calculated)</span></label>
                <input type="datetime-local" className="form-input"
                  value={endAtLocal}
                  onChange={(e) => setExam((p) => ({ ...p, end_at: e.target.value ? new Date(e.target.value).toISOString() : null }))} />
                <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Auto-fills from Opens At + Duration. Override manually if needed.</p>
              </div>
            </div>
          </div>

          {/* Question Settings */}
          <div className="card card--elevated p-6">
            <h2 className="font-bold mb-5 flex items-center gap-2"><Shuffle size={17} style={{ color: "var(--color-accent)" }} />Question Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <label className="flex items-center justify-between p-4 rounded-xl cursor-pointer"
                style={{ background: "var(--color-bg-input)", border: "1px solid var(--color-border-subtle)" }}>
                <div>
                  <p className="font-medium text-sm">Shuffle Question Order</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>Each student gets a different order</p>
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
                <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>e.g. 30 from a bank of 60</p>
              </div>
            </div>
          </div>

          {/* Grading Settings */}
          <div className="card card--elevated p-6">
            <h2 className="font-bold mb-5 flex items-center gap-2"><Settings size={17} style={{ color: "var(--color-accent)" }} />Grading & Results</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <label className="flex items-center justify-between p-4 rounded-xl cursor-pointer"
                style={{ background: "var(--color-bg-input)", border: "1px solid var(--color-border-subtle)" }}>
                <div>
                  <p className="font-medium text-sm">Show Score Immediately</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>After submit, student sees their score</p>
                </div>
                <input type="checkbox" className="w-5 h-5 accent-purple-500"
                  checked={exam.show_score_immediately ?? false}
                  onChange={(e) => setExam((p) => ({ ...p, show_score_immediately: e.target.checked }))} />
              </label>

              <label className="flex items-center justify-between p-4 rounded-xl cursor-pointer"
                style={{ background: "var(--color-bg-input)", border: "1px solid var(--color-border-subtle)" }}>
                <div>
                  <p className="font-medium text-sm">Negative Marking</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>Deduct fraction of marks for wrong MCQ</p>
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
          <div className="card card--elevated p-6 space-y-6">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--color-border-subtle)" }}>
              <h2 className="font-bold flex items-center gap-2">
                <Users size={17} style={{ color: "var(--color-accent)" }} />
                Assigned Students ({students.length})
              </h2>
              <button
                onClick={async () => {
                  setSaving(true);
                  await loadData();
                  setSaving(false);
                  setSaveMsg("Synced roster successfully!");
                  setTimeout(() => setSaveMsg(""), 2500);
                }}
                className="btn btn--secondary btn--sm p-1.5 flex items-center gap-1.5 text-[11px]"
                title="Sync students from master roster as per assigned groups"
                disabled={saving}
              >
                <RefreshCw size={12} className={saving ? "animate-spin" : ""} />
                Sync
              </button>
            </div>

            {/* 1. Bulk Group Assignment */}
            <div className="space-y-2 p-4 rounded-xl" style={{ background: "var(--color-accent-subtle)", border: "1px solid var(--color-accent-glow)" }}>
              <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-accent-light)" }}>Bulk Group Assign</h3>
              <div className="flex gap-2">
                <select
                  className="form-input text-xs flex-1"
                  style={{ background: "var(--color-bg-input)" }}
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                >
                  {groups.length === 0 ? (
                    <option value="">No groups found in directory</option>
                  ) : (
                    groups.map((g) => <option key={g} value={g}>{g}</option>)
                  )}
                </select>
                <button
                  onClick={handleAssignGroup}
                  disabled={!selectedGroup || saving}
                  className="btn btn--primary btn--sm whitespace-nowrap text-xs py-1.5 px-3"
                >
                  Assign Group
                </button>
              </div>
            </div>

            {/* List of Assigned Students */}
            {students.length > 0 && (
              <div className="overflow-hidden rounded-xl border max-h-[350px] overflow-y-auto" style={{ borderColor: "var(--color-border-subtle)", background: "var(--color-bg-elevated)" }}>
                <table className="student-table">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      {["Roll No", "Name", "Group", "Action"].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <div className="font-mono text-[13px]">{s.roll_no}</div>
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="student-table__avatar">{s.name.charAt(0)}</div>
                            <div className="student-table__name">{s.name}</div>
                          </div>
                        </td>
                        <td>
                          <span className="chip chip--neutral">{s.group_name || "General"}</span>
                        </td>
                        <td>
                          <button
                            onClick={() => handleRemoveStudent(s.id)}
                            className="text-red-400 hover:text-red-300 p-1 bg-transparent border-none cursor-pointer"
                            title="Remove student from this exam"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
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

// ─────────────────────────────────────────────────────────────────────────────
// EXAMS DESCRIPTION-BASED ACCESS CODE UTILS (Fallbacks preserved)
// ─────────────────────────────────────────────────────────────────────────────
function generateAccessCode(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function getExamAccessCode(description: string | null | undefined): string | null {
  if (!description) return null;
  const match = description.match(/^\[ACCESS_CODE:([A-Z0-9]+)\]/);
  return match ? match[1] : null;
}

function setExamAccessCode(description: string | null | undefined, code: string): string {
  const cleanDesc = description ? description.replace(/^\[ACCESS_CODE:[A-Z0-9]+\]\s*/, "") : "";
  return `[ACCESS_CODE:${code}]${cleanDesc ? " " + cleanDesc : ""}`;
}
