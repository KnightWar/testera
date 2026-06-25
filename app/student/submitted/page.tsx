import Link from "next/link";
import { CheckCircle2, Home, GraduationCap } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Exam Submitted" };

export default function SubmittedPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center glass-card p-12 fade-in">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: "rgba(52,211,153,0.15)", border: "2px solid rgba(52,211,153,0.3)" }}>
          <CheckCircle2 size={40} style={{ color: "var(--success)" }} />
        </div>
        <h1 className="text-3xl font-bold mb-3">Exam Submitted!</h1>
        <p className="mb-6" style={{ color: "var(--text-secondary)" }}>
          Your answers have been saved and submitted successfully.
          Your faculty will release the results soon.
        </p>
        <div className="p-4 rounded-xl mb-6 text-sm"
          style={{ background: "rgba(108,99,255,0.08)", border: "1px solid rgba(108,99,255,0.2)", color: "var(--text-secondary)" }}>
          <GraduationCap size={16} className="inline mr-1" style={{ color: "var(--accent-secondary)" }} />
          Department of SoCSE · Testera Examination System
        </div>
        <Link href="/student/login" className="btn btn-secondary w-full">
          <Home size={16} /> Return to Portal
        </Link>
      </div>
    </main>
  );
}
