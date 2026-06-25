import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { exportToExcel } from "@/lib/excel";

// GET /api/export?type=class_summary|analytics&exam_id=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const examId = searchParams.get("exam_id");

  if (!examId || !type) {
    return NextResponse.json({ error: "exam_id and type required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  function xlsxResponse(bytes: Uint8Array, filename: string): NextResponse {
    // Convert Uint8Array → Buffer (Node.js Buffer extends Uint8Array and satisfies BodyInit)
    const buffer = Buffer.from(bytes);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  if (type === "class_summary") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sessionsRaw } = await supabase
      .from("sessions")
      .select("*, students(roll_no, name), scores(marks_awarded)")
      .eq("exam_id", examId)
      .not("submitted_at", "is", null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessions = (sessionsRaw ?? []) as any[];

    const { data: questionsRaw } = await supabase
      .from("questions")
      .select("max_marks")
      .eq("exam_id", examId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const questions = (questionsRaw ?? []) as any[];
    const totalPossible = questions.reduce((s: number, q: any) => s + Number(q.max_marks), 0);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = sessions.map((s: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const total = s.scores?.reduce((sum: number, sc: any) => sum + sc.marks_awarded, 0) ?? 0;
      return {
        "Roll No": s.students?.roll_no ?? "",
        "Name": s.students?.name ?? "",
        "Score": total,
        "Max Score": totalPossible,
        "Percentage": totalPossible > 0 ? ((total / totalPossible) * 100).toFixed(1) + "%" : "N/A",
        "Tab Switches": s.tab_switches ?? 0,
        "Fullscreen Exits": s.fullscreen_exits ?? 0,
        "DevTools Attempts": s.devtools_attempts ?? 0,
        "Submitted At": s.submitted_at ? new Date(s.submitted_at).toLocaleString() : "Not submitted",
      };
    });

    const bytes = exportToExcel(rows, "Class Summary", "class_summary.xlsx");
    return xlsxResponse(bytes, `testera_class_summary_${examId.slice(0, 8)}.xlsx`);
  }

  if (type === "analytics") {
    const { data: questionsRaw } = await supabase
      .from("questions")
      .select("id, q_no, question, type, max_marks, topic")
      .eq("exam_id", examId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const questions = (questionsRaw ?? []) as any[];

    const qIds = questions.map((q: any) => q.id as string);

    const { data: scoresRaw } = qIds.length > 0
      ? await supabase.from("scores").select("question_id, marks_awarded, session_id").in("question_id", qIds)
      : { data: [] };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scores = (scoresRaw ?? []) as any[];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: submissionsRaw } = await (supabase as any)
      .from("sessions")
      .select("id")
      .eq("exam_id", examId)
      .not("submitted_at", "is", null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalSubmissions = (submissionsRaw as any[] | null)?.length ?? 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = questions.map((q: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const qScores = scores.filter((s: any) => s.question_id === q.id);
      const correct = qScores.filter((s: any) => Number(s.marks_awarded) >= Number(q.max_marks)).length;
      const avgMark =
        qScores.length > 0
          ? qScores.reduce((s: number, sc: any) => s + Number(sc.marks_awarded), 0) / qScores.length
          : 0;
      const pctCorrect = qScores.length > 0 ? correct / qScores.length : 0;
      return {
        "Q No": q.q_no,
        "Question": String(q.question).slice(0, 80),
        "Type": q.type,
        "Max Marks": q.max_marks,
        "Topic": q.topic ?? "",
        "Total Attempts": qScores.length,
        "Full Marks": correct,
        "% Correct": totalSubmissions > 0 ? ((correct / totalSubmissions) * 100).toFixed(1) + "%" : "N/A",
        "Avg Mark": avgMark.toFixed(2),
        "Difficulty": pctCorrect > 0.7 ? "Easy" : pctCorrect > 0.4 ? "Medium" : "Hard",
      };
    });

    const bytes = exportToExcel(rows, "Question Analytics", "analytics.xlsx");
    return xlsxResponse(bytes, `testera_analytics_${examId.slice(0, 8)}.xlsx`);
  }

  return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
}
