"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { Activity, Circle, CheckCircle2, AlertTriangle, Wifi } from "lucide-react";

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

export default function LiveMonitorPage({ params }: { params: { id: string } }) {
  const [students, setStudents] = useState<StudentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const supabase = createClient();

  async function fetchStatus() {
    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, is_active, submitted_at, tab_switches, fullscreen_exits, devtools_attempts, last_seen_at, students(roll_no, name)")
      .eq("exam_id", params.id);

    const { data: allStudents } = await supabase
      .from("students")
      .select("id, roll_no, name")
      .eq("exam_id", params.id);

    const sessionMap = new Map((sessions ?? []).map((s: any) => [s.students?.roll_no, s]));

    const statuses: StudentStatus[] = (allStudents ?? []).map((st: any) => {
      const sess = sessionMap.get(st.roll_no) as any;
      if (!sess) return { session_id: "", roll_no: st.roll_no, name: st.name, status: "not_started" as const, tab_switches: 0, fullscreen_exits: 0, devtools_attempts: 0, last_seen_at: null, submitted_at: null };

      const idleThreshold = 3 * 60 * 1000; // 3 min
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

  useEffect(() => {
    fetchStatus();

    // Real-time subscription
    const channel = supabase
      .channel(`monitor-${params.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions", filter: `exam_id=eq.${params.id}` }, () => {
        fetchStatus();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "violation_logs" }, () => {
        fetchStatus();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [params.id]);

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
    active: <Circle size={8} className="fill-current" style={{ color: "var(--success)" }} />,
    submitted: <CheckCircle2 size={10} style={{ color: "var(--info)" }} />,
    idle: <AlertTriangle size={10} style={{ color: "var(--warning)" }} />,
    not_started: <Circle size={8} style={{ color: "var(--text-muted)" }} />,
  }[s]);

  return (
    <div className="fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity size={22} style={{ color: "var(--accent-primary)" }} /> Live Monitor
          </h1>
          <p className="text-sm flex items-center gap-1 mt-1" style={{ color: "var(--text-muted)" }}>
            <Wifi size={12} /> Real-time · Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button onClick={fetchStatus} className="btn btn-secondary btn-sm">Refresh</button>
      </div>

      {/* Status counters */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { key: "active", label: "Active", color: "var(--success)" },
          { key: "submitted", label: "Submitted", color: "var(--info)" },
          { key: "idle", label: "Idle > 3min", color: "var(--warning)" },
          { key: "not_started", label: "Not Started", color: "var(--text-muted)" },
        ].map(({ key, label, color }) => (
          <div key={key} className="glass-card p-5 text-center">
            <p className="text-3xl font-bold" style={{ color }}>{counts[key as keyof typeof counts]}</p>
            <p className="text-xs mt-1 font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Student Grid */}
      <div className="glass-card overflow-hidden">
        <div className="p-5 border-b font-bold" style={{ borderColor: "var(--border-subtle)" }}>
          Student Status ({students.length} enrolled)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "rgba(255,255,255,0.03)" }}>
              <tr>
                {["Roll No", "Name", "Status", "Tab Switches", "Fullscreen Exits", "DevTools", "Last Seen"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="px-4 py-10 text-center"><span className="spinner mx-auto block" /></td></tr>
              )}
              {students.map((s) => {
                const highRisk = s.tab_switches > 2 || s.fullscreen_exits > 1 || s.devtools_attempts > 0;
                return (
                  <tr key={s.roll_no}
                    className="border-t transition-colors"
                    style={{
                      borderColor: "var(--border-subtle)",
                      background: highRisk ? "rgba(248,113,113,0.03)" : undefined,
                    }}>
                    <td className="px-4 py-3 font-mono text-xs">{s.roll_no}</td>
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${statusStyle(s.status)} flex items-center gap-1 w-fit`}>
                        {statusIcon(s.status)} {s.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span style={{ color: s.tab_switches > 2 ? "var(--danger)" : "var(--text-primary)", fontWeight: s.tab_switches > 0 ? 600 : 400 }}>
                        {s.tab_switches}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span style={{ color: s.fullscreen_exits > 0 ? "var(--danger)" : "var(--text-primary)" }}>
                        {s.fullscreen_exits}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span style={{ color: s.devtools_attempts > 0 ? "var(--danger)" : "var(--text-primary)" }}>
                        {s.devtools_attempts}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                      {s.last_seen_at ? new Date(s.last_seen_at).toLocaleTimeString() : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
