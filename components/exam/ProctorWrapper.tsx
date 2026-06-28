"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { ShieldAlert, Maximize2, XOctagon, CameraOff } from "lucide-react";
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
  const [cameraStatus, setCameraStatus] = useState<"idle" | "active" | "denied" | "off">("idle");
  const [cameraRetry, setCameraRetry] = useState(0);
  const [activeTab, setActiveTab] = useState<"mac" | "win">("mac");
  const [activeBrowser, setActiveBrowser] = useState<"chrome" | "safari" | "firefox">("chrome");
  const [isNotChrome, setIsNotChrome] = useState(false);
  const [bypassChromeCheck, setBypassChromeCheck] = useState(false);
  const [pauseCount, setPauseCount] = useState(0);
  const logQueue = useRef<Array<{ type: ViolationType; metadata?: object }>>([]);
  const flushTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const lastTabSwitchTime = useRef<number>(0);
  const exitCountRef = useRef(0); // keeps sync value for use in callbacks

  // Tracking references for local accumulators (reduces DB write overload under load)
  const tabSwitchesCountRef = useRef(0);
  const devtoolsAttemptsCountRef = useRef(0);

  // Tracking last flushed values to database
  const lastSyncedExitCountRef = useRef(0);
  const lastSyncedTabSwitchesRef = useRef(0);
  const lastSyncedDevtoolsRef = useRef(0);

  // ── Browser & Device checks ───────────────────────────────────────────────
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (/mobile|android|ipad|tablet|iphone/.test(ua)) {
      setIsMobile(true);
    }
    
    // Check if Google Chrome (or Chromium derivatives) is used
    const isChrome = (ua.includes("chrome") || ua.includes("crios")) && !ua.includes("edg") && !ua.includes("opr");
    if (!isChrome) {
      setIsNotChrome(true);
    }
  }, []);

  // ── Log violation (batched for performance) ───────────────────────────────
  const logViolation = useCallback((type: ViolationType, metadata?: object) => {
    logQueue.current.push({ type, metadata });
  }, []);

  const handlePause = useCallback((getReason: (currentCount: number) => string, violationType: ViolationType, metadata?: any) => {
    logViolation(violationType, metadata);

    setPauseCount((prev) => {
      const nextCount = prev + 1;
      if (nextCount > 3) {
        setForceSubmitted(true);
        setShowViolation(false);

        if (sessionId) {
          // Flush violation logs immediately before submit
          const batch = logQueue.current.splice(0);
          if (batch.length > 0) {
            supabase.from("violation_logs").insert(
              batch.map((v) => ({
                session_id: sessionId,
                type: v.type,
                metadata: v.metadata ?? null,
              }))
            );
          }

          // Flush current stats immediately
          const updates: any = {};
          let needsUpdate = false;
          if (exitCountRef.current !== lastSyncedExitCountRef.current) {
            updates.fullscreen_exits = exitCountRef.current;
            lastSyncedExitCountRef.current = exitCountRef.current;
            needsUpdate = true;
          }
          if (tabSwitchesCountRef.current !== lastSyncedTabSwitchesRef.current) {
            updates.tab_switches = tabSwitchesCountRef.current;
            lastSyncedTabSwitchesRef.current = tabSwitchesCountRef.current;
            needsUpdate = true;
          }
          if (devtoolsAttemptsCountRef.current !== lastSyncedDevtoolsRef.current) {
            updates.devtools_attempts = devtoolsAttemptsCountRef.current;
            lastSyncedDevtoolsRef.current = devtoolsAttemptsCountRef.current;
            needsUpdate = true;
          }
          if (needsUpdate) {
            supabase.from("sessions").update(updates).eq("id", sessionId);
          }
        }
        if (onForceSubmit) onForceSubmit();
      } else {
        setShowViolation(true);
        setViolationReason(getReason(nextCount));

        let count = 10;
        setResumeCountdown(count);
        const cd = setInterval(() => {
          count--;
          setResumeCountdown(count);
          if (count <= 0) {
            clearInterval(cd);
          }
        }, 1000);
      }
      return nextCount;
    });
  }, [sessionId, logViolation, supabase, onForceSubmit]);

  // Flush queue and batch update session stats to Supabase every 5 seconds
  useEffect(() => {
    if (!sessionId) return;
    flushTimer.current = setInterval(async () => {
      // 1. Flush violation logs
      const batch = logQueue.current.splice(0);
      if (batch.length > 0) {
        await supabase.from("violation_logs").insert(
          batch.map((v) => ({
            session_id: sessionId,
            type: v.type,
            metadata: v.metadata ?? null,
          }))
        );
      }

      // 2. Batch update session stats columns
      const updates: any = {};
      let needsUpdate = false;

      if (exitCountRef.current !== lastSyncedExitCountRef.current) {
        updates.fullscreen_exits = exitCountRef.current;
        lastSyncedExitCountRef.current = exitCountRef.current;
        needsUpdate = true;
      }
      if (tabSwitchesCountRef.current !== lastSyncedTabSwitchesRef.current) {
        updates.tab_switches = tabSwitchesCountRef.current;
        lastSyncedTabSwitchesRef.current = tabSwitchesCountRef.current;
        needsUpdate = true;
      }
      if (devtoolsAttemptsCountRef.current !== lastSyncedDevtoolsRef.current) {
        updates.devtools_attempts = devtoolsAttemptsCountRef.current;
        lastSyncedDevtoolsRef.current = devtoolsAttemptsCountRef.current;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await supabase.from("sessions").update(updates).eq("id", sessionId);
      }
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

        handlePause(
          (c) => `You exited fullscreen. Warning ${c} of 3. The exam is paused.`,
          "fullscreen_exit",
          { count: newCount, timestamp: new Date().toISOString() }
        );
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [fullscreenGranted, sessionId, supabase, handlePause]);

  // ── Tab / window blur / focus lost ─────────────────────────────────────────
  useEffect(() => {
    if (!fullscreenGranted || !sessionId) return;

    function recordTabSwitch(detail: string) {
      const now = Date.now();
      if (now - lastTabSwitchTime.current < 2000) return;
      lastTabSwitchTime.current = now;

      tabSwitchesCountRef.current += 1;

      handlePause(
        (c) => `Exam Paused: Focus lost or tab minimized (${detail}). Warning ${c} of 3.`,
        "tab_switch",
        { detail, timestamp: new Date().toISOString() }
      );
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
  }, [fullscreenGranted, sessionId, supabase, handlePause]);

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

        if (["Alt", "Meta", "F4", "Tab", "Escape"].includes(e.key)) {
          handlePause(
            (c) => `Exam Paused: Unauthorised shortcut attempt (${e.key}). Warning ${c} of 3.`,
            "keyboard_shortcut",
            { key: e.key, ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey }
          );
        } else {
          logViolation("keyboard_shortcut", { key: e.key, ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey });
        }
      }
    }
    document.addEventListener("keydown", blockKeys, true);
    return () => document.removeEventListener("keydown", blockKeys, true);
  }, [handlePause, logViolation]);

  // ── DevTools heuristic check ──────────────────────────────────────────────
  useEffect(() => {
    if (!fullscreenGranted || !sessionId) return;

    let lastCheckTime = 0;

    function checkDevTools() {
      const now = Date.now();
      if (now - lastCheckTime < 2000) return;
      lastCheckTime = now;

      if (isDevToolsOpen()) {
        devtoolsAttemptsCountRef.current += 1;
        logViolation("devtools_open", { timestamp: new Date().toISOString() });
      }
    }

    checkDevTools();

    window.addEventListener("resize", checkDevTools);
    return () => window.removeEventListener("resize", checkDevTools);
  }, [fullscreenGranted, sessionId, logViolation]);

  // ── Auto-submitted due to violations ─────────────────────────────────────
  if (forceSubmitted) {
    return (
      <div className="proctor-overlay bg-[--bg-base] text-[--text-primary] flex items-center justify-center p-6">
        <div className="card max-w-md w-full p-8 text-center border-red-500/20">
          <div className="w-[72px] h-[72px] rounded-full bg-[--red-bg] flex items-center justify-center mx-auto mb-5 shrink-0">
            <XOctagon size={36} className="text-[--red]" />
          </div>
          <h2 className="text-xl font-bold text-[--red] mb-3">
            Exam Auto-Submitted
          </h2>
          <p className="text-sm text-[--text-secondary] mb-5">
            Your exam has been automatically submitted due to repeated violations.
          </p>
          <div className="p-4 rounded-md border text-center text-xs bg-red-500/5 border-red-500/20 text-[--red] leading-relaxed">
            <strong>Reason:</strong> The exam was paused more than 3 times (due to fullscreen exits, tab switches, or key shortcut violations). This incident has been recorded.
          </div>
          <p className="mt-6 text-xs text-[--text-muted]">
            Please contact your supervisor immediately.
          </p>
        </div>
      </div>
    );
  }

  // ── Browser check screen ───────────────────────────────────────────────────
  if (isNotChrome && !bypassChromeCheck) {
    const getBrowserName = () => {
      if (typeof window === "undefined") return "your current browser";
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes("safari") && !ua.includes("chrome")) return "Safari";
      if (ua.includes("firefox")) return "Firefox";
      if (ua.includes("edg")) return "Microsoft Edge";
      return "your current browser";
    };

    const handleOpenInChrome = () => {
      const currentUrl = window.location.href.replace(/^https?:\/\//, "");
      // googlechrome:// URL scheme triggers Google Chrome application directly on macOS / iOS
      window.location.href = `googlechrome://${currentUrl}`;
    };

    const browserName = getBrowserName();

    return (
      <div className="min-h-screen bg-[--bg-base] text-[--text-primary] flex items-center justify-center p-6">
        <div className="card p-8 max-w-md text-center border border-slate-200 shadow-xl bg-white rounded-2xl flex flex-col space-y-6">
          <div className="w-[72px] h-[72px] rounded-full bg-amber-100 flex items-center justify-center mx-auto shrink-0">
            <ShieldAlert size={36} className="text-[#E85D04]" />
          </div>
          
          <div>
            <h2 className="text-xl font-bold text-slate-900 leading-tight">Google Chrome Recommended</h2>
            <p className="text-xs text-slate-500 mt-1 font-semibold">Testera requires Google Chrome to sit proctored exams.</p>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200/50 rounded-xl text-left text-xs text-slate-600 space-y-2">
            <p>
              We detected that you are using <strong className="text-slate-800">{browserName}</strong>. 
            </p>
            <p>
              Non-Chrome browsers (especially Safari) have strict media permissions and background tab play limitations that can disrupt your proctoring logs and lock you out of the exam.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button 
              onClick={handleOpenInChrome}
              className="w-full h-11 rounded-lg bg-[#E85D04] hover:bg-[#E85D04]/90 text-white font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              Launch in Google Chrome
            </button>
            <button 
              onClick={() => setBypassChromeCheck(true)}
              className="w-full h-11 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-xs transition-all cursor-pointer"
            >
              Continue in {browserName} (Not Recommended)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Mobile block screen ───────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="min-h-screen bg-[--bg-base] text-[--text-primary] flex items-center justify-center p-6">
        <div className="card p-8 max-w-md text-center">
          <div className="w-12 h-12 rounded-md bg-[--accent-muted] flex items-center justify-center mx-auto mb-4">
            <ShieldAlert size={24} className="text-[--amber]" />
          </div>
          <h1 className="text-lg font-bold text-[--text-primary] mb-3">Use a Laptop or Desktop</h1>
          <p className="text-xs text-[--text-secondary] leading-relaxed">
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
      <div className="min-h-screen bg-[--bg-base] text-[--text-primary] flex items-center justify-center p-6">
        <div className="card p-8 max-w-md text-center">
          <div className="w-12 h-12 rounded-md bg-[--accent-muted] flex items-center justify-center mx-auto mb-5">
            <Maximize2 size={24} className="text-[--accent-light]" />
          </div>
          <h2 className="text-[17px] font-bold text-[--text-primary] mb-3">Fullscreen Required</h2>
          <p className="text-xs text-[--text-secondary] mb-6 leading-relaxed">
            This exam must be taken in fullscreen mode. Your browser will enter fullscreen when you click Start.
            Exiting fullscreen will pause your exam and log a violation.
          </p>
          <p className="mb-6 text-xs font-semibold text-[--amber] bg-amber-500/5 border border-amber-500/10 rounded-md py-2 px-3">
            ⚠ Exiting fullscreen more than {MAX_FULLSCREEN_EXITS} times will automatically submit your exam.
          </p>
          {violationReason && (
            <p className="mb-4 text-xs text-[--red] font-semibold">{violationReason}</p>
          )}
          <button onClick={requestFullscreen} className="btn btn-primary w-full h-11 justify-center">
            <Maximize2 size={16} /> Enter Fullscreen & Start
          </button>
        </div>
      </div>
    );
  }

  // ── Violation overlay ─────────────────────────────────────────────────────
  if (showViolation) {
    const warningsLeft = MAX_FULLSCREEN_EXITS - fullscreenExitCount;
    return (
      <div className="proctor-overlay bg-[--bg-base] text-[--text-primary] flex items-center justify-center p-6">
        <div 
          className="card max-w-md w-full p-8 text-center" 
          style={{ 
            border: "2px solid rgba(248,113,113,0.35)", 
            boxShadow: "0 0 40px rgba(248,113,113,0.08)" 
          }}
        >
          {/* Pause icon container: 72px circle, bg: --red-bg */}
          <div className="w-[72px] h-[72px] rounded-full bg-[--red-bg] flex items-center justify-center mx-auto mb-5 shrink-0">
            <ShieldAlert size={36} className="text-[--red]" />
          </div>

          <h2 className="text-[26px] font-extrabold text-[--red] mb-2 leading-none">
            Exam Paused
          </h2>
          
          <p className="text-[13.5px] text-[--text-secondary] mb-6 leading-relaxed">
            {violationReason}
          </p>

          {/* Warning count pill: amber colour scheme */}
          {pauseCount > 0 && (
            <div className="mb-6 py-2.5 px-4 rounded-md border border-amber-500/20 bg-amber-500/5 text-[--amber] text-xs font-semibold">
              {3 - pauseCount > 0
                ? `⚠ ${3 - pauseCount} warning${(3 - pauseCount) > 1 ? "s" : ""} remaining before auto-submission`
                : "🚨 Final warning — next violation will auto-submit your exam"}
            </div>
          )}

          <p className="text-[11.5px] text-[--text-muted] mb-6 font-semibold uppercase tracking-wider">
            This incident has been logged and reported.
          </p>

          {/* Return button: full width, bg: --red, white text */}
          <button 
            onClick={requestFullscreen} 
            className="w-full h-11 rounded-md bg-[#EF4444] hover:bg-red-500 hover:scale-[1.01] active:scale-[0.99] text-white font-bold text-sm transition-all duration-150 cursor-pointer"
          >
            Return to Fullscreen
          </button>
        </div>
      </div>
    );
  }

  if (cameraStatus === "denied") {
    return (
      <div className="min-h-screen bg-[#F8F5F0] text-slate-800 flex items-center justify-center p-6 font-sans">
        <div className="card max-w-lg w-full p-8 shadow-xl border border-slate-200 bg-white rounded-2xl flex flex-col space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-500 shrink-0">
              <CameraOff size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 leading-tight">Camera Blocked or Unavailable</h2>
              <p className="text-xs text-slate-500 mt-0.5">Mandatory webcam proctoring is required to sit this exam.</p>
            </div>
          </div>

          {/* OS Tabs */}
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Step 1: Grant Operating System Permission</p>
              <div className="flex gap-2 p-1 bg-slate-100 rounded-lg w-fit">
                <button 
                  onClick={() => setActiveTab("mac")} 
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${activeTab === "mac" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
                >
                  macOS Instructions
                </button>
                <button 
                  onClick={() => setActiveTab("win")} 
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${activeTab === "win" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
                >
                  Windows Instructions
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl text-xs text-slate-600 leading-relaxed">
              {activeTab === "mac" ? (
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>Click the Apple logo () in the top-left and open <strong className="text-slate-800">System Settings</strong>.</li>
                  <li>Go to <strong className="text-slate-800">Privacy & Security</strong> &gt; <strong className="text-slate-800">Camera</strong>.</li>
                  <li>Locate your web browser (e.g. Chrome, Safari) and <strong className="text-slate-800">toggle it ON</strong>.</li>
                  <li>Restart your browser if prompted, then load this page.</li>
                </ol>
              ) : (
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>Open the <strong className="text-slate-800">Start Menu</strong> and go to <strong className="text-slate-800">Settings</strong> (⚙).</li>
                  <li>Click on <strong className="text-slate-800">Privacy & Security</strong> &gt; <strong className="text-slate-800">Camera</strong>.</li>
                  <li>Ensure <strong className="text-slate-800">"Camera access"</strong> and <strong className="text-slate-800">"Let apps access your camera"</strong> are turned ON.</li>
                  <li>Scroll down and verify access is toggled ON for your browser.</li>
                </ol>
              )}
            </div>
          </div>

          {/* Browser Tabs */}
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Step 2: Grant Site Permission in Browser</p>
              <div className="flex gap-2 p-1 bg-slate-100 rounded-lg w-fit">
                <button 
                  onClick={() => setActiveBrowser("chrome")} 
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${activeBrowser === "chrome" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
                >
                  Chrome / Edge
                </button>
                <button 
                  onClick={() => setActiveBrowser("safari")} 
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${activeBrowser === "safari" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
                >
                  Safari
                </button>
                <button 
                  onClick={() => setActiveBrowser("firefox")} 
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${activeBrowser === "firefox" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
                >
                  Firefox
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl text-xs text-slate-600 leading-relaxed">
              {activeBrowser === "chrome" && (
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>Click the <strong className="text-slate-800">Lock Icon</strong> (🔒 or 🎥) on the left side of your browser address bar.</li>
                  <li>Locate <strong className="text-slate-800">Camera</strong> and switch the option to <strong className="text-slate-800">Allow</strong>.</li>
                  <li>A bar will appear saying "Reload this page" — click <strong className="text-slate-800">Reload</strong>.</li>
                </ol>
              )}
              {activeBrowser === "safari" && (
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>Click <strong className="text-slate-800">Safari</strong> in the top menu bar, and click <strong className="text-slate-800">Settings for This Website...</strong></li>
                  <li>Find <strong className="text-slate-800">Camera</strong> in the dropdown box and select <strong className="text-slate-800">Allow</strong>.</li>
                  <li>Refresh the browser tab.</li>
                </ol>
              )}
              {activeBrowser === "firefox" && (
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>Click the <strong className="text-slate-800">Camera Icon</strong> on the address bar.</li>
                  <li>Clear any "Blocked Temporarily" rules by clicking the "X" button.</li>
                  <li>Reload the page and select "Allow" when the permissions popup prompts you.</li>
                </ol>
              )}
            </div>
          </div>

          <div className="flex gap-4 border-t border-slate-100 pt-5">
            <button 
              onClick={() => setCameraRetry(r => r + 1)}
              className="btn btn-primary h-11 flex-1 font-bold text-sm bg-[#E85D04] hover:bg-[#E85D04]/90 border-0 text-white rounded-lg transition-all cursor-pointer"
            >
              Verify Camera Access
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <WebcamProctor 
        sessionId={sessionId} 
        enabled={true} 
        onStatusChange={setCameraStatus}
        retryTrigger={cameraRetry}
      />
      {children}
    </>
  );
}
