"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Lock, Mail, Eye, EyeOff, Shield, Sun, Moon, AlertTriangle, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [timeoutActive, setTimeoutActive] = useState(false);
  const [concurrentActive, setConcurrentActive] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("timeout") === "1") {
      setTimeoutActive(true);
    }
    if (params.get("error") === "concurrent") {
      setConcurrentActive(true);
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  async function handleBiometricLogin() {
    setError("");
    setBioLoading(true);
    try {
      const optionsRes = await fetch("/api/auth/passkey/login/options");
      if (!optionsRes.ok) {
        throw new Error(await optionsRes.text());
      }
      const options = await optionsRes.json();

      const { startAuthentication } = await import("@simplewebauthn/browser");
      const assertionResponse = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch("/api/auth/passkey/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assertionResponse),
      });

      if (!verifyRes.ok) {
        const errorData = await verifyRes.json();
        throw new Error(errorData.error || "Biometric validation failed");
      }

      const data = await verifyRes.json();

      const supabase = createClient();
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      if (sessionError) throw sessionError;

      router.refresh();
      setTimeout(() => {
        window.location.href = "/admin/dashboard";
      }, 200);
    } catch (err: any) {
      console.error("Biometric login failed:", err);
      setError(err.message || "Face ID / Touch ID verification failed.");
    } finally {
      setBioLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const resolvedEmail = `${email.trim()}@pravAI.org`;

      const whitelisted = ["admin1@pravai.org", "admin2@pravai.org"];
      if (!whitelisted.includes(resolvedEmail.toLowerCase())) {
        setError("Unauthorized administrator account.");
        setLoading(false);
        return;
      }

      const { error: authError } = await supabase.auth.signInWithPassword({ email: resolvedEmail, password });

      if (authError) {
        setError(authError.message);
        setLoading(false);
      } else {
        // Generate new session token and update user metadata to prevent concurrent logins
        const newToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        await supabase.auth.updateUser({ data: { session_token: newToken } });
        document.cookie = `session_token=${newToken}; path=/; max-age=86400; SameSite=Lax`;

        // Refresh server state so middleware sees the new session cookie,
        // then navigate. Using window.location for a hard redirect ensures
        // cookies are fully flushed before the middleware auth check.
        router.refresh();
        setTimeout(() => {
          let destination = "/admin/dashboard";
          const saved = localStorage.getItem("testera_admin_saved_state");
          if (saved) {
            try {
              const state = JSON.parse(saved);
              if (state.pathname && Date.now() - state.timestamp < 15 * 60 * 1000) {
                destination = state.pathname;
              }
            } catch { }
          }
          window.location.href = destination;
        }, 200);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during login.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[--bg-base] flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <img src="/logo.png" alt="Prav-AI Logo" className="w-12 h-12 object-contain" />
        </div>

        {/* Login Card */}
        <div className="card p-8">
          <h1 className="text-lg font-bold text-[--text-primary] text-center mb-1">
            Admin Login
          </h1>
          <p className="text-xs text-[--text-secondary] text-center mb-7">
            Prav-AI - Skill Enhancer
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {timeoutActive && (
              <div className="p-3.5 rounded-md text-xs bg-amber-500/10 text-amber-500 border border-amber-500/20 font-medium leading-relaxed">
                You have been signed out due to inactivity. Log in again to restore your workspace progress.
              </div>
            )}

            {concurrentActive && (
              <div className="p-3.5 rounded-md text-xs bg-red-500/10 text-red-500 border border-red-500/20 font-medium leading-relaxed flex items-start gap-2.5">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>
                  Concurrent login detected! You have been logged out because this account was logged into on another browser or device.
                </span>
              </div>
            )}

            {/* Admin ID */}
            <div>
              <label className="block text-[11px] font-semibold text-[--text-muted] uppercase tracking-wider mb-1.5">
                Admin ID
              </label>
              <input
                type="text"
                className="w-full h-10 px-4 bg-[--bg-input] text-[--text-primary] placeholder:text-[--text-muted] border border-[--border] rounded-md text-sm focus:outline-none focus:border-[--border-accent]"
                placeholder="e.g. admin"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[11px] font-semibold text-[--text-muted] uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  className="w-full h-10 pl-4 pr-10 bg-[--bg-input] text-[--text-primary] placeholder:text-[--text-muted] border border-[--border] rounded-md text-sm focus:outline-none focus:border-[--border-accent]"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[--text-muted] hover:text-[--text-secondary] cursor-pointer"
                  onClick={() => setShowPass(!showPass)}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-md text-xs bg-[--red-bg] text-[--red] border border-red-500/20 font-medium">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="btn btn-primary w-full h-10 flex items-center justify-center gap-2 mt-2 cursor-pointer rounded-md font-bold text-sm"
              disabled={loading || bioLoading}
            >
              {loading ? (
                <>
                  <span className="spinner" /> Verifying…
                </>
              ) : (
                <>
                  Sign In <ArrowRight size={14} />
                </>
              )}
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-[--border] opacity-50"></div>
              <span className="flex-shrink mx-4 text-[10px] text-[--text-muted] font-bold uppercase tracking-wider">or</span>
              <div className="flex-grow border-t border-[--border] opacity-50"></div>
            </div>

            <button
              type="button"
              onClick={handleBiometricLogin}
              disabled={bioLoading || loading}
              className="w-full h-10 flex items-center justify-center gap-2 border border-[--border] hover:bg-slate-50 cursor-pointer rounded-md font-semibold text-sm transition-colors text-[--text-primary] disabled:opacity-50"
            >
              {bioLoading ? (
                <>
                  <span className="spinner border-slate-600 animate-spin" /> Scanning Biometrics…
                </>
              ) : (
                <>
                  <Shield size={16} className="text-[#E85D04]" /> Sign In with Face ID
                </>
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
