"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, Home, GraduationCap } from "lucide-react";

export default function SubmittedPage() {
  useEffect(() => {
    document.title = "Exam Submitted";
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("testera_session");
      sessionStorage.removeItem("testera_roll");
    }
  }, []);

  return (
    <div className="min-h-screen bg-[--bg-base] text-[--text-primary]">
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center card p-10 bg-white">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 size={32} className="text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold mb-3">Exam Submitted!</h1>
          <p className="text-sm mb-6 text-[--text-secondary]">
            Your answers have been saved and submitted successfully.
            Your faculty will release the results soon.
          </p>
          <div className="p-4 rounded bg-[--accent-muted] border border-[--accent-border] mb-6 text-xs text-[--text-secondary]">
            <GraduationCap size={16} className="inline mr-1 text-[--accent]" />
            Department of SoCSE · Testera Examination System
          </div>
          <Link href="/" className="btn btn-ghost w-full">
            <Home size={16} /> Return to Portal
          </Link>
        </div>
      </main>
    </div>
  );
}
