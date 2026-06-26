import Link from "next/link";
import { GraduationCap, ArrowRight, Shield, Zap, BarChart3 } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden hero-glow">
      <div className="relative z-10 text-center max-w-3xl mx-auto fade-in">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-muted mb-8"
          style={{ background: "var(--color-accent-subtle)", borderColor: "var(--color-accent-glow)" }}>
          <Shield size={14} style={{ color: "var(--color-accent-light)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--color-accent-light)" }}>Proctored · Anti-Cheat · Auto-Graded</span>
        </div>

        {/* Logo + Name */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-light))", boxShadow: "0 8px 32px var(--color-accent-glow)" }}>
            <GraduationCap size={28} />
          </div>
          <span className="text-4xl font-bold tracking-tight gradient-text">Testera</span>
        </div>

        <h1 className="text-5xl font-bold mb-4 leading-tight">
          Exams, reinvented for<br />
          <span className="gradient-text">the modern classroom</span>
        </h1>

        <p className="text-lg mb-10 text-secondary">
          Secure, proctored online exams for SoCSE — with real-time monitoring,
          auto-grading, and detailed analytics.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/admin/login" className="btn btn--primary" style={{ padding: "12px 24px", fontSize: "14px" }}>
            Admin Portal <ArrowRight size={18} />
          </Link>
          <Link href="/student/login" className="btn btn--secondary" style={{ padding: "12px 24px", fontSize: "14px" }}>
            Student Login <ArrowRight size={18} />
          </Link>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-3 gap-4 mt-16 text-left">
          {[
            { icon: Shield, label: "Anti-Cheat", desc: "Fullscreen lock, tab monitoring, violation logs", colorClass: "feature-card__icon--red" },
            { icon: Zap,    label: "Auto-Grade", desc: "Instant MCQ scoring + AI-assisted subjective marking", colorClass: "feature-card__icon--purple" },
            { icon: BarChart3, label: "Analytics", desc: "Per-topic heatmaps, difficulty index, class summary", colorClass: "feature-card__icon--teal" },
          ].map(({ icon: Icon, label, desc, colorClass }) => (
            <div key={label} className="feature-card card card--elevated">
              <div className={`feature-card__icon ${colorClass}`}>
                <Icon size={20} />
              </div>
              <p className="feature-card__title">{label}</p>
              <p className="feature-card__desc">{desc}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-sm text-tertiary">
          Department of SoCSE &nbsp;·&nbsp; Powered by Testera
        </p>
      </div>
    </main>
  );
}

