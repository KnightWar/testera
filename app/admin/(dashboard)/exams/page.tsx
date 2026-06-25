import { createServerSideClient } from "@/lib/supabase-server";
import Link from "next/link";
import { Plus, Settings, Upload, BarChart3, Users, ArrowRight } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Exams" };

export default async function ExamsListPage() {
  const supabase = await createServerSideClient();
  const { data: examsRaw } = await supabase.from("exams").select("*").order("created_at", { ascending: false });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exams = (examsRaw ?? []) as any[];

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Exam Manager</h1>
          <p style={{ color: "var(--text-secondary)" }}>Create, configure, and monitor all exams</p>
        </div>
        <Link href="/admin/exams/new" className="btn btn-primary">
          <Plus size={16} /> Create Exam
        </Link>
      </div>

      {(!exams || exams.length === 0) ? (
        <div className="glass-card p-16 text-center">
          <p className="text-5xl mb-4">📝</p>
          <h2 className="text-xl font-bold mb-2">No exams yet</h2>
          <p className="mb-6" style={{ color: "var(--text-secondary)" }}>Create your first exam to get started</p>
          <Link href="/admin/exams/new" className="btn btn-primary">
            <Plus size={16} /> Create First Exam
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {exams.map((exam) => {
            const now = new Date();
            const status = !exam.start_at ? "draft" :
              now < new Date(exam.start_at) ? "upcoming" :
              exam.end_at && now > new Date(exam.end_at) ? "ended" : "live";

            const statusColors = { draft: "badge-neutral", upcoming: "badge-info", live: "badge-success", ended: "badge-warning" };

            return (
              <div key={exam.id} className="glass-card p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-lg font-bold">{exam.title}</h2>
                      <span className={`badge ${statusColors[status]}`}>{status}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm" style={{ color: "var(--text-secondary)" }}>
                      <span>{exam.duration_mins} min</span>
                      {exam.start_at && <span>Opens: {new Date(exam.start_at).toLocaleString()}</span>}
                      {exam.end_at && <span>Closes: {new Date(exam.end_at).toLocaleString()}</span>}
                      {exam.shuffle_questions && <span>🔀 Shuffled</span>}
                      {exam.negative_marking && <span>➖ Negative marking</span>}
                      {exam.pool_size && <span>🎲 Pool: {exam.pool_size} Qs</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Link href={`/admin/exams/${exam.id}/upload`} className="btn btn-secondary btn-sm">
                      <Upload size={13} /> Questions
                    </Link>
                    <Link href={`/admin/exams/${exam.id}/config`} className="btn btn-secondary btn-sm">
                      <Settings size={13} /> Config
                    </Link>
                    <Link href={`/admin/exams/${exam.id}/results`} className="btn btn-secondary btn-sm">
                      <BarChart3 size={13} /> Results
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
