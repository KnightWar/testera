"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { 
  Users, Search, GraduationCap,
  FileText, Trash2, Upload, AlertCircle, RefreshCw, X, Download
} from "lucide-react";
import Link from "next/link";
import { parseStudentList, generateStudentTemplate } from "@/lib/excel";
import { generateAccessCode, getExamAccessCode, setExamAccessCode } from "@/lib/grading";

interface StudentWithExam {
  id: string;
  roll_no: string;
  name: string;
  exam_id: string;
  exams: {
    title: string;
  } | null;
}

export default function StudentsDirectoryPage() {
  const [students, setStudents] = useState<StudentWithExam[]>([]);
  const [exams, setExams] = useState<{ id: string; title: string }[]>([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Bulk Upload state
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [studentFile, setStudentFile] = useState<File | null>(null);
  const [studentErrors, setStudentErrors] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inline Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const supabase = createClient();

  async function loadData() {
    setLoading(true);
    const [studentsRes, examsRes] = await Promise.all([
      supabase
        .from("students")
        .select("id, roll_no, name, exam_id, exams(title)")
        .order("roll_no"),
      supabase
        .from("exams")
        .select("id, title")
        .order("title")
    ]);

    if (studentsRes.data) setStudents(studentsRes.data as any[]);
    if (examsRes.data) {
      setExams(examsRes.data);
      if (examsRes.data.length > 0) setSelectedExamId(examsRes.data[0].id);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      s.roll_no.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      (s.exams?.title ?? "").toLowerCase().includes(q)
    );
  });



  async function handleStudentUpload() {
    if (!studentFile || !selectedExamId) return;
    setUploading(true);
    setStudentErrors([]);
    try {
      const buffer = await studentFile.arrayBuffer();
      const { students: parsed, errors } = parseStudentList(buffer);
      setStudentErrors(errors);
      if (errors.length > 0) {
        setUploading(false);
        return;
      }

      // Fetch the exam's access code
      const { data: examData } = await supabase
        .from("exams")
        .select("description")
        .eq("id", selectedExamId)
        .single();

      let accessCode = getExamAccessCode(examData?.description);
      if (!accessCode) {
        accessCode = generateAccessCode();
        const newDesc = setExamAccessCode(examData?.description, accessCode);
        await supabase.from("exams").update({ description: newDesc }).eq("id", selectedExamId);
      }

      const toInsert = parsed.map((s) => ({
        exam_id: selectedExamId,
        roll_no: s.roll_no,
        name: s.name,
        access_code: accessCode,
      }));

      const { error } = await supabase.from("students").upsert(toInsert as any, { onConflict: "exam_id,roll_no" });
      if (error) {
        setStudentErrors([error.message]);
      } else {
        // reload student list
        const { data } = await supabase
          .from("students")
          .select("id, roll_no, name, exam_id, exams(title)")
          .order("roll_no");
        if (data) setStudents(data as any[]);
        setStudentFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setShowUploadPanel(false);
      }
    } catch (err: any) {
      setStudentErrors([err.message]);
    }
    setUploading(false);
  }

  function handleDownloadStudentTemplate() {
    const data = generateStudentTemplate();
    const blob = new Blob([data as any], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "student_template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete(studentId: string) {
    setDeleting(true);
    const { error } = await supabase.from("students").delete().eq("id", studentId);
    if (!error) {
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
    } else {
      alert("Failed to delete student: " + error.message);
    }
    setDeletingId(null);
    setDeleting(false);
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 fade-in text-[#F1F5F9]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(124,58,237,0.15)" }}>
              <Users size={22} style={{ color: "var(--accent-primary)" }} />
            </div>
            Students Directory
          </h1>
          <p className="mt-1" style={{ color: "var(--text-secondary)" }}>View, manage, and register examinees</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowUploadPanel(!showUploadPanel)} 
            className="btn btn-primary"
          >
            <Upload size={16} /> Bulk Roster Upload
          </button>
          <button 
            onClick={loadData} 
            className="btn btn-secondary btn-sm"
            title="Refresh student roster list"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Bulk Upload Panel (Inline layout, no overlays) */}
      {showUploadPanel && (
        <div className="glass-card p-6 border-l-4 border-l-purple-500 fade-in" style={{ background: "rgba(124,58,237,0.03)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Upload size={18} className="text-purple-400" />
              Upload Student Roster
            </h3>
            <button onClick={() => setShowUploadPanel(false)} className="text-slate-400 hover:text-white">
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
            <div className="form-group mb-0">
              <label className="form-label">1. Select Target Exam</label>
              <select 
                className="form-input bg-[#172037] text-white" 
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
              >
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>{exam.title}</option>
                ))}
              </select>
            </div>

            <div className="form-group mb-0">
              <label className="form-label flex justify-between items-center">
                <span>2. Select Excel File (.xlsx with Roll_No, Name columns)</span>
                <button
                  type="button"
                  onClick={handleDownloadStudentTemplate}
                  className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 font-semibold transition-colors"
                >
                  <Download size={13} />
                  Download Template
                </button>
              </label>
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".xlsx,.csv" 
                className="form-input bg-[#172037] text-sm text-slate-300"
                onChange={(e) => setStudentFile(e.target.files?.[0] ?? null)} 
              />
            </div>
          </div>

          {studentErrors.length > 0 && (
            <div className="mt-4 p-3 rounded-xl text-xs flex gap-2" style={{ background: "rgba(248,113,113,0.1)", color: "var(--danger)", border: "1px solid rgba(248,113,113,0.3)" }}>
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Parsing errors found:</span>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  {studentErrors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            </div>
          )}

          <div className="mt-5 flex gap-2 justify-end">
            <button onClick={() => setShowUploadPanel(false)} className="btn btn-secondary btn-sm">Cancel</button>
            <button 
              onClick={handleStudentUpload} 
              disabled={!studentFile || !selectedExamId || uploading} 
              className="btn btn-primary btn-sm"
            >
              {uploading ? "Uploading..." : "Start Import"}
            </button>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="glass-card p-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            className="form-input pl-10 bg-[#172037]"
            placeholder="Search by Roll No, Student Name, or Exam Title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Main Grid/Table Card */}
      <div className="glass-card overflow-hidden">
        <div className="p-5 border-b font-bold flex items-center justify-between" style={{ borderColor: "var(--border-subtle)", background: "rgba(255,255,255,0.01)" }}>
          <span className="text-sm font-semibold">Examinees List ({filteredStudents.length})</span>
          {students.length > 0 && searchQuery && (
            <span className="text-xs font-normal text-slate-500">Filtered from {students.length} total</span>
          )}
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border-subtle)", background: "rgba(255,255,255,0.02)" }}>
                {["Roll No", "Student Name", "Assigned Exam", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-16 text-center">
                    <span className="spinner mx-auto block mb-2" />
                    <span className="text-xs text-slate-500">Loading student directory...</span>
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-16 text-center text-slate-500">
                    <GraduationCap size={40} className="mx-auto mb-2 text-slate-600 animate-pulse" />
                    No students found. Try adjusting your search query, or upload a student roster above.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => (
                  <tr key={s.id} className="border-t hover:bg-white/[0.01] transition-colors" style={{ borderColor: "var(--border-subtle)" }}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-purple-300">{s.roll_no}</td>
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 max-w-xs truncate">
                      {s.exams ? (
                        <div className="flex items-center gap-1.5 text-slate-300 font-medium text-xs">
                          <FileText size={12} className="shrink-0 text-slate-500" />
                          <Link href={`/admin/exams/${s.exam_id}/config`} className="hover:underline hover:text-purple-300">
                            {s.exams.title}
                          </Link>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">Exam Deleted</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/admin/exams/${s.exam_id}/config`} className="btn btn-secondary btn-sm py-1 px-3 text-xs font-semibold">
                          Config Exam
                        </Link>
                        
                        {/* Inline Delete Button (no modal overlay dialog) */}
                        {deletingId === s.id ? (
                          <button
                            onClick={() => handleDelete(s.id)}
                            disabled={deleting}
                            className="btn btn-danger btn-sm py-1 px-3 text-xs font-bold animate-pulse"
                          >
                            Confirm?
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setDeletingId(s.id);
                              setTimeout(() => setDeletingId((curr) => curr === s.id ? null : curr), 3000);
                            }}
                            className="btn btn-danger btn-sm p-1 rounded-lg text-red-400 hover:bg-red-500/10 border border-red-500/20"
                            title="Delete Student"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
