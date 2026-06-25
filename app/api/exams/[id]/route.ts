import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

// PATCH /api/exams/[id] — update exam title + description
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { title, description } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase.from("exams").update({ title: title.trim(), description: description ?? null }).eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/exams/[id] — delete exam and all related data
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    // Get all session IDs for this exam first (for score/answer cleanup)
    const { data: sessions } = await supabase.from("sessions").select("id").eq("exam_id", id);
    const sessionIds = (sessions ?? []).map((s) => s.id);

    // Delete scores, answers, violation_logs for these sessions
    if (sessionIds.length > 0) {
      await supabase.from("scores").delete().in("session_id", sessionIds);
      await supabase.from("answers").delete().in("session_id", sessionIds);
      await supabase.from("violation_logs").delete().in("session_id", sessionIds);
    }

    // Delete sessions
    await supabase.from("sessions").delete().eq("exam_id", id);

    // Delete students
    await supabase.from("students").delete().eq("exam_id", id);

    // Delete questions
    await supabase.from("questions").delete().eq("exam_id", id);

    // Finally delete the exam
    const { error } = await supabase.from("exams").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
