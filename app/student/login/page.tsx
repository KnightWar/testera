"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Hash, KeyRound, ArrowRight } from "lucide-react";

export default function StudentLoginPage() {
  const router = useRouter();
  const [rollNo, setRollNo] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/student-login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roll_no: rollNo.trim(), access_code: code.trim().toUpperCase() }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      setError(data.error ?? "Invalid credentials");
    } else {
      // Store session info for exam page (no Supabase auth for students)
      sessionStorage.setItem("testera_session", JSON.stringify(data.session));
      sessionStorage.setItem("testera_roll", rollNo.trim());
      router.push(`/student/exam/${data.session.exam_id}`);
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(52,211,153,0.12) 0%, transparent 65%)" }}
      />

      <div className="relative w-full max-w-md fade-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "linear-gradient(135deg, #059669, #34D399)", boxShadow: "0 8px 32px rgba(52,211,153,0.3)" }}>
            <GraduationCap size={32} />
          </div>
          <h1 className="text-3xl font-bold mb-1" style={{ background: "linear-gradient(135deg, #34D399, #6EE7B7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            Student Login
          </h1>
          <p style={{ color: "var(--text-secondary)" }}>Department of SoCSE — Testera</p>
        </div>

        <div className="glass-card p-8">
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Roll Number</label>
              <div className="relative">
                <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  className="form-input pl-9 font-mono"
                  placeholder="e.g. BCA2023001"
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value)}
                  required
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Access Code</label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  className="form-input pl-9 font-mono tracking-widest text-lg"
                  placeholder="XXXXXXXX"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  maxLength={8}
                  required
                  autoComplete="off"
                />
              </div>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Your access code was provided by your faculty
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg text-sm"
                style={{ background: "rgba(248,113,113,0.1)", color: "var(--danger)", border: "1px solid rgba(248,113,113,0.3)" }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn w-full btn-lg" disabled={loading}
              style={{ background: "linear-gradient(135deg, #059669, #34D399)", color: "white", boxShadow: "0 4px 20px rgba(52,211,153,0.3)" }}>
              {loading ? <><span className="spinner" />Verifying…</> : <>Start Exam <ArrowRight size={18} /></>}
            </button>
          </form>

          <div className="mt-5 p-4 rounded-xl text-sm" style={{ background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)", color: "var(--text-secondary)" }}>
            <strong style={{ color: "var(--info)" }}>Before you begin:</strong> Make sure you are on a laptop,
            have a stable internet connection, and will not be disturbed.
            Your screen activity will be monitored throughout the exam.
          </div>
        </div>
      </div>
    </main>
  );
}
