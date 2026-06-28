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

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`
        relative w-9 h-5 rounded-full border transition-all duration-200 shrink-0 cursor-pointer
        ${checked
          ? 'bg-[--accent] border-[--accent]'
          : 'bg-slate-200 border-slate-300'
        }
        focus:outline-none
      `}
    >
      <span className={`
        absolute top-0.5 left-0.5
        w-3.5 h-3.5 rounded-full bg-white shadow-sm
        transition-transform duration-200
        ${checked ? 'translate-x-4' : 'translate-x-0'}
      `} />
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Save Config top row */}
      <div className="flex items-start justify-between gap-4 border-b border-[--border] pb-4">
        <div className="flex-1">
          <ExamSubNav examId={id} examTitle={exam.title} />
        </div>
        <button onClick={handleSaveConfig} className="btn btn-primary btn-sm shrink-0" disabled={saving}>
          {saving ? <><span className="spinner" />Saving…</> : <><Save size={14} />Save Config</>}
        </button>
      </div>

      {saveMsg && (
        <div className="flex items-center gap-2 p-3 rounded-md text-sm bg-[--green-bg] text-[--green] border border-emerald-500/20">
          <CheckCircle2 size={16} />{saveMsg}
        </div>
      )}

      {/* Grid: 2-column (config left, students right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Left Column: Config cards */}
        <div className="space-y-6">
          {/* Access Code Card */}
          <div className="card p-6">
            <p className="text-[11px] font-semibold text-[--text-muted] uppercase tracking-wider mb-4">
              Exam Access Code — Share With All Students
            </p>

            <div className="mb-4">
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "28px",
                  fontWeight: 700,
                  letterSpacing: "6px",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-accent)",
                  borderRadius: "var(--radius-md)",
                  padding: "16px 20px",
                  display: "inline-block",
                }}
                className="select-all"
              >
                {exam.access_code ?? "—"}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[--border] pt-4">
              <p className="text-xs text-[--text-secondary]">
                Valid only during the exam window (Opens At → Closes At)
              </p>
              <div className="flex items-center gap-3">
                <button onClick={handleCopyCode} className="btn btn-ghost btn-sm" title="Copy code">
                  {codeCopied ? <Check size={14} className="text-[--green]" /> : <Copy size={14} />}
                  {codeCopied ? "Copied" : "Copy"}
                </button>
                <button onClick={handleRegenerateCode} className="btn btn-ghost btn-sm text-[--text-secondary]">
                  <RefreshCw size={12} /> Regenerate
                </button>
              </div>
            </div>
          </div>

          {/* Timing Card */}
          <div className="card p-6 bg-white">
            <div className="flex items-center gap-2 mb-5">
              <Clock size={15} className="text-[--accent]" />
              <h3 className="text-sm font-bold text-[--text-primary]">Timing</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-[--text-muted] mb-1.5 uppercase tracking-wide">
                  Duration (Minutes)
                </label>
                <input
                  type="number"
                  className="w-full h-10 bg-[--bg-input] text-[--text-primary] placeholder:text-[--text-muted] border border-[--border] rounded-md px-3 text-sm focus:outline-none focus:border-[--border-accent]"
                  min={5}
                  max={300}
                  value={exam.duration_mins ?? 60}
                  onChange={(e) => handleDurationChange(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[--text-muted] mb-1.5 uppercase tracking-wide">
                  Opens At
                </label>
                <input
                  type="datetime-local"
                  className="w-full h-10 bg-[--bg-input] text-[--text-primary] placeholder:text-[--text-muted] border border-[--border] rounded-md px-3 text-sm focus:outline-none focus:border-[--border-accent]"
                  value={startAtLocal}
                  onChange={(e) => handleStartAtChange(e.target.value)}
                />
                <p className="text-[11px] text-[--text-muted] mt-1">Sets when access code becomes valid</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <label className="block text-[11px] font-semibold text-[--text-muted] uppercase tracking-wide">
                    Closes At
                  </label>
                  <span className="badge badge-amber">
                    AUTO
                  </span>
                </div>
                <input
                  type="datetime-local"
                  className="w-full h-10 bg-[--bg-input] text-[--text-primary] placeholder:text-[--text-muted] border border-[--border] rounded-md px-3 text-sm focus:outline-none focus:border-[--border-accent]"
                  value={endAtLocal}
                  onChange={(e) => setExam((p) => ({ ...p, end_at: e.target.value ? new Date(e.target.value).toISOString() : null }))}
                />
                <p className="text-[11px] text-[--text-muted] mt-1 font-semibold">Auto-fills from duration.</p>
              </div>
            </div>
          </div>

          {/* Question Settings Card */}
          <div className="card p-6 bg-white">
            <div className="flex items-center gap-2 mb-5">
              <Shuffle size={15} className="text-[--accent]" />
              <h3 className="text-sm font-bold text-[--text-primary]">Exam Settings</h3>
            </div>

            {/* Settings row - three equal columns with border-r dividers, no background */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-[--border]">
              <div className="flex flex-col justify-between h-full pr-4">
                <div>
                  <p className="text-sm font-bold text-[--text-primary]">Shuffle Order</p>
                  <p className="text-xs text-[--text-secondary] mt-1">Each student gets a different question order</p>
                </div>
                <div className="mt-3">
                  <Toggle checked={exam.shuffle_questions ?? true} onChange={(checked, color = "orange") => setExam((p) => ({ ...p, shuffle_questions: checked }))} />
                </div>
              </div>

              <div className="flex flex-col justify-between h-full px-0 md:px-6">
                <div>
                  <p className="text-sm font-bold text-[--text-primary]">Immediate Score</p>
                  <p className="text-xs text-[--text-secondary] mt-1">After submit, student sees their score</p>
                </div>
                <div className="mt-3">
                  <Toggle checked={exam.show_score_immediately ?? false} onChange={(checked) => setExam((p) => ({ ...p, show_score_immediately: checked }))} />
                </div>
              </div>

              <div className="flex flex-col justify-between h-full pl-0 md:pl-6">
                <div>
                  <p className="text-sm font-bold text-[--text-primary]">Negative Marking</p>
                  <p className="text-xs text-[--text-secondary] mt-1">Deduct marks for wrong choices</p>
                </div>
                <div className="mt-3 flex items-center gap-4">
                  <Toggle checked={exam.negative_marking ?? false} onChange={(checked) => setExam((p) => ({ ...p, negative_marking: checked }))} />
                  {exam.negative_marking && (
                    <input
                      type="number"
                      className="w-20 h-8 bg-[--bg-input] text-[--text-primary] placeholder:text-[--text-muted] border border-[--border] rounded-md px-2 text-xs focus:outline-none focus:border-[--border-accent]"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={exam.negative_fraction ?? 0.25}
                      onChange={(e) => setExam((p) => ({ ...p, negative_fraction: Number(e.target.value) }))}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Assigned Students Panel */}
        <div className="card overflow-hidden sticky top-6 bg-white">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[--border]">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-[--text-secondary]" />
              <h3 className="text-sm font-bold text-[--text-primary]">
                Assigned ({students.length})
              </h3>
            </div>
            <button
              onClick={async () => {
                setSaving(true);
                await loadData();
                setSaving(false);
                setSaveMsg("Synced roster successfully!");
                setTimeout(() => setSaveMsg(""), 2500);
              }}
              className="text-xs text-[--accent] bg-transparent border-0 cursor-pointer flex items-center gap-1 hover:underline"
              disabled={saving}
            >
              <RefreshCw size={12} className={saving ? "animate-spin" : ""} />
              Sync
            </button>
          </div>

          {/* Bulk group assign */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[--border] bg-slate-50/50">
            <select
              className="flex-1 h-8 bg-[--bg-input] border border-[--border] rounded-md text-xs text-[--text-primary] px-2 focus:outline-none focus:border-[--border-accent]"
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
            >
              {groups.length === 0 ? (
                <option value="">No groups found</option>
              ) : (
                groups.map(g => <option key={g} value={g}>{g}</option>)
              )}
            </select>
            <button
              onClick={handleAssignGroup}
              disabled={!selectedGroup || saving}
              className="btn btn-primary btn-sm h-8"
            >
              Assign Group
            </button>
          </div>

          {/* Student list */}
          <div className="max-h-[400px] overflow-y-auto divide-y divide-[--border]">
            {students.length === 0 ? (
              <p className="text-xs text-[--text-secondary] text-center py-8">No students assigned. Select a group and assign.</p>
            ) : (
              students.map(student => (
                <div key={student.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[--bg-hover] transition-colors group">
                  <div className="w-7 h-7 rounded-full bg-[--accent-muted] border border-[--accent-border] flex items-center justify-center shrink-0">
                    <span className="text-[11px] font-semibold text-[--accent]">
                      {student.name[0]?.toUpperCase() ?? "S"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[--text-primary] truncate">{student.name}</p>
                    <p className="text-[10px] font-mono text-[--text-secondary]">{student.roll_no}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveStudent(student.id)}
                    className="opacity-60 hover:opacity-100 transition-opacity bg-transparent border-0 cursor-pointer"
                    title="Remove student"
                  >
                    <Trash2 size={13} className="text-[--text-secondary] hover:text-[--red]" />
                  </button>
                </div>
              ))
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
