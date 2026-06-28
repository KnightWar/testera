"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, ArrowRight, ShieldAlert } from "lucide-react";

export default function StudentLoginPage() {
  const router = useRouter();
  const [rollNo, setRollNo] = useState("");
  const [examAccessCode, setExamAccessCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/student-login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        roll_no: rollNo.trim(),
        exam_access_code: examAccessCode.trim().toUpperCase(),
      }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      setError(data.error ?? "Invalid credentials");
    } else {
      sessionStorage.setItem("testera_session", JSON.stringify(data.session));
      sessionStorage.setItem("testera_roll", rollNo.trim());
      router.push(`/student/exam/${data.session.exam_id}`);
    }
    setLoading(false);
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
            Student Login
          </h1>
          <p className="text-xs text-[--text-secondary] text-center mb-7">Prav-AI</p>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Registration Number */}
            <div>
              <label className="block text-[11px] font-semibold text-[--text-muted] uppercase tracking-wider mb-1.5">
                Registration Number
              </label>
              <input
                type="text"
                placeholder="e.g. BCA2023001"
                className="w-full h-10 px-4 bg-[--bg-input] text-[--text-primary] placeholder:text-[--text-muted] border border-[--border] rounded-md text-sm font-mono font-semibold tracking-wider focus:outline-none focus:border-[--border-accent]"
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                required
                autoComplete="on"
              />
            </div>

            {/* Access Code */}
            <div>
              <label className="block text-[11px] font-semibold text-[--text-muted] uppercase tracking-wider mb-1.5">
                Exam Access Code
              </label>
              <input
                type="text"
                placeholder="ENTER ACCESS CODE"
                className="w-full h-10 px-4 font-mono font-semibold tracking-wider bg-[--bg-input] text-[--text-primary] placeholder:text-[--text-muted] border border-[--border] rounded-md text-sm focus:outline-none focus:border-[--border-accent] uppercase"
                value={examAccessCode}
                onChange={(e) => setExamAccessCode(e.target.value)}
                required
                autoComplete="off"
                maxLength={8}
              />
              <p className="text-[11.5px] text-[--text-secondary] mt-1.5">
                Enter the 8-character access code for this exam.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-md text-xs bg-[--red-bg] text-[--red] border border-red-500/20 font-medium">
                {error}
              </div>
            )}

            {/* Submit button */}
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
                  Start Exam <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          {/* Warning box */}
          <div className="mt-6 bg-amber-500/[0.04] border border-amber-500/20 rounded-md p-5 text-[--amber]">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert size={14} className="text-[--amber]" />
              <p className="text-xs font-bold uppercase tracking-wider">Before you begin</p>
            </div>
            <ol className="space-y-1.5 text-xs list-decimal list-inside opacity-90 leading-normal">
              <li>Use CHROME BROWSER for Assessment.</li>
              <li>Make sure you are on a laptop and sitting directly in front of the screen.</li>
              <li>Ensure you have a highly stable internet connection.</li>
              <li>Your screen activity and browser actions will be monitored throughout the exam.</li>
              <li>Switching tabs or exiting fullscreen will result in automatic submission.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
