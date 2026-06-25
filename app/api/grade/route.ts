import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { gradeMCQ, gradeByKeywords, gradeWithAI } from "@/lib/grading";

export async function POST(req: NextRequest) {
  try {
    const { session_id } = await req.json();
    if (!session_id) return NextResponse.json({ error: "session_id required" }, { status: 400 });

    const supabase = createServiceClient();

    // Load session
    const { data: session } = await supabase.from("sessions").select("*, exams(*)").eq("id", session_id).single();
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const exam = session.exams as any;

    // Load answers for this session
    const { data: answers } = await supabase.from("answers").select("*").eq("session_id", session_id);

    // Load questions
    const questionIds = answers?.map((a) => a.question_id) ?? [];
    if (questionIds.length === 0) return NextResponse.json({ grades: [], total: 0 });

    const { data: questions } = await supabase.from("questions").select("*").in("id", questionIds);

    const questionMap = new Map((questions ?? []).map((q) => [q.id, q]));
    const gradedScores: any[] = [];

    for (const answer of answers ?? []) {
      const question = questionMap.get(answer.question_id);
      if (!question) continue;

      let marksAwarded = 0;
      let gradedBy: "auto" | "admin" | "ai" = "auto";

      if (question.type === "MCQ") {
        marksAwarded = gradeMCQ(
          answer.answer_text,
          question.correct_answer,
          question.max_marks,
          exam.negative_marking,
          exam.negative_fraction ?? 0.25
        );
      } else if (question.type === "Subjective") {
        // Use keyword rubric if configured
        if (question.keywords && Array.isArray(question.keywords) && question.keywords.length > 0) {
          const result = gradeByKeywords(answer.answer_text, question.keywords, question.max_marks);
          marksAwarded = result.totalMarks;
          gradedBy = "auto";
        } else {
          // No rubric — leave for manual grading (0 for now)
          marksAwarded = 0;
          gradedBy = "admin";
        }
      }

      gradedScores.push({
        session_id,
        question_id: answer.question_id,
        marks_awarded: marksAwarded,
        graded_by: gradedBy,
      });
    }

    // Upsert all scores
    if (gradedScores.length > 0) {
      await supabase.from("scores").upsert(gradedScores, { onConflict: "session_id,question_id" });
    }

    const total = gradedScores.reduce((s, g) => s + g.marks_awarded, 0);

    return NextResponse.json({ grades: gradedScores, total });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Grading failed" }, { status: 500 });
  }
}

// AI grading trigger for a specific answer
export async function PUT(req: NextRequest) {
  try {
    const { session_id, question_id, model_answer } = await req.json();

    const supabase = createServiceClient();

    const [answerRes, questionRes] = await Promise.all([
      supabase.from("answers").select("answer_text").eq("session_id", session_id).eq("question_id", question_id).single(),
      supabase.from("questions").select("question, max_marks").eq("id", question_id).single(),
    ]);

    if (!answerRes.data || !questionRes.data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const result = await gradeWithAI(
      questionRes.data.question,
      model_answer,
      answerRes.data.answer_text ?? "",
      questionRes.data.max_marks
    );

    await supabase.from("scores").upsert({
      session_id,
      question_id,
      marks_awarded: result.score,
      graded_by: "ai",
      ai_feedback: result.feedback,
    }, { onConflict: "session_id,question_id" });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Admin manual grade override
export async function PATCH(req: NextRequest) {
  try {
    const { session_id, question_id, marks_awarded } = await req.json();

    if (!session_id || !question_id || marks_awarded === undefined) {
      return NextResponse.json({ error: "session_id, question_id, marks_awarded required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Verify question exists and get max marks for clamping
    const { data: question } = await supabase
      .from("questions")
      .select("max_marks")
      .eq("id", question_id)
      .single();

    if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });

    const clamped = Math.max(0, Math.min(Number(question.max_marks), Number(marks_awarded)));

    await supabase.from("scores").upsert({
      session_id,
      question_id,
      marks_awarded: clamped,
      graded_by: "admin",
      ai_feedback: null, // clear AI feedback when manually overridden
    }, { onConflict: "session_id,question_id" });

    return NextResponse.json({ marks_awarded: clamped, graded_by: "admin" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

