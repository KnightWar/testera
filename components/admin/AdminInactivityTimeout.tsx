"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { AlertTriangle } from "lucide-react";

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const WARNING_TIMEOUT = 30 * 1000; // 30 seconds warning

export default function AdminInactivityTimeout() {
  const router = useRouter();
  const pathname = usePathname();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(30);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef(30);

  // Function to save the current state (inputs and path)
  const saveStateBeforeLogout = () => {
    const unsavedInputs: { [key: string]: string } = {};
    document.querySelectorAll("input, textarea").forEach((el) => {
      const input = el as HTMLInputElement | HTMLTextAreaElement;
      // Skip passwords or auth inputs
      if (input.type === "password" || input.name === "password" || input.name === "email") {
        return;
      }
      const key = input.id || input.name || input.placeholder;
      if (key && input.value) {
        unsavedInputs[key] = input.value;
      }
    });

    const state = {
      pathname,
      unsavedInputs,
      timestamp: Date.now(),
    };

    localStorage.setItem("testera_admin_saved_state", JSON.stringify(state));
  };

  const handleLogout = async () => {
    cleanupTimers();
    saveStateBeforeLogout();

    const supabase = createClient();
    await supabase.auth.signOut();
    
    // Hard refresh/redirect to login page
    window.location.href = "/admin/login?timeout=1";
  };

  const startCountdown = () => {
    setShowWarning(true);
    setCountdown(30);
    countdownRef.current = 30;

    if (warningIntervalRef.current) clearInterval(warningIntervalRef.current);
    
    warningIntervalRef.current = setInterval(() => {
      countdownRef.current -= 1;
      setCountdown(countdownRef.current);

      if (countdownRef.current <= 0) {
        if (warningIntervalRef.current) clearInterval(warningIntervalRef.current);
        handleLogout();
      }
    }, 1000);
  };

  const resetTimer = () => {
    if (showWarning) return;

    cleanupTimers();

    timeoutRef.current = setTimeout(() => {
      startCountdown();
    }, INACTIVITY_TIMEOUT - WARNING_TIMEOUT);
  };

  const cleanupTimers = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningIntervalRef.current) clearInterval(warningIntervalRef.current);
  };

  const handleStaySignedIn = () => {
    setShowWarning(false);
    resetTimer();
  };

  useEffect(() => {
    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
    
    resetTimer();

    const activityHandler = () => resetTimer();

    events.forEach((event) => {
      window.addEventListener(event, activityHandler);
    });

    return () => {
      cleanupTimers();
      events.forEach((event) => {
        window.removeEventListener(event, activityHandler);
      });
    };
  }, [pathname, showWarning]);

  // Restore input values if we returned to this page from a saved state
  useEffect(() => {
    const saved = localStorage.getItem("testera_admin_saved_state");
    if (!saved) return;

    try {
      const state = JSON.parse(saved);
      // Check if we are on the same page and it was saved in the last 15 minutes
      if (state.pathname === pathname && Date.now() - state.timestamp < 15 * 60 * 1000) {
        let restoredCount = 0;
        document.querySelectorAll("input, textarea").forEach((el) => {
          const input = el as HTMLInputElement | HTMLTextAreaElement;
          const key = input.id || input.name || input.placeholder;
          if (key && state.unsavedInputs[key] !== undefined) {
            input.value = state.unsavedInputs[key];
            // Trigger input event to let React/state handlers catch the change
            input.dispatchEvent(new Event("input", { bubbles: true }));
            restoredCount++;
          }
        });
        if (restoredCount > 0) {
          console.log(`[Auto-Restore] Restored ${restoredCount} form inputs from saved state.`);
          // Clear state after restoring once to avoid stale overrides
          localStorage.removeItem("testera_admin_saved_state");
        }
      }
    } catch (e) {
      console.error("[Auto-Restore] Failed to restore inputs:", e);
    }
  }, [pathname]);

  // Poll session-check endpoint every 5 seconds to detect concurrent logins
  useEffect(() => {
    let active = true;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/auth/session-check");
        if (!res.ok) return;
        const data = await res.json();

        if (active && !data.active && data.reason === "concurrent_login") {
          clearInterval(interval);
          
          const supabase = createClient();
          await supabase.auth.signOut();
          document.cookie = "session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
          window.location.href = "/admin/login?error=concurrent";
        }
      } catch (err) {
        console.error("Concurrent login check error:", err);
      }
    }, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl p-6 max-w-sm w-full space-y-4 text-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 font-sans text-sm">Inactivity Timeout</h3>
            <p className="text-xs text-slate-500 font-sans">Are you still working?</p>
          </div>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed font-sans">
          You have been inactive for a while. To protect your work, you will be logged out in <span className="font-mono font-bold text-amber-600">{countdown}s</span>. Your inputs will be cached for recovery.
        </p>

        <div className="flex gap-3">
          <button
            onClick={handleStaySignedIn}
            className="btn btn-primary flex-1 h-9 text-xs font-bold cursor-pointer"
          >
            Stay Signed In
          </button>
          <button
            onClick={handleLogout}
            className="btn btn-secondary flex-1 h-9 text-xs font-bold border border-slate-200 text-red-650 hover:text-red-700 cursor-pointer"
          >
            Log Out Now
          </button>
        </div>
      </div>
    </div>
  );
}
