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
  const [error, setError] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [timeoutActive, setTimeoutActive] = useState(false);

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
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const resolvedEmail = `${email.trim()}@socse.edu`;
      const { error: authError } = await supabase.auth.signInWithPassword({ email: resolvedEmail, password });

      if (authError) {
        setError(authError.message);
        setLoading(false);
      } else {
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
              disabled={loading}
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
          </form>

        </div>
      </div>
    </div>
  );
}
