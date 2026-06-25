"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { ShieldAlert, Maximize2 } from "lucide-react";
import type { ViolationType } from "@/lib/database.types";

interface Props {
  sessionId: string;
  examId: string;
  children: React.ReactNode;
}

// DevTools detection via console timing trick
function isDevToolsOpen(): boolean {
  let isOpen = false;
  const threshold = 160;
  if (
    window.outerWidth - window.innerWidth > threshold ||
    window.outerHeight - window.innerHeight > threshold
  ) {
    isOpen = true;
  }
  return isOpen;
}

export default function ProctorWrapper({ sessionId, examId, children }: Props) {
  const supabase = createClient();
  const [fullscreenGranted, setFullscreenGranted] = useState(false);
  const [showViolation, setShowViolation] = useState(false);
  const [violationReason, setViolationReason] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [resumeCountdown, setResumeCountdown] = useState(0);
  const logQueue = useRef<Array<{ type: ViolationType; metadata?: object }>>([]);
  const flushTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

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
  }, [sessionId]);

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
        setShowViolation(true);
        setViolationReason("You exited fullscreen. The exam is paused.");
        logViolation("fullscreen_exit", { timestamp: new Date().toISOString() });

        // Update session violation counter
        if (sessionId) {
          supabase.from("sessions").select("fullscreen_exits").eq("id", sessionId).single().then(({ data }: { data: any }) => {
            if (data) {
              supabase.from("sessions").update({ fullscreen_exits: (data.fullscreen_exits ?? 0) + 1 }).eq("id", sessionId);
            }
          });
        }

        // Start 10-second countdown to allow resume
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
  }, [fullscreenGranted, sessionId]);

  // ── Tab / window blur ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!fullscreenGranted || !sessionId) return;

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        logViolation("tab_switch", { timestamp: new Date().toISOString() });
        supabase.from("sessions").select("tab_switches").eq("id", sessionId).single().then(({ data }) => {
          if (data) {
            supabase.from("sessions").update({ tab_switches: (data.tab_switches ?? 0) + 1 }).eq("id", sessionId);
          }
        });
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [fullscreenGranted, sessionId]);

  // ── Right-click disable ───────────────────────────────────────────────────
  useEffect(() => {
    function noContextMenu(e: MouseEvent) {
      e.preventDefault();
      logViolation("right_click");
    }
    document.addEventListener("contextmenu", noContextMenu);
    return () => document.removeEventListener("contextmenu", noContextMenu);
  }, []);

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
    return () => { document.removeEventListener("copy", noCopy); document.removeEventListener("paste", noPaste); };
  }, []);

  // ── Keyboard shortcut blocking ────────────────────────────────────────────
  useEffect(() => {
    function blockKeys(e: KeyboardEvent) {
      const blocked = [
        e.key === "F12",
        e.ctrlKey && e.shiftKey && ["i", "I", "j", "J", "c", "C"].includes(e.key),
        e.ctrlKey && ["u", "U"].includes(e.key),
        e.metaKey && ["u", "U", "i", "I"].includes(e.key),
        e.key === "PrintScreen",
      ];
      if (blocked.some(Boolean)) {
        e.preventDefault();
        logViolation("keyboard_shortcut", { key: e.key, ctrl: e.ctrlKey, shift: e.shiftKey });
      }
    }
    document.addEventListener("keydown", blockKeys);
    return () => document.removeEventListener("keydown", blockKeys);
  }, []);

  // ── DevTools heuristic check ──────────────────────────────────────────────
  useEffect(() => {
    if (!fullscreenGranted || !sessionId) return;
    const checkInterval = setInterval(() => {
      if (isDevToolsOpen()) {
        logViolation("devtools_open", { timestamp: new Date().toISOString() });
        supabase.from("sessions").select("devtools_attempts").eq("id", sessionId).single().then(({ data }) => {
          if (data) {
            supabase.from("sessions").update({ devtools_attempts: (data.devtools_attempts ?? 0) + 1 }).eq("id", sessionId);
          }
        });
      }
    }, 3000);
    return () => clearInterval(checkInterval);
  }, [fullscreenGranted, sessionId]);

  // ── Mobile block screen ───────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
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
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="glass-card p-10 max-w-md text-center fade-in">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: "rgba(108,99,255,0.15)" }}>
            <Maximize2 size={30} style={{ color: "var(--accent-primary)" }} />
          </div>
          <h2 className="text-2xl font-bold mb-3">Fullscreen Required</h2>
          <p className="mb-6" style={{ color: "var(--text-secondary)" }}>
            This exam must be taken in fullscreen mode. Your browser will enter fullscreen when you click Start.
            Exiting fullscreen will pause your exam and log a violation.
          </p>
          {violationReason && (
            <p className="mb-4 text-sm" style={{ color: "var(--danger)" }}>{violationReason}</p>
          )}
          <button onClick={requestFullscreen} className="btn btn-primary btn-lg w-full">
            <Maximize2 size={18} /> Enter Fullscreen & Start
          </button>
        </div>
      </div>
    );
  }

  // ── Violation overlay ─────────────────────────────────────────────────────
  if (showViolation) {
    return (
      <div className="proctor-overlay">
        <ShieldAlert size={64} className="mb-5" style={{ color: "var(--danger)" }} />
        <h2 className="text-3xl font-bold mb-3">Exam Paused</h2>
        <p className="text-lg mb-6 text-center max-w-md" style={{ color: "var(--text-secondary)" }}>
          {violationReason}
        </p>
        <p className="mb-6" style={{ color: "var(--text-muted)" }}>
          This incident has been logged and reported to the admin.
        </p>
        <button onClick={requestFullscreen} className="btn btn-primary btn-lg">
          <Maximize2 size={18} /> Return to Fullscreen
        </button>
        {resumeCountdown > 0 && (
          <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>
            Exam will remain paused until you resume.
          </p>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
