import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { shuffle, pickRandom } from "@/lib/grading";

export async function POST(req: NextRequest) {
  try {
    const { roll_no, exam_access_code } = await req.json();

    if (!roll_no || !exam_access_code) {
      return NextResponse.json(
        { error: "Registration number and exam access code are required" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    const code = exam_access_code.trim().toUpperCase();

    // 1. Confirm student roll_no is registered with this access code, and join exam details
    const { data: student } = await supabase
      .from("students")
      .select("*, exams(*)")
      .eq("roll_no", roll_no.trim())
      .eq("access_code", code)
      .single();

    if (!student || !student.exams) {
      return NextResponse.json(
        { error: "Invalid exam access code or registration number. Please check with your supervisor." },
        { status: 401 }
      );
    }

    const exam = student.exams;

    // 2. Check exam window (access code only valid during the window)
    const now = new Date();
    if (exam.start_at && now < new Date(exam.start_at)) {
      return NextResponse.json(
        { error: `Exam has not started yet. It opens at ${new Date(exam.start_at).toLocaleString()}` },
        { status: 403 }
      );
    }
    if (exam.end_at && now > new Date(exam.end_at)) {
      return NextResponse.json(
        { error: "This exam has ended. The access code is no longer valid." },
        { status: 403 }
      );
    }

    // 4. Check for existing session (one-active-per-student)
    const { data: existingSession } = await supabase
      .from("sessions")
      .select("*")
      .eq("student_id", student.id)
      .eq("exam_id", exam.id)
      .maybeSingle();

    if (existingSession?.submitted_at) {
      return NextResponse.json(
        { error: "You have already submitted this exam." },
        { status: 403 }
      );
    }

    // 5. Grace recovery window
    if (existingSession && !existingSession.is_active) {
      const graceExpires = existingSession.grace_expires_at
        ? new Date(existingSession.grace_expires_at)
        : null;
      if (graceExpires && now > graceExpires) {
        return NextResponse.json(
          { error: "Session expired. Contact your supervisor." },
          { status: 403 }
        );
      }
      // Resume existing session
      await supabase
        .from("sessions")
        .update({ is_active: true, last_seen_at: now.toISOString() })
        .eq("id", existingSession.id);
      return NextResponse.json({ session: existingSession });
    }

    if (existingSession?.is_active) {
      // Resume active session
      return NextResponse.json({ session: existingSession });
    }

    // 6. Build question order (shuffle + pool)
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

    // 7. Create new session
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
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
