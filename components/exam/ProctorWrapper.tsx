"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { ShieldAlert, Maximize2, XOctagon } from "lucide-react";
import type { ViolationType } from "@/lib/database.types";
import WebcamProctor from "./WebcamProctor";

interface Props {
  sessionId: string;
  examId: string;
  children: React.ReactNode;
  onForceSubmit?: () => void; // Called when violations exceed limit
}

const MAX_FULLSCREEN_EXITS = 3;

// DevTools detection via console timing trick
function isDevToolsOpen(): boolean {
  const threshold = 160;
  return (
    window.outerWidth - window.innerWidth > threshold ||
    window.outerHeight - window.innerHeight > threshold
  );
}

export default function ProctorWrapper({ sessionId, examId, children, onForceSubmit }: Props) {
  const supabase = createClient();
  const [fullscreenGranted, setFullscreenGranted] = useState(false);
  const [showViolation, setShowViolation] = useState(false);
  const [violationReason, setViolationReason] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [resumeCountdown, setResumeCountdown] = useState(0);
  const [fullscreenExitCount, setFullscreenExitCount] = useState(0);
  const [forceSubmitted, setForceSubmitted] = useState(false);
  const logQueue = useRef<Array<{ type: ViolationType; metadata?: object }>>([]);
  const flushTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const lastTabSwitchTime = useRef<number>(0);
  const exitCountRef = useRef(0); // keeps sync value for use in callbacks

  // ── Mobile/tablet UA check ────────────────────────────────────────────────
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (/mobile|android|ipad|tablet|iphone/.test(ua)) {
      setIsMobile(true);
    }
  }, []);

  // ── Log violation (batched for performance) ───────────────────────────────
  const logViolation = useCallback((type: ViolationType, metadata?: object) => {
    logQueue.current.push({ type, metadata });
  }, []);

  // Flush queue to Supabase every 5 seconds
  useEffect(() => {
    if (!sessionId) return;
    flushTimer.current = setInterval(async () => {
      const batch = logQueue.current.splice(0);
      if (batch.length === 0) return;
      await supabase.from("violation_logs").insert(
        batch.map((v) => ({
          session_id: sessionId,
          type: v.type,
          metadata: v.metadata ?? null,
        }))
      );
    }, 5000);
    return () => clearInterval(flushTimer.current);
  }, [sessionId, supabase]);

  // ── Fullscreen enforcement ────────────────────────────────────────────────
  async function requestFullscreen() {
    try {
      await document.documentElement.requestFullscreen();
      setFullscreenGranted(true);
      setShowViolation(false);
    } catch {
      setViolationReason("Fullscreen permission denied. Please allow fullscreen to start the exam.");
    }
  }

  useEffect(() => {
    function handleFullscreenChange() {
      if (!document.fullscreenElement && fullscreenGranted) {
        const newCount = exitCountRef.current + 1;
        exitCountRef.current = newCount;
        setFullscreenExitCount(newCount);

        logViolation("fullscreen_exit", { count: newCount, timestamp: new Date().toISOString() });

        // Update session violation counter
        if (sessionId) {
          supabase
            .from("sessions")
            .select("fullscreen_exits")
            .eq("id", sessionId)
            .single()
            .then(({ data }: { data: any }) => {
              if (data) {
                supabase
                  .from("sessions")
                  .update({ fullscreen_exits: (data.fullscreen_exits ?? 0) + 1 })
                  .eq("id", sessionId);
              }
            });
        }

        if (newCount >= MAX_FULLSCREEN_EXITS) {
          // Auto-submit — illicit behaviour threshold reached
          setForceSubmitted(true);
          setShowViolation(false);
          logViolation("fullscreen_exit", { reason: "auto_submitted_violations", count: newCount });
          // Flush logs immediately before submission
          const batch = logQueue.current.splice(0);
          if (batch.length > 0 && sessionId) {
            supabase.from("violation_logs").insert(
              batch.map((v) => ({
                session_id: sessionId,
                type: v.type,
                metadata: v.metadata ?? null,
              }))
            );
          }
          if (onForceSubmit) onForceSubmit();
          return;
        }

        setShowViolation(true);
        setViolationReason(
          `You exited fullscreen. Warning ${newCount} of ${MAX_FULLSCREEN_EXITS}. The exam is paused.`
        );

        // Start 10-second countdown
        let count = 10;
        setResumeCountdown(count);
        const cd = setInterval(() => {
          count--;
          setResumeCountdown(count);
          if (count <= 0) clearInterval(cd);
        }, 1000);
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [fullscreenGranted, sessionId, logViolation, supabase, onForceSubmit]);

  // ── Tab / window blur / focus lost ─────────────────────────────────────────
  useEffect(() => {
    if (!fullscreenGranted || !sessionId) return;

    function recordTabSwitch(detail: string) {
      const now = Date.now();
      if (now - lastTabSwitchTime.current < 2000) return;
      lastTabSwitchTime.current = now;

      logViolation("tab_switch", { detail, timestamp: new Date().toISOString() });
      setShowViolation(true);
      setViolationReason(`Exam Paused: Focus lost or tab minimized (${detail}).`);

      supabase
        .from("sessions")
        .select("tab_switches")
        .eq("id", sessionId)
        .single()
        .then(({ data }) => {
          if (data) {
            supabase
              .from("sessions")
              .update({ tab_switches: (data.tab_switches ?? 0) + 1 })
              .eq("id", sessionId);
          }
        });
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        recordTabSwitch("tab_hidden");
      }
    }

    function handleBlur() {
      recordTabSwitch("window_blur");
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [fullscreenGranted, sessionId, logViolation, supabase]);

  // ── Right-click disable ───────────────────────────────────────────────────
  useEffect(() => {
    function noContextMenu(e: MouseEvent) {
      e.preventDefault();
      logViolation("right_click");
    }
    document.addEventListener("contextmenu", noContextMenu);
    return () => document.removeEventListener("contextmenu", noContextMenu);
  }, [logViolation]);

  // ── Copy/paste disable ────────────────────────────────────────────────────
  useEffect(() => {
    function noCopy(e: ClipboardEvent) {
      e.preventDefault();
      logViolation("copy_paste", { action: "copy" });
    }
    function noPaste(e: ClipboardEvent) {
      e.preventDefault();
      logViolation("copy_paste", { action: "paste" });
    }
    document.addEventListener("copy", noCopy);
    document.addEventListener("paste", noPaste);
    return () => {
      document.removeEventListener("copy", noCopy);
      document.removeEventListener("paste", noPaste);
    };
  }, [logViolation]);

  // ── Keyboard shortcut blocking (capture phase to intercept OS actions) ────
  useEffect(() => {
    function blockKeys(e: KeyboardEvent) {
      const blocked = [
        e.key === "F12",
        e.ctrlKey && e.shiftKey && ["i", "I", "j", "J", "c", "C"].includes(e.key),
        e.ctrlKey && ["u", "U"].includes(e.key),
        e.metaKey && ["u", "U", "i", "I"].includes(e.key),
        e.key === "PrintScreen",
        e.key === "Alt",
        e.key === "Meta",
        e.altKey && e.key === "F4",
        e.altKey && e.key === "Tab",
        e.metaKey && e.key === "Tab",
        e.ctrlKey && e.key === "Escape",
      ];

      if (blocked.some(Boolean)) {
        e.preventDefault();
        e.stopPropagation();
        logViolation("keyboard_shortcut", { key: e.key, ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey });

        if (["Alt", "Meta", "F4", "Tab", "Escape"].includes(e.key)) {
          setShowViolation(true);
          setViolationReason(`Exam Paused: Unauthorised shortcut attempt (${e.key}).`);
        }
      }
    }
    document.addEventListener("keydown", blockKeys, true);
    return () => document.removeEventListener("keydown", blockKeys, true);
  }, [logViolation]);

  // ── DevTools heuristic check ──────────────────────────────────────────────
  useEffect(() => {
    if (!fullscreenGranted || !sessionId) return;
    const checkInterval = setInterval(() => {
      if (isDevToolsOpen()) {
        logViolation("devtools_open", { timestamp: new Date().toISOString() });
        supabase
          .from("sessions")
          .select("devtools_attempts")
          .eq("id", sessionId)
          .single()
          .then(({ data }) => {
            if (data) {
              supabase
                .from("sessions")
                .update({ devtools_attempts: (data.devtools_attempts ?? 0) + 1 })
                .eq("id", sessionId);
            }
          });
      }
    }, 3000);
    return () => clearInterval(checkInterval);
  }, [fullscreenGranted, sessionId, logViolation, supabase]);

  // ── Auto-submitted due to violations ─────────────────────────────────────
  if (forceSubmitted) {
    return (
      <div className="student-theme proctor-overlay bg-[#080D0A] text-white">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
          style={{ background: "rgba(239,68,68,0.15)" }}>
          <XOctagon size={48} style={{ color: "var(--danger)" }} />
        </div>
        <h2 className="text-3xl font-bold mb-3" style={{ color: "var(--danger)" }}>
          Exam Auto-Submitted
        </h2>
        <p className="text-lg mb-4 text-center max-w-md" style={{ color: "var(--text-secondary)" }}>
          Your exam has been automatically submitted due to repeated violations.
        </p>
        <div className="p-4 rounded-xl border max-w-md text-center text-sm"
          style={{ background: "rgba(239,68,68,0.06)", borderColor: "rgba(239,68,68,0.3)", color: "var(--danger)" }}>
          <strong>Reason:</strong> Fullscreen exited {MAX_FULLSCREEN_EXITS} or more times —
          possible use of illicit methods detected. This incident has been reported to the examiner.
        </div>
        <p className="mt-6 text-xs" style={{ color: "var(--text-muted)" }}>
          Please contact your supervisor immediately.
        </p>
      </div>
    );
  }

  // ── Mobile block screen ───────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="student-theme min-h-screen bg-[#080D0A] text-white flex items-center justify-center px-6">
        <div className="glass-card p-10 max-w-md text-center">
          <ShieldAlert size={56} className="mx-auto mb-4" style={{ color: "var(--warning)" }} />
          <h1 className="text-2xl font-bold mb-3">Use a Laptop or Desktop</h1>
          <p style={{ color: "var(--text-secondary)" }}>
            Testera exams are not supported on mobile or tablet devices.
            Please open this exam on a laptop or desktop computer.
          </p>
        </div>
      </div>
    );
  }

  // ── Fullscreen gate ───────────────────────────────────────────────────────
  if (!fullscreenGranted) {
    return (
      <div className="student-theme min-h-screen bg-[#080D0A] text-white flex items-center justify-center px-6">
        <div className="glass-card p-10 max-w-md text-center fade-in">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: "rgba(5,150,105,0.15)" }}>
            <Maximize2 size={30} style={{ color: "var(--accent-primary)" }} />
          </div>
          <h2 className="text-2xl font-bold mb-3">Fullscreen Required</h2>
          <p className="mb-6" style={{ color: "var(--text-secondary)" }}>
            This exam must be taken in fullscreen mode. Your browser will enter fullscreen when you click Start.
            Exiting fullscreen will pause your exam and log a violation.
          </p>
          <p className="mb-3 text-sm font-medium" style={{ color: "var(--warning)" }}>
            ⚠ Exiting fullscreen more than {MAX_FULLSCREEN_EXITS} times will automatically submit your exam.
          </p>
          {violationReason && (
            <p className="mb-4 text-sm" style={{ color: "var(--danger)" }}>{violationReason}</p>
          )}
          <button onClick={requestFullscreen} className="btn btn-primary btn-lg w-full"
            style={{ background: "linear-gradient(135deg, #059669, #34D399)", color: "white", boxShadow: "0 4px 20px rgba(52,211,153,0.3)" }}>
            <Maximize2 size={18} /> Enter Fullscreen & Start
          </button>
        </div>
      </div>
    );
  }

  // ── Violation overlay ─────────────────────────────────────────────────────
  if (showViolation) {
    const warningsLeft = MAX_FULLSCREEN_EXITS - fullscreenExitCount;
    return (
      <div className="student-theme proctor-overlay bg-[#080D0A] text-white">
        <ShieldAlert size={64} className="mb-5" style={{ color: "var(--danger)" }} />
        <h2 className="text-3xl font-bold mb-3">Exam Paused</h2>
        <p className="text-lg mb-4 text-center max-w-md" style={{ color: "var(--text-secondary)" }}>
          {violationReason}
        </p>

        {/* Warning counter strip */}
        {fullscreenExitCount > 0 && (
          <div className="mb-6 px-5 py-3 rounded-xl border text-sm font-semibold text-center"
            style={{
              background: warningsLeft === 0 ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.1)",
              borderColor: warningsLeft === 0 ? "rgba(239,68,68,0.4)" : "rgba(245,158,11,0.3)",
              color: warningsLeft === 0 ? "var(--danger)" : "var(--warning)",
            }}>
            {warningsLeft > 0
              ? `⚠ ${warningsLeft} warning${warningsLeft > 1 ? "s" : ""} remaining before auto-submission`
              : "🚨 Final warning — next exit will auto-submit your exam"}
          </div>
        )}

        <p className="mb-6 text-sm" style={{ color: "var(--text-muted)" }}>
          This incident has been logged and reported to the admin.
        </p>
        <button onClick={requestFullscreen} className="btn btn-primary btn-lg"
          style={{ background: "linear-gradient(135deg, #059669, #34D399)", color: "white", boxShadow: "0 4px 20px rgba(52,211,153,0.3)" }}>
          <Maximize2 size={18} /> Return to Fullscreen
        </button>
        {resumeCountdown > 0 && (
          <p className="mt-4 text-sm font-medium" style={{ color: "var(--text-muted)" }}>
            Exam will remain paused until you return to fullscreen.
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <WebcamProctor sessionId={sessionId} enabled={process.env.NEXT_PUBLIC_WEBCAM_PROCTORING === "true"} />
      {children}
    </>
  );
}
