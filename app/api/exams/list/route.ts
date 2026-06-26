import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

// GET /api/exams/list — return all exams ordered by creation date
export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("exams")
      .select(`
        id, title, description, duration_mins, start_at, end_at, shuffle_questions, negative_marking, pool_size, created_at,
        questions:questions(count),
        students:students(count)
      `)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const formatted = data?.map((exam) => {
      const qCountObj = exam.questions as unknown as { count: number }[];
      const qCount = qCountObj?.[0]?.count ?? 0;
      
      const sCountObj = exam.students as unknown as { count: number }[];
      const sCount = sCountObj?.[0]?.count ?? 0;
      
      const { questions, students, ...rest } = exam;
      return {
        ...rest,
        questions_count: qCount,
        students_count: sCount,
      };
    });

    return NextResponse.json(formatted ?? []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
