import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

// GET /api/results/[exam_id] — sessions with students and scores for the results page
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: examId } = await params;
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("sessions")
      .select("*, students(roll_no, name), scores(marks_awarded, graded_by, question_id)")
      .eq("exam_id", examId)
      .order("created_at");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
