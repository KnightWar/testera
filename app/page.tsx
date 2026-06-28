import Link from "next/link";
import { ArrowRight, Shield, Zap, KeyRound, MonitorCheck, FileSpreadsheet, LayoutGrid } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#F8F5F0] text-slate-800 flex flex-col justify-between font-sans relative overflow-hidden">
      {/* Background Decorative Grid */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]" />

      {/* Header */}
      <header className="bg-[#00457F] mx-auto w-full px-6 py-8 flex items-center justify-between border-b border-slate-200/60 z-10">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Prav-AI Logo" className="w-12 h-12 object-contain" />
          <div>
            <p className="text-sm font-bold text-slate-100 leading-none tracking-tight">Prav-AI</p>
            <p className="text-[10px] font-semibold text-[#00457F] text-slate-400 uppercase tracking-wider mt-0.5">AI Skill Enhancer</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-[silver] bg-[silver]/20 px-2.5 py-1 rounded-full">
          v1.0 - Skillify Edition
        </span>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto w-full px-6 py-16 flex-1 flex flex-col justify-center items-center z-10 space-y-12">
        {/* Hero Section */}
        <div className="text-center max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-orange-500/10 border border-orange-500/20 rounded-full text-[10px] font-bold text-[#E85D04] uppercase tracking-wider">
            <Shield size={10} className="fill-current" />
            SECURE SKILL AND KNOWLEDGE ASSESSMENT PLATFORM
          </div>
          <h1 className="text-4xl md:text-4xl font-display font-bold tracking-tight text-slate-900 leading-[1.15]">
            SKILLIFY - ASSESS AND EXCEL
          </h1>
          <p className="text-sm md:text-base text-slate-500 text-center mx-auto leading-relaxed">
            Automated browser proctoring, secure credentials validation, and real-time activity logs.
            <br />
            Choose your login type to proceed.
          </p>
        </div>

        {/* Portal Cards Grid */}
        <div className="grid md:grid-cols-2 gap-8 w-full max-w-4xl">
          {/* Card 1: Students */}
          <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm flex flex-col justify-between space-y-8 hover:shadow-md transition-all">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-1 bg-[#E85D04]/10 text-[#E85D04] px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                Student Portal
              </div>
              <h2 className="text-2xl font-display font-bold text-slate-900">Assess Knowledge & Skills</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Log in using your Registration ID and the 8-character exam access code provided by your evaluator.
              </p>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex gap-2.5 text-xs text-slate-500 items-center">
                  <KeyRound size={14} className="text-[#E85D04] shrink-0" />
                  <span>Access Code validation required</span>
                </div>
                <div className="flex gap-2.5 text-xs text-slate-500 items-center">
                  <MonitorCheck size={14} className="text-[#E85D04] shrink-0" />
                  <span>Automatic tab and fullscreen tracking</span>
                </div>
              </div>
            </div>

            <Link
              href="/student/login"
              className="btn btn-primary h-11 w-full font-bold flex items-center justify-center gap-2 text-white bg-[#1F7A54] rounded-lg transition-all cursor-pointer">
              Student Login <ArrowRight size={14} />
            </Link>
          </div>

          {/* Card 2: Administrators */}
          <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm flex flex-col justify-between space-y-8 hover:shadow-md transition-all">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                Admin Console
              </div>
              <h2 className="text-2xl font-display font-bold text-slate-900">Console Manager</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Configure exam specifications, upload questions templates, configure active codes, and monitor live proctored sessions.
              </p>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex gap-2.5 text-xs text-slate-500 items-center">
                  <FileSpreadsheet size={14} className="text-[#E85D04] shrink-0" />
                  <span>Bulk question sheet uploads</span>
                </div>
                <div className="flex gap-2.5 text-xs text-slate-500 items-center">
                  <LayoutGrid size={14} className="text-[#E85D04] shrink-0" />
                  <span>Live proctor and violations review</span>
                </div>
              </div>
            </div>

            <Link
              href="/admin/login"
              className="btn btn-secondary h-11 w-full font-bold flex items-center justify-center gap-2 border border-slate-200 text-black hover:bg-[#00457F] hover:text-white rounded-lg transition-all cursor-pointer"
            >
              Access Admin Console <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto w-full px-6 py-6 border-t border-slate-200/60 z-10 flex flex-col sm:flex-row justify-between items-center gap-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          SoCSE ASSESSMENT PORTAL · JUNE 2026
        </p>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          @copyright 2026 - SoCSE, MSU (ID: 724 009)
        </p>
      </footer>
    </div>
  );
}
