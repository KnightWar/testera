import * as XLSX from "xlsx";
import type { KeywordRubric } from "./database.types";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
export interface ParsedQuestion {
  q_no: number;
  question: string;
  type: "MCQ" | "Subjective";
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  correct_answer?: "A" | "B" | "C" | "D";
  max_marks: number;
  topic?: string;
  shuffle_options: boolean;
}

export interface ParseResult {
  success: boolean;
  questions: ParsedQuestion[];
  errors: { row: number; field: string; message: string }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSER
// ─────────────────────────────────────────────────────────────────────────────
export function parseExcelQuestions(buffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  const questions: ParsedQuestion[] = [];
  const errors: ParseResult["errors"] = [];
  const seenQNos = new Set<number>();

  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // 1-indexed + header row

    const rawQNo = row["Q_No"];
    const q_no = Number(rawQNo);
    const question = String(row["Question"] ?? "").trim();
    const rawType = String(row["Type"] ?? "").trim().toUpperCase();
    const type = rawType === "MCQ" ? "MCQ" : rawType === "SUBJECTIVE" ? "Subjective" : null;
    const option_a = String(row["Option_A"] ?? "").trim() || undefined;
    const option_b = String(row["Option_B"] ?? "").trim() || undefined;
    const option_c = String(row["Option_C"] ?? "").trim() || undefined;
    const option_d = String(row["Option_D"] ?? "").trim() || undefined;
    const correct_answer = String(row["Correct_Answer"] ?? "").trim().toUpperCase() as "A" | "B" | "C" | "D" | "";
    const max_marks = Number(row["Max_Marks"] ?? 1) || 1;
    const topic = String(row["Topic"] ?? "").trim() || undefined;
    const shuffle_options = String(row["Shuffle_Options"] ?? "").trim().toUpperCase() === "YES";

    // Validate
    if (isNaN(q_no) || q_no <= 0) {
      errors.push({ row: rowNum, field: "Q_No", message: "Must be a positive number" });
    }
    if (seenQNos.has(q_no)) {
      errors.push({ row: rowNum, field: "Q_No", message: `Duplicate Q_No: ${q_no}` });
    }
    seenQNos.add(q_no);

    if (!question) {
      errors.push({ row: rowNum, field: "Question", message: "Question text is required" });
    }
    if (!type) {
      errors.push({ row: rowNum, field: "Type", message: 'Must be "MCQ" or "Subjective"' });
    }
    if (type === "MCQ") {
      if (!option_a || !option_b) {
        errors.push({ row: rowNum, field: "Option_A/B", message: "MCQ requires at least Option A and B" });
      }
      if (!["A", "B", "C", "D"].includes(correct_answer)) {
        errors.push({ row: rowNum, field: "Correct_Answer", message: "Must be A, B, C, or D for MCQ" });
      }
    }

    questions.push({
      q_no,
      question,
      type: type ?? "Subjective",
      option_a,
      option_b,
      option_c,
      option_d,
      correct_answer: correct_answer as "A" | "B" | "C" | "D" | undefined,
      max_marks,
      topic,
      shuffle_options,
    });
  });

  return {
    success: errors.length === 0,
    questions,
    errors,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE GENERATOR — download a pre-styled blank .xlsx
// ─────────────────────────────────────────────────────────────────────────────
export function generateQuestionTemplate(): Uint8Array {
  const wb = XLSX.utils.book_new();

  const headers = [
    "Q_No", "Question", "Type", "Option_A", "Option_B",
    "Option_C", "Option_D", "Correct_Answer", "Max_Marks", "Topic", "Shuffle_Options"
  ];

  const sampleRows = [
    [1, "What does CPU stand for?", "MCQ", "Central Processing Unit", "Core Processing Utility", "Computer Power Unit", "Central Power Unit", "A", 2, "Hardware", "NO"],
    [2, "Explain the concept of the CIA triad in cybersecurity.", "Subjective", "", "", "", "", "", 5, "Security", "NO"],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);

  // Column widths
  ws["!cols"] = [
    { wch: 8 }, { wch: 50 }, { wch: 12 }, { wch: 25 }, { wch: 25 },
    { wch: 25 }, { wch: 25 }, { wch: 16 }, { wch: 10 }, { wch: 15 }, { wch: 15 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Questions");

  // Instructions sheet
  const instrData = [
    ["TESTERA — Question Upload Template"],
    ["Department of SoCSE"],
    [""],
    ["Column", "Description", "Required"],
    ["Q_No", "Sequential question number (must be unique)", "Yes"],
    ["Question", "The full question text", "Yes"],
    ["Type", "MCQ or Subjective (case-insensitive)", "Yes"],
    ["Option_A", "First answer choice (MCQ only)", "MCQ only"],
    ["Option_B", "Second answer choice (MCQ only)", "MCQ only"],
    ["Option_C", "Third answer choice (MCQ only, optional)", "Optional"],
    ["Option_D", "Fourth answer choice (MCQ only, optional)", "Optional"],
    ["Correct_Answer", "A, B, C, or D — the correct option (MCQ only)", "MCQ only"],
    ["Max_Marks", "Points awarded for a correct answer", "Yes"],
    ["Topic", "Category/chapter for grouping and analytics", "Optional"],
    ["Shuffle_Options", "YES to randomise A–D per student, NO to keep order", "Optional"],
  ];

  const instrSheet = XLSX.utils.aoa_to_sheet(instrData);
  instrSheet["!cols"] = [{ wch: 20 }, { wch: 55 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, instrSheet, "Instructions");

  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT LIST PARSER
// ─────────────────────────────────────────────────────────────────────────────
export interface ParsedStudent {
  roll_no: string;
  name: string;
}

export function parseStudentList(buffer: ArrayBuffer): {
  students: ParsedStudent[];
  errors: string[];
} {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  const students: ParsedStudent[] = [];
  const errors: string[] = [];
  const seenRolls = new Set<string>();

  rows.forEach((row, idx) => {
    const roll_no = String(row["Roll_No"] ?? row["roll_no"] ?? "").trim();
    const name = String(row["Name"] ?? row["name"] ?? "").trim();

    if (!roll_no) { errors.push(`Row ${idx + 2}: Roll_No is required`); return; }
    if (!name) { errors.push(`Row ${idx + 2}: Name is required`); return; }
    if (seenRolls.has(roll_no)) { errors.push(`Row ${idx + 2}: Duplicate Roll_No ${roll_no}`); return; }

    seenRolls.add(roll_no);
    students.push({ roll_no, name });
  });

  return { students, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT HELPERS
// ─────────────────────────────────────────────────────────────────────────────
export function exportToExcel(
  data: Record<string, unknown>[],
  sheetName: string,
  fileName: string
): Uint8Array {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}
