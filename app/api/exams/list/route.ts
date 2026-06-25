import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

// GET /api/exams/list — return all exams ordered by creation date
export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("exams")
      .select("id, title, description, duration_mins, start_at, end_at, shuffle_questions, negative_marking, pool_size, created_at")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
