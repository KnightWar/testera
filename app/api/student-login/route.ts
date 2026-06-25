import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { shuffle, pickRandom } from "@/lib/grading";

export async function POST(req: NextRequest) {
  try {
    const { roll_no, access_code } = await req.json();

    if (!roll_no || !access_code) {
      return NextResponse.json({ error: "Roll number and access code are required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // 1. Look up student
    const { data: student } = await supabase
      .from("students")
      .select("*, exams(*)")
      .eq("roll_no", roll_no)
      .eq("access_code", access_code.toUpperCase())
      .single();

    if (!student) {
      return NextResponse.json({ error: "Invalid roll number or access code" }, { status: 401 });
    }

    const exam = student.exams as any;

    // 2. Check exam window
    const now = new Date();
    if (exam.start_at && now < new Date(exam.start_at)) {
      return NextResponse.json({ error: `Exam opens at ${new Date(exam.start_at).toLocaleString()}` }, { status: 403 });
    }
    if (exam.end_at && now > new Date(exam.end_at)) {
      return NextResponse.json({ error: "This exam has ended" }, { status: 403 });
    }

    // 3. Check for existing session (one-active-per-student)
    const { data: existingSession } = await supabase
      .from("sessions")
      .select("*")
      .eq("student_id", student.id)
      .eq("exam_id", exam.id)
      .maybeSingle();

    if (existingSession?.submitted_at) {
      return NextResponse.json({ error: "You have already submitted this exam" }, { status: 403 });
    }

    // 4. Check grace recovery window
    if (existingSession && !existingSession.is_active) {
      const graceExpires = existingSession.grace_expires_at ? new Date(existingSession.grace_expires_at) : null;
      if (graceExpires && now > graceExpires) {
        return NextResponse.json({ error: "Session expired. Contact your supervisor." }, { status: 403 });
      }
      // Resume existing session
      await supabase.from("sessions").update({ is_active: true, last_seen_at: now.toISOString() }).eq("id", existingSession.id);
      return NextResponse.json({ session: existingSession });
    }

    if (existingSession?.is_active) {
      // Resume active session
      return NextResponse.json({ session: existingSession });
    }

    // 5. Build question order (shuffle + pool)
    const { data: allQuestions } = await supabase
      .from("questions")
      .select("id")
      .eq("exam_id", exam.id);

    let questionIds = allQuestions?.map((q) => q.id) ?? [];

    if (exam.shuffle_questions) {
      questionIds = shuffle(questionIds);
    }
    if (exam.pool_size && exam.pool_size < questionIds.length) {
      questionIds = pickRandom(questionIds, exam.pool_size);
    }

    // 6. Create new session
    const { data: newSession, error: sessionError } = await supabase
      .from("sessions")
      .insert({
        student_id: student.id,
        exam_id: exam.id,
        question_order: questionIds,
        started_at: now.toISOString(),
        last_seen_at: now.toISOString(),
        is_active: true,
      })
      .select()
      .single();

    if (sessionError || !newSession) {
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }

    return NextResponse.json({ session: newSession });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
