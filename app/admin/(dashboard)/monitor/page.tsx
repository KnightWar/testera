"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { Activity, Circle, CheckCircle2, AlertTriangle, Wifi, RefreshCw, FileText } from "lucide-react";
import Link from "next/link";

interface StudentStatus {
  session_id: string;
  roll_no: string;
  name: string;
  status: "not_started" | "active" | "submitted" | "idle";
  tab_switches: number;
  fullscreen_exits: number;
  devtools_attempts: number;
  last_seen_at: string | null;
  submitted_at: string | null;
}

export default function LiveMonitorPage() {
  const [exams, setExams] = useState<{ id: string; title: string }[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [students, setStudents] = useState<StudentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const supabase = createClient();

  // Load all exams on mount
  useEffect(() => {
    async function loadExams() {
      const { data } = await supabase
        .from("exams")
        .select("id, title")
        .order("created_at", { ascending: false });
      
      if (data) {
        setExams(data);
        if (data.length > 0) {
          setSelectedExamId(data[0].id);
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    }
    loadExams();
  }, []);

  async function fetchStatus(examId: string) {
    if (!examId) return;
    const [sessionsRes, studentsRes] = await Promise.all([
      supabase
        .from("sessions")
        .select("id, is_active, submitted_at, tab_switches, fullscreen_exits, devtools_attempts, last_seen_at, students(roll_no, name)")
        .eq("exam_id", examId),
      supabase
        .from("students")
        .select("id, roll_no, name")
        .eq("exam_id", examId)
    ]);

    const sessions = sessionsRes.data ?? [];
    const allStudents = studentsRes.data ?? [];

    const sessionMap = new Map(sessions.map((s: any) => [s.students?.roll_no, s]));

    const statuses: StudentStatus[] = allStudents.map((st: any) => {
      const sess = sessionMap.get(st.roll_no) as any;
      if (!sess) {
        return {
          session_id: "",
          roll_no: st.roll_no,
          name: st.name,
          status: "not_started" as const,
          tab_switches: 0,
          fullscreen_exits: 0,
          devtools_attempts: 0,
          last_seen_at: null,
          submitted_at: null
        };
      }

      const idleThreshold = 3 * 60 * 1000; // 3 minutes idle
      const isIdle = sess.last_seen_at && !sess.submitted_at && Date.now() - new Date(sess.last_seen_at).getTime() > idleThreshold;

      return {
        session_id: sess.id,
        roll_no: st.roll_no,
        name: st.name,
        status: sess.submitted_at ? "submitted" : isIdle ? "idle" : sess.is_active ? "active" : "not_started",
        tab_switches: sess.tab_switches ?? 0,
        fullscreen_exits: sess.fullscreen_exits ?? 0,
        devtools_attempts: sess.devtools_attempts ?? 0,
        last_seen_at: sess.last_seen_at,
        submitted_at: sess.submitted_at,
      };
    });

    setStudents(statuses);
    setLastRefresh(new Date());
    setLoading(false);
  }

  // Subscribe to changes when selectedExamId changes
  useEffect(() => {
    if (!selectedExamId) {
      setStudents([]);
      return;
    }

    setLoading(true);
    fetchStatus(selectedExamId);

    const channel = supabase
      .channel(`monitor-${selectedExamId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions", filter: `exam_id=eq.${selectedExamId}` }, () => {
        fetchStatus(selectedExamId);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "violation_logs" }, () => {
        fetchStatus(selectedExamId);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedExamId]);

  const counts = {
    active: students.filter((s) => s.status === "active").length,
    submitted: students.filter((s) => s.status === "submitted").length,
    idle: students.filter((s) => s.status === "idle").length,
    not_started: students.filter((s) => s.status === "not_started").length,
  };

  const statusStyle = (status: StudentStatus["status"]) => ({
    active: "badge-success",
    submitted: "badge-info",
    idle: "badge-warning",
    not_started: "badge-neutral",
  }[status]);

  const statusIcon = (s: StudentStatus["status"]) => ({
    active: <Circle size={8} className="fill-current animate-pulse text-emerald-400" />,
    submitted: <CheckCircle2 size={10} style={{ color: "var(--info)" }} />,
    idle: <AlertTriangle size={10} style={{ color: "var(--warning)" }} />,
    not_started: <Circle size={8} style={{ color: "var(--text-muted)" }} />,
  }[s]);

  return (
    <div className="max-w-7xl mx-auto space-y-8 fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity size={22} style={{ color: "var(--accent-primary)" }} /> Live Proctoring Monitor
          </h1>
          <p className="text-sm flex items-center gap-1 mt-1" style={{ color: "var(--text-muted)" }}>
            <Wifi size={12} className="text-emerald-400 animate-pulse" /> Real-time active proctoring feeds
          </p>
        </div>
        <div className="flex items-center gap-3">
          {exams.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Exam:</label>
              <select
                className="form-input text-xs w-64 h-9 py-1"
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
              >
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.title}
                  </option>
                ))}
              </select>
            </div>
          )}
          {selectedExamId && (
            <button onClick={() => fetchStatus(selectedExamId)} className="btn btn-secondary btn-sm h-9">
              <RefreshCw size={12} /> Refresh
            </button>
          )}
        </div>
      </div>

      {exams.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <p className="text-5xl mb-4">📺</p>
          <h2 className="text-xl font-bold mb-2">No exams to monitor</h2>
          <p className="mb-6" style={{ color: "var(--text-secondary)" }}>
            Create an exam and import students to start live proctoring monitoring.
          </p>
          <Link href="/admin/exams/new" className="btn btn-primary">
            Create Exam
          </Link>
        </div>
      ) : (
        <>
          {/* Status counters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { key: "active", label: "Active Testing", color: "var(--success)" },
              { key: "submitted", label: "Submitted", color: "var(--info)" },
              { key: "idle", label: "Idle > 3min", color: "var(--warning)" },
              { key: "not_started", label: "Not Started", color: "var(--text-muted)" },
            ].map(({ key, label, color }) => (
              <div key={key} className="glass-card p-5 text-center">
                <p className="text-3xl font-bold" style={{ color }}>{counts[key as keyof typeof counts]}</p>
                <p className="text-xs mt-1 font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Student Grid */}
          <div className="glass-card overflow-hidden">
            <div className="p-5 border-b flex items-center justify-between font-bold" style={{ borderColor: "var(--border-subtle)" }}>
              <span>Live Student Roster ({students.length} enrolled)</span>
              <span className="text-xs font-normal text-slate-500">Last updated: {lastRefresh.toLocaleTimeString()}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: "rgba(255,255,255,0.03)" }}>
                  <tr className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
                    {["Roll No", "Name", "Status", "Tab Switches", "Fullscreen Exits", "DevTools", "Last Active"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                        style={{ color: "var(--text-muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && students.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-16 text-center">
                        <span className="spinner mx-auto block mb-2" />
                        <span className="text-xs text-slate-500">Loading student roster...</span>
                      </td>
                    </tr>
                  ) : students.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-16 text-center text-slate-500">
                        <FileText size={32} className="mx-auto mb-2 text-slate-600" />
                        No students enrolled in this exam. Go to Config to upload the student roster list.
                      </td>
                    </tr>
                  ) : (
                    students.map((s) => {
                      const highRisk = s.tab_switches > 2 || s.fullscreen_exits > 1 || s.devtools_attempts > 0;
                      return (
                        <tr key={s.roll_no}
                          className="border-t transition-colors hover:bg-white/[0.01]"
                          style={{
                            borderColor: "var(--border-subtle)",
                            background: highRisk ? "rgba(248,113,113,0.04)" : undefined,
                          }}>
                          <td className="px-4 py-3 font-mono text-xs">{s.roll_no}</td>
                          <td className="px-4 py-3 font-medium">{s.name}</td>
                          <td className="px-4 py-3">
                            <span className={`badge ${statusStyle(s.status)} flex items-center gap-1.5 w-fit text-[11px]`}>
                              {statusIcon(s.status)} {s.status.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span style={{ color: s.tab_switches > 2 ? "var(--danger)" : "var(--text-primary)", fontWeight: s.tab_switches > 0 ? 600 : 400 }}>
                              {s.tab_switches}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span style={{ color: s.fullscreen_exits > 0 ? "var(--danger)" : "var(--text-primary)", fontWeight: s.fullscreen_exits > 0 ? 600 : 400 }}>
                              {s.fullscreen_exits}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span style={{ color: s.devtools_attempts > 0 ? "var(--danger)" : "var(--text-primary)", fontWeight: s.devtools_attempts > 0 ? 600 : 400 }}>
                              {s.devtools_attempts}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                            {s.last_seen_at ? new Date(s.last_seen_at).toLocaleTimeString() : "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
