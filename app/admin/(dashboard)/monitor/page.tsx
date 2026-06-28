"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { Activity, Circle, CheckCircle2, AlertTriangle, RefreshCw, FileText } from "lucide-react";
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

function getInitialsColor(name: string) {
  const charCode = name.charCodeAt(0) || 0;
  const index = charCode % 4;
  if (index === 0) return { bg: "bg-indigo-50 border-indigo-100", text: "text-indigo-600" };
  if (index === 1) return { bg: "bg-teal-50 border-teal-100", text: "text-teal-600" };
  if (index === 2) return { bg: "bg-rose-50 border-rose-100", text: "text-rose-600" };
  return { bg: "bg-amber-50 border-amber-100", text: "text-amber-600" };
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

  const getCardBorder = (status: StudentStatus["status"], highRisk: boolean) => {
    if (highRisk) return "border-t-[3px] border-t-[--red]";
    switch (status) {
      case "active":
        return "border-t-[3px] border-t-[--green]";
      case "submitted":
        return "border-t-[3px] border-t-slate-300";
      case "idle":
        return "border-t-[3px] border-t-[--accent]";
      default:
        return "border-t border-t-[--border]";
    }
  };

  const getStatusColor = (status: StudentStatus["status"]) => {
    switch (status) {
      case "active":
        return "text-[--green]";
      case "submitted":
        return "text-slate-400";
      case "idle":
        return "text-[--amber]";
      default:
        return "text-slate-400";
    }
  };

  const getStatusIcon = (status: StudentStatus["status"]) => {
    switch (status) {
      case "active":
        return <Circle size={8} className="fill-current animate-pulse text-[--green]" />;
      case "submitted":
        return <CheckCircle2 size={10} className="text-slate-400" />;
      case "idle":
        return <AlertTriangle size={10} className="text-[--amber]" />;
      default:
        return <Circle size={8} className="text-slate-300" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[--border] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-[--text-primary] tracking-tight flex items-center gap-2">
            <Activity className="text-[--red] animate-pulse" size={20} />
            Live Proctoring Monitor
          </h1>
          <p className="text-sm text-[--text-secondary] mt-1 font-sans">Real-time active proctoring feeds</p>
        </div>
        <div className="flex items-center gap-3">
          {exams.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[--text-secondary]">Exam:</label>
              <select
                className="h-9 px-3 bg-white border border-[--border] rounded-md text-xs text-[--text-primary] focus:outline-none focus:border-[--border-accent]"
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
            <button
              onClick={() => fetchStatus(selectedExamId)}
              className="btn btn-ghost btn-sm"
              title="Refresh live status feed"
            >
              <RefreshCw size={14} />
            </button>
          )}
        </div>
      </div>

      {exams.length === 0 ? (
        <div className="card p-16 text-center">
          <p className="text-5xl mb-4">📺</p>
          <h2 className="text-lg font-bold mb-2">No exams to monitor</h2>
          <p className="mb-6 text-[--text-secondary]">
            Create an exam and import students to start live proctoring monitoring.
          </p>
          <Link href="/admin/exams" className="btn btn-primary btn-sm">
            Go to Exams
          </Link>
        </div>
      ) : (
        <>
          {/* Status counters */}
          <div className="grid grid-cols-4 gap-[14px]">
            {[
              { key: "active", label: "Active Testing", color: "text-[--green]" },
              { key: "submitted", label: "Submitted", color: "text-[--accent]" },
              { key: "idle", label: "Idle > 3 Min", color: "text-[--amber]" },
              { key: "not_started", label: "Not Started", color: "text-[--secondary]" },
            ].map(({ key, label, color }) => (
              <div key={key} className="card p-4 text-center">
                <p className={`text-3xl font-display font-bold ${color}`}>{counts[key as keyof typeof counts]}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Student Grid Panel */}
          <div className="card p-6">
            <div className="flex items-center justify-between pb-4 border-b border-[--border] mb-6">
              <span className="text-sm font-bold text-[--text-primary]">Live Student Feeds ({students.length} enrolled)</span>
              <span className="text-xs text-[--text-secondary]">Last updated: {lastRefresh.toLocaleTimeString()}</span>
            </div>

            {loading && students.length === 0 ? (
              <div className="py-16 text-center">
                <span className="spinner mx-auto block mb-2" />
                <span className="text-xs text-[--text-secondary]">Loading student status...</span>
              </div>
            ) : students.length === 0 ? (
              <div className="py-16 text-center text-[--text-secondary]">
                <FileText size={32} className="mx-auto mb-2 text-[--text-muted]" />
                No students enrolled in this exam. Go to Configuration to assign students.
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
                {students.map((s) => {
                  const highRisk = s.tab_switches > 2 || s.fullscreen_exits > 1 || s.devtools_attempts > 0;
                  const colorPair = getInitialsColor(s.name);
                  return (
                    <div
                      key={s.roll_no}
                      className={`card p-5 text-center transition-all duration-150 bg-white ${getCardBorder(s.status, highRisk)}`}
                    >
                      <div className={`w-10 h-10 rounded-full border flex items-center justify-center text-xs font-bold mx-auto mb-3 shrink-0 ${colorPair.bg}`}>
                        <span className={colorPair.text}>{s.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="text-[13px] font-bold text-[--text-primary] truncate" title={s.name}>
                        {s.name}
                      </div>
                      <div className="font-mono text-[10.5px] text-[--text-secondary] mt-0.5">
                        {s.roll_no}
                      </div>
                      <div className={`text-[10px] uppercase tracking-wider font-bold flex items-center justify-center gap-1.5 mt-2.5 ${getStatusColor(s.status)}`}>
                        {getStatusIcon(s.status)}
                        <span>{s.status.replace("_", " ")}</span>
                      </div>
                      {(s.tab_switches > 0 || s.fullscreen_exits > 0 || s.devtools_attempts > 0) && (
                        <div className={`flex justify-center gap-2 mt-3.5 text-[10px] font-mono font-bold ${highRisk ? 'text-[--red]' : 'text-[--amber]'}`}>
                          {s.tab_switches > 0 && <span title="Tab Switches">T:{s.tab_switches}</span>}
                          {s.fullscreen_exits > 0 && <span title="Fullscreen Exits">F:{s.fullscreen_exits}</span>}
                          {s.devtools_attempts > 0 && <span title="DevTools">D:{s.devtools_attempts}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
