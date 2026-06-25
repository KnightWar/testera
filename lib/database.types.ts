export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      exams: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          duration_mins: number;
          start_at: string | null;
          end_at: string | null;
          shuffle_questions: boolean;
          show_score_immediately: boolean;
          negative_marking: boolean;
          negative_fraction: number;
          pool_size: number | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["exams"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["exams"]["Insert"]>;
      };
      questions: {
        Row: {
          id: string;
          exam_id: string;
          q_no: number;
          question: string;
          type: "MCQ" | "Subjective";
          option_a: string | null;
          option_b: string | null;
          option_c: string | null;
          option_d: string | null;
          correct_answer: string | null;
          max_marks: number;
          topic: string | null;
          shuffle_options: boolean;
          keywords: KeywordRubric[] | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["questions"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["questions"]["Insert"]>;
      };
      students: {
        Row: {
          id: string;
          exam_id: string;
          roll_no: string;
          name: string;
          access_code: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["students"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["students"]["Insert"]>;
      };
      sessions: {
        Row: {
          id: string;
          student_id: string;
          exam_id: string;
          question_order: string[] | null;
          started_at: string | null;
          submitted_at: string | null;
          last_seen_at: string | null;
          is_active: boolean;
          tab_switches: number;
          fullscreen_exits: number;
          devtools_attempts: number;
          grace_expires_at: string | null;
          webcam_consent: boolean | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["sessions"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["sessions"]["Insert"]>;
      };
      answers: {
        Row: {
          id: string;
          session_id: string;
          question_id: string;
          answer_text: string | null;
          is_flagged: boolean;
          auto_saved_at: string | null;
          submitted_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["answers"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["answers"]["Insert"]>;
      };
      scores: {
        Row: {
          id: string;
          session_id: string;
          question_id: string;
          marks_awarded: number;
          graded_by: "auto" | "admin" | "ai";
          ai_feedback: string | null;
          graded_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["scores"]["Row"], "id" | "graded_at">;
        Update: Partial<Database["public"]["Tables"]["scores"]["Insert"]>;
      };
      violation_logs: {
        Row: {
          id: string;
          session_id: string;
          type: ViolationType;
          metadata: Json | null;
          occurred_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["violation_logs"]["Row"], "id" | "occurred_at">;
        Update: Partial<Database["public"]["Tables"]["violation_logs"]["Insert"]>;
      };
      webcam_snapshots: {
        Row: {
          id: string;
          session_id: string;
          storage_path: string;
          captured_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["webcam_snapshots"]["Row"], "id" | "captured_at">;
        Update: Partial<Database["public"]["Tables"]["webcam_snapshots"]["Insert"]>;
      };
    };
  };
}

export interface KeywordRubric {
  keyword: string;
  marks: number;
  case_sensitive?: boolean;
}

export type ViolationType =
  | "tab_switch"
  | "fullscreen_exit"
  | "devtools_open"
  | "right_click"
  | "copy_paste"
  | "keyboard_shortcut"
  | "idle"
  | "webcam_missing";
