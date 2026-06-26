"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Lock, Mail, Eye, EyeOff, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        setError(authError.message);
        setLoading(false);
      } else {
        // Refresh server state so middleware sees the new session cookie,
        // then navigate. Using window.location for a hard redirect ensures
        // cookies are fully flushed before the middleware auth check.
        router.refresh();
        setTimeout(() => {
          window.location.href = "/admin/dashboard";
        }, 200);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during login.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(108,99,255,0.2) 0%, transparent 65%)" }}
      />

      <div className="relative w-full max-w-md fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "linear-gradient(135deg, #6C63FF, #8B5CF6)", boxShadow: "0 8px 32px rgba(108,99,255,0.4)" }}>
            <GraduationCap size={32} />
          </div>
          <h1 className="text-3xl font-bold gradient-text mb-1">Testera Admin</h1>
          <p style={{ color: "var(--text-secondary)" }}>Department of SoCSE</p>
        </div>

        {/* Card */}
        <div className="card card--elevated p-8">
          <div className="flex items-center gap-2 mb-6 p-3 rounded-lg"
            style={{ background: "var(--color-accent-subtle)", border: "1px solid var(--color-accent-glow)" }}>
            <Shield size={16} style={{ color: "var(--color-accent-light)" }} className="shrink-0" />
            <span className="text-sm" style={{ color: "var(--color-accent-light)" }}>Admin access only. Students use the separate portal.</span>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  className="form-input pl-9"
                  placeholder="admin@socse.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPass ? "text" : "password"}
                  className="form-input pl-9 pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  onClick={() => setShowPass(!showPass)}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: "rgba(248,113,113,0.1)", color: "var(--color-danger)", border: "1px solid rgba(248,113,113,0.3)" }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn btn--primary w-full" disabled={loading} style={{ padding: "10px", fontSize: "14px" }}>
              {loading ? <><span className="spinner" />Signing in…</> : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
