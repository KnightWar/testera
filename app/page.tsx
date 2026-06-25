import Link from "next/link";
import { GraduationCap, ArrowRight, Shield, Zap, BarChart3 } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Ambient glows */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] rounded-full blur-[120px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(108,99,255,0.18) 0%, transparent 70%)" }}
      />
      <div
        className="absolute bottom-0 right-0 w-[500px] h-[400px] rounded-full blur-[100px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(167,139,250,0.1) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 text-center max-w-3xl mx-auto fade-in">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border mb-8"
          style={{ background: "rgba(108,99,255,0.1)", borderColor: "rgba(108,99,255,0.3)" }}>
          <Shield size={14} className="text-purple-400" />
          <span className="text-sm font-semibold text-purple-300">Proctored · Anti-Cheat · Auto-Graded</span>
        </div>

        {/* Logo + Name */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #6C63FF, #8B5CF6)", boxShadow: "0 8px 32px rgba(108,99,255,0.4)" }}>
            <GraduationCap size={28} />
          </div>
          <span className="text-4xl font-bold tracking-tight gradient-text">Testera</span>
        </div>

        <h1 className="text-5xl font-bold mb-4 leading-tight" style={{ color: "var(--text-primary)" }}>
          Exams, reinvented for<br />
          <span className="gradient-text">the modern classroom</span>
        </h1>

        <p className="text-lg mb-10" style={{ color: "var(--text-secondary)" }}>
          Secure, proctored online exams for SoCSE — with real-time monitoring,
          auto-grading, and detailed analytics.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/admin/login" className="btn btn-primary btn-lg">
            Admin Portal <ArrowRight size={18} />
          </Link>
          <Link href="/student/login" className="btn btn-secondary btn-lg">
            Student Login <ArrowRight size={18} />
          </Link>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-3 gap-4 mt-16 text-left">
          {[
            { icon: Shield, label: "Anti-Cheat", desc: "Fullscreen lock, tab monitoring, violation logs" },
            { icon: Zap,    label: "Auto-Grade", desc: "Instant MCQ scoring + AI-assisted subjective marking" },
            { icon: BarChart3, label: "Analytics", desc: "Per-topic heatmaps, difficulty index, class summary" },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="glass-card p-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{ background: "rgba(108,99,255,0.15)" }}>
                <Icon size={20} style={{ color: "var(--accent-primary)" }} />
              </div>
              <p className="font-semibold mb-1">{label}</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{desc}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-sm" style={{ color: "var(--text-muted)" }}>
          Department of SoCSE &nbsp;·&nbsp; Powered by Testera
        </p>
      </div>
    </main>
  );
}
