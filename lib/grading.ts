import type { KeywordRubric } from "./database.types";

// ─────────────────────────────────────────────────────────────────────────────
// MCQ AUTO-GRADING (server-side, tamper-proof)
// ─────────────────────────────────────────────────────────────────────────────
export function gradeMCQ(
  submittedAnswer: string | null,
  correctAnswer: string | null,
  maxMarks: number,
  negativeMarking: boolean,
  negativeFraction: number
): number {
  if (!submittedAnswer || !correctAnswer) return 0;

  if (submittedAnswer.toUpperCase() === correctAnswer.toUpperCase()) {
    return maxMarks;
  }

  if (negativeMarking && submittedAnswer !== "") {
    return -(maxMarks * negativeFraction);
  }

  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBJECTIVE KEYWORD RUBRIC
// ─────────────────────────────────────────────────────────────────────────────
export interface KeywordGradeResult {
  totalMarks: number;
  maxMarks: number;
  matchedKeywords: string[];
  missedKeywords: string[];
}

export function gradeByKeywords(
  answerText: string | null,
  keywords: KeywordRubric[],
  maxMarks: number
): KeywordGradeResult {
  if (!answerText || !keywords || keywords.length === 0) {
    return { totalMarks: 0, maxMarks, matchedKeywords: [], missedKeywords: keywords?.map((k) => k.keyword) ?? [] };
  }

  let totalMarks = 0;
  const matchedKeywords: string[] = [];
  const missedKeywords: string[] = [];

  for (const { keyword, marks, case_sensitive } of keywords) {
    const haystack = case_sensitive ? answerText : answerText.toLowerCase();
    const needle = case_sensitive ? keyword : keyword.toLowerCase();

    if (haystack.includes(needle)) {
      totalMarks += marks;
      matchedKeywords.push(keyword);
    } else {
      missedKeywords.push(keyword);
    }
  }

  // Cap at max marks
  totalMarks = Math.min(totalMarks, maxMarks);

  return { totalMarks, maxMarks, matchedKeywords, missedKeywords };
}

// ─────────────────────────────────────────────────────────────────────────────
// AI-ASSISTED GRADING via Claude Haiku
// ─────────────────────────────────────────────────────────────────────────────
export interface AIGradeResult {
  score: number;
  feedback: string;
  confidence: "high" | "medium" | "low";
}

export async function gradeWithAI(
  question: string,
  modelAnswer: string,
  studentAnswer: string,
  maxMarks: number
): Promise<AIGradeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const prompt = `You are an impartial academic exam evaluator for the Department of SoCSE.

Question: ${question}

Model Answer / Marking Scheme: ${modelAnswer}

Student's Answer: ${studentAnswer}

Maximum Marks: ${maxMarks}

Evaluate the student's answer strictly based on accuracy, completeness, and relevance.
Respond ONLY in this JSON format (no other text):
{
  "score": <number between 0 and ${maxMarks}>,
  "feedback": "<concise feedback in 1-2 sentences>",
  "confidence": "<high|medium|low>"
}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text ?? "{}";

  try {
    const parsed = JSON.parse(text) as AIGradeResult;
    // Clamp score
    parsed.score = Math.max(0, Math.min(maxMarks, Number(parsed.score)));
    return parsed;
  } catch {
    throw new Error("Failed to parse AI response");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FISHER-YATES SHUFFLE (for question pool randomisation)
// ─────────────────────────────────────────────────────────────────────────────
export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function seededShuffle<T>(arr: T[], seed: string): T[] {
  const result = [...arr];
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  const random = () => {
    h = (Math.imul(1812433253, h) + 1) | 0;
    return (h >>> 0) / 4294967296;
  };
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function pickRandom<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCESS CODE GENERATOR
// ─────────────────────────────────────────────────────────────────────────────
export function generateAccessCode(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1 for clarity
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
