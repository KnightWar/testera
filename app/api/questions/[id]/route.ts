import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

// GET /api/questions/[exam_id] — fetch all questions for an exam (used by results page for totalPossible)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: examId } = await params;
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("questions")
      .select("id, q_no, max_marks")
      .eq("exam_id", examId)
      .order("q_no");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
