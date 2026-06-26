"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { 
  Users, Search, GraduationCap,
  Trash2, Upload, AlertCircle, RefreshCw, X, Download,
  Pencil, Check
} from "lucide-react";
import { parseStudentList, generateStudentTemplate } from "@/lib/excel";

interface MasterStudent {
  id: string;
  roll_no: string;
  name: string;
  group_name: string;
}

export default function StudentsDirectoryPage() {
  const [students, setStudents] = useState<MasterStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Bulk Upload state
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [studentFile, setStudentFile] = useState<File | null>(null);
  const [studentErrors, setStudentErrors] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Checkbox selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<string>("");

  // Inline Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const supabase = createClient();

  async function loadData() {
    setLoading(true);
    const { data, error } = await supabase
      .from("master_students")
      .select("id, roll_no, name, group_name")
      .order("roll_no");

    if (data) setStudents(data as any[]);
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
      s.group_name.toLowerCase().includes(q)
    );
  });

  async function handleStudentUpload() {
    if (!studentFile) return;
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

      const toInsert = parsed.map((s) => ({
        roll_no: s.roll_no,
        name: s.name,
        group_name: s.group_name || "General",
      }));

      const { error } = await supabase.from("master_students").upsert(toInsert, { onConflict: "roll_no" });
      if (error) {
        setStudentErrors([error.message]);
      } else {
        // Reflect additions to assigned exams
        await syncMasterStudentsWithExams(toInsert);
        // reload student list
        const { data } = await supabase
          .from("master_students")
          .select("id, roll_no, name, group_name")
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
    const student = students.find((s) => s.id === studentId);
    if (!student) return;
    setDeleting(true);
    const { error } = await supabase.from("master_students").delete().eq("id", studentId);
    if (!error) {
      await supabase.from("students").delete().eq("roll_no", student.roll_no);
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
      setSelectedIds((prev) => prev.filter((id) => id !== studentId));
    } else {
      alert("Failed to delete student: " + error.message);
    }
    setDeletingId(null);
    setDeleting(false);
  }

  async function syncMasterStudentsWithExams(targetStudents: { roll_no: string; name: string; group_name: string }[]) {
    const { data: activeAssignments } = await supabase.from("students").select("exam_id, group_name");
    const groupExamMap: Record<string, string[]> = {};
    activeAssignments?.forEach((as) => {
      if (as.group_name) {
        if (!groupExamMap[as.group_name]) groupExamMap[as.group_name] = [];
        if (!groupExamMap[as.group_name].includes(as.exam_id)) {
          groupExamMap[as.group_name].push(as.exam_id);
        }
      }
    });

    const { data: examsData } = await supabase.from("exams").select("id, description");
    const examCodes: Record<string, string> = {};
    examsData?.forEach((ex) => {
      const match = ex.description ? ex.description.match(/^\[ACCESS_CODE:([A-Z0-9]+)\]/) : null;
      examCodes[ex.id] = match ? match[1] : "ACCESS";
    });

    const toInsert: any[] = [];
    targetStudents.forEach((s) => {
      const g = s.group_name || "General";
      if (groupExamMap[g]) {
        groupExamMap[g].forEach((examId) => {
          toInsert.push({
            exam_id: examId,
            roll_no: s.roll_no,
            name: s.name,
            group_name: g,
            access_code: examCodes[examId] || "ACCESS",
          });
        });
      }
    });

    if (toInsert.length > 0) {
      await supabase.from("students").upsert(toInsert, { onConflict: "exam_id,roll_no" });
    }
  }

  // Bulk Actions
  const [bulkGroupName, setBulkGroupName] = useState("");
  const [bulkProcessing, setBulkProcessing] = useState(false);

  async function handleBulkAssignGroup() {
    if (!bulkGroupName.trim()) return;
    setBulkProcessing(true);
    
    const selectedStudents = students.filter(s => selectedIds.includes(s.id));
    
    const { error } = await supabase
      .from("master_students")
      .update({ group_name: bulkGroupName.trim() })
      .in("id", selectedIds);
      
    if (error) {
      alert("Bulk assign failed: " + error.message);
    } else {
      const rollNos = selectedStudents.map(s => s.roll_no);
      await supabase.from("students").delete().in("roll_no", rollNos);
      
      const updatedStudents = selectedStudents.map(s => ({
        roll_no: s.roll_no,
        name: s.name,
        group_name: bulkGroupName.trim()
      }));
      await syncMasterStudentsWithExams(updatedStudents);
      
      setSelectedIds([]);
      setBulkGroupName("");
      await loadData();
      alert(`Assigned ${selectedStudents.length} students to group "${bulkGroupName.trim()}" successfully.`);
    }
    setBulkProcessing(false);
  }

  async function handleBulkRemoveGroup() {
    setBulkProcessing(true);
    
    const selectedStudents = students.filter(s => selectedIds.includes(s.id));
    const rollNos = selectedStudents.map(s => s.roll_no);
    
    const { error } = await supabase
      .from("master_students")
      .update({ group_name: "General" })
      .in("id", selectedIds);
      
    if (error) {
      alert("Bulk remove failed: " + error.message);
    } else {
      await supabase.from("students").delete().in("roll_no", rollNos);
      setSelectedIds([]);
      await loadData();
      alert(`Removed ${selectedStudents.length} students from their group.`);
    }
    setBulkProcessing(false);
  }

  async function handleBulkDelete() {
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} selected students? This will delete them from the roster and all exams.`)) {
      return;
    }
    setBulkProcessing(true);
    
    const selectedStudents = students.filter(s => selectedIds.includes(s.id));
    const rollNos = selectedStudents.map(s => s.roll_no);
    
    const { error } = await supabase.from("master_students").delete().in("id", selectedIds);
    if (error) {
      alert("Bulk delete failed: " + error.message);
    } else {
      await supabase.from("students").delete().in("roll_no", rollNos);
      setSelectedIds([]);
      await loadData();
      alert("Deleted successfully.");
    }
    setBulkProcessing(false);
  }

  async function handleSaveInlineEdit(student: MasterStudent) {
    if (!editingGroup.trim()) return;
    setLoading(true);
    
    const { error } = await supabase
      .from("master_students")
      .update({ group_name: editingGroup.trim() })
      .eq("id", student.id);
      
    if (error) {
      alert("Edit failed: " + error.message);
    } else {
      await supabase.from("students").delete().eq("roll_no", student.roll_no);
      await syncMasterStudentsWithExams([{
        roll_no: student.roll_no,
        name: student.name,
        group_name: editingGroup.trim()
      }]);
      setEditingId(null);
      await loadData();
    }
    setLoading(false);
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 fade-in text-[var(--color-text-primary)]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--color-accent-subtle)" }}>
              <Users size={22} style={{ color: "var(--color-accent)" }} />
            </div>
            Master Student Directory
          </h1>
          <p className="mt-1 text-secondary">View, manage, and upload the master examinee roster</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowUploadPanel(!showUploadPanel)} 
            className="btn btn--primary"
          >
            <Upload size={16} /> Bulk Roster Upload
          </button>
          <button 
            onClick={loadData} 
            className="btn btn--secondary btn--sm"
            title="Refresh student roster list"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Bulk Upload Panel (Inline layout, no overlays) */}
      {showUploadPanel && (
        <div className="card card--elevated p-6 border-l-4 fade-in" style={{ borderLeftColor: "var(--color-accent-secondary)", background: "var(--color-accent-subtle)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--color-accent-light)" }}>
              <Upload size={18} />
              Upload Student Roster
            </h3>
            <button onClick={() => setShowUploadPanel(false)} className="text-secondary hover:text-primary">
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 items-end">
            <div className="form-group mb-0">
              <label className="form-label flex justify-between items-center">
                <span>Select Excel File (.xlsx with Roll_No, Name, and optional Group columns)</span>
                <button
                  type="button"
                  onClick={handleDownloadStudentTemplate}
                  className="text-xs flex items-center gap-1 font-semibold transition-colors"
                  style={{ color: "var(--color-accent)" }}
                >
                  <Download size={13} />
                  Download Template
                </button>
              </label>
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".xlsx,.csv" 
                className="form-input text-sm"
                style={{ background: "var(--color-bg-input)", color: "var(--color-text-primary)" }}
                onChange={(e) => setStudentFile(e.target.files?.[0] ?? null)} 
              />
            </div>
          </div>

          {studentErrors.length > 0 && (
            <div className="mt-4 p-3 rounded-xl text-xs flex gap-2" style={{ background: "var(--color-danger-subtle)", color: "var(--color-danger)", border: "1px solid rgba(248,113,113,0.3)" }}>
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
            <button onClick={() => setShowUploadPanel(false)} className="btn btn--secondary btn--sm">Cancel</button>
            <button 
              onClick={handleStudentUpload} 
              disabled={!studentFile || uploading} 
              className="btn btn--primary btn--sm"
            >
              {uploading ? "Uploading..." : "Start Import"}
            </button>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="card card--elevated p-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            className="form-input pl-10"
            style={{ background: "var(--color-bg-input)" }}
            placeholder="Search by Roll No, Student Name, or Group..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Bulk Actions Panel */}
      {selectedIds.length > 0 && (
        <div className="card card--elevated p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 fade-in" style={{ borderLeftColor: "var(--color-accent)", background: "var(--color-accent-subtle)" }}>
          <div className="text-sm font-semibold">
            Selected <span style={{ color: "var(--color-accent-light)" }}>{selectedIds.length}</span> students
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-2 items-center">
              <input
                type="text"
                placeholder="New group name..."
                className="form-input text-xs py-1.5 px-3 max-w-[150px]"
                style={{ background: "var(--color-bg-input)", border: "1px solid var(--color-border-subtle)" }}
                value={bulkGroupName}
                onChange={(e) => setBulkGroupName(e.target.value)}
              />
              <button
                onClick={handleBulkAssignGroup}
                disabled={!bulkGroupName.trim() || bulkProcessing}
                className="btn btn--primary btn--sm py-1.5 px-3 text-xs"
              >
                Assign Group
              </button>
            </div>
            <button
              onClick={handleBulkRemoveGroup}
              disabled={bulkProcessing}
              className="btn btn--secondary btn--sm py-1.5 px-3 text-xs"
            >
              Remove Group
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkProcessing}
              className="btn btn--danger btn--sm py-1.5 px-3 text-xs"
            >
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Main Grid/Table Card */}
      <div className="card card--elevated overflow-hidden">
        <div className="p-5 border-b font-bold flex items-center justify-between" style={{ borderColor: "var(--color-border-subtle)", background: "var(--color-bg-surface)" }}>
          <span className="text-sm font-semibold">Master Students List ({filteredStudents.length})</span>
          {students.length > 0 && searchQuery && (
            <span className="text-xs font-normal text-slate-500">Filtered from {students.length} total</span>
          )}
        </div>
        
        <div className="overflow-x-auto">
          <table className="student-table w-full text-sm text-left">
            <thead>
              <tr>
                <th className="w-10">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                    style={{ accentColor: "var(--color-accent)" }}
                    checked={filteredStudents.length > 0 && selectedIds.length === filteredStudents.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(filteredStudents.map(s => s.id));
                      } else {
                        setSelectedIds([]);
                      }
                    }}
                  />
                </th>
                {["Roll No", "Student Name", "Group", "Actions"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <span className="spinner mx-auto block mb-2" />
                    <span className="text-xs text-slate-500">Loading student directory...</span>
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center text-slate-500">
                    <GraduationCap size={40} className="mx-auto mb-2 text-slate-600 animate-pulse" />
                    No students found. Try adjusting your search query, or upload a student roster above.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                        style={{ accentColor: "var(--color-accent)" }}
                        checked={selectedIds.includes(s.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(prev => [...prev, s.id]);
                          } else {
                            setSelectedIds(prev => prev.filter(id => id !== s.id));
                          }
                        }}
                      />
                    </td>
                    <td>
                      <div className="font-mono text-[13px]">{s.roll_no}</div>
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="student-table__avatar">{s.name.charAt(0)}</div>
                        <div className="student-table__name">{s.name}</div>
                      </div>
                    </td>
                    <td>
                      {editingId === s.id ? (
                        <div className="flex gap-2 items-center">
                          <input
                            type="text"
                            className="form-input text-xs py-1 px-2 max-w-[120px]"
                            style={{ background: "var(--color-bg-input)", border: "1px solid var(--color-border-subtle)" }}
                            value={editingGroup}
                            onChange={(e) => setEditingGroup(e.target.value)}
                          />
                          <button
                            onClick={() => handleSaveInlineEdit(s)}
                            className="btn btn--secondary btn--sm p-1 text-green-400 cursor-pointer"
                            title="Save"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="btn btn--secondary btn--sm p-1 text-red-400 cursor-pointer"
                            title="Cancel"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <span className="chip chip--purple">
                          {s.group_name}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {editingId !== s.id && (
                          <button
                            onClick={() => {
                              setEditingId(s.id);
                              setEditingGroup(s.group_name);
                            }}
                            className="btn btn--secondary btn--sm p-1 rounded-lg text-purple-300 cursor-pointer"
                            title="Edit Group"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {/* Inline Delete Button */}
                        {deletingId === s.id ? (
                          <button
                            onClick={() => handleDelete(s.id)}
                            disabled={deleting}
                            className="btn btn--danger btn--sm py-1 px-3 text-xs font-bold animate-pulse cursor-pointer"
                          >
                            Confirm?
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setDeletingId(s.id);
                              setTimeout(() => setDeletingId((curr) => curr === s.id ? null : curr), 3000);
                            }}
                            className="btn btn--danger btn--sm p-1 rounded-lg cursor-pointer"
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
