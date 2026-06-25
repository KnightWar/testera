import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

// GET /api/sessions/[id]/detail — full session data for grading page
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { data: session, error: sessError } = await supabase
      .from("sessions")
      .select("*, students(roll_no, name)")
      .eq("id", id)
      .single();

    if (sessError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const [answersRes, scoresRes, questionsRes] = await Promise.all([
      supabase.from("answers").select("question_id, answer_text, is_flagged").eq("session_id", id),
      supabase.from("scores").select("question_id, marks_awarded, graded_by, ai_feedback").eq("session_id", id),
      supabase
        .from("questions")
        .select("id, q_no, question, type, option_a, option_b, option_c, option_d, correct_answer, max_marks, topic, keywords")
        .eq("exam_id", (session as any).exam_id)
        .order("q_no"),
    ]);

    return NextResponse.json({
      session,
      questions: questionsRes.data ?? [],
      answers: answersRes.data ?? [],
      scores: scoresRes.data ?? [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
