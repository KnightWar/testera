import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

// DELETE /api/sessions/[id] — delete a student session and all related scores/answers
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    // Delete related data first
    await supabase.from("scores").delete().eq("session_id", id);
    await supabase.from("answers").delete().eq("session_id", id);
    await supabase.from("violation_logs").delete().eq("session_id", id);

    // Delete the session
    const { error } = await supabase.from("sessions").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/sessions/[id] — update a session score manually (full session re-open or status tweak)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const supabase = createServiceClient();

    // Only allow specific fields to be patched
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allowed: Record<string, any> = {};
    if (body.submitted_at !== undefined) allowed.submitted_at = body.submitted_at;
    if (body.is_active !== undefined) allowed.is_active = body.is_active;

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
    }

    const { error } = await supabase.from("sessions").update(allowed).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
