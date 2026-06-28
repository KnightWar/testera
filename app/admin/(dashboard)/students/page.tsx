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

function getInitialsColor(name: string) {
  const charCode = name.charCodeAt(0) || 0;
  const index = charCode % 4;
  if (index === 0) return { bg: "bg-indigo-50 border-indigo-100", text: "text-indigo-600" };
  if (index === 1) return { bg: "bg-teal-50 border-teal-100", text: "text-teal-600" };
  if (index === 2) return { bg: "bg-rose-50 border-rose-100", text: "text-rose-600" };
  return { bg: "bg-amber-50 border-amber-100", text: "text-amber-600" };
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[--border] pb-5">
        <div>
          <h1 className="text-xl font-bold text-[--text-primary] tracking-tight flex items-center gap-2">
            <Users size={20} className="text-[--accent]" />
            Master Student Directory
          </h1>
          <p className="text-sm text-[--text-secondary] mt-1">View, manage, and upload the master examinee roster</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUploadPanel(!showUploadPanel)}
            className="btn btn-primary btn-sm"
          >
            <Upload size={14} /> Bulk Roster Upload
          </button>
          <button
            onClick={loadData}
            className="btn btn-ghost btn-sm"
            title="Refresh student roster list"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Bulk Upload Panel */}
      {showUploadPanel && (
        <div className="card p-6 relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Upload size={18} className="text-[--accent-light]" />
              <h3 className="text-sm font-bold text-[--text-primary]">
                Upload Student Roster
              </h3>
            </div>
            <button onClick={() => setShowUploadPanel(false)} className="text-[--text-secondary] hover:text-[--text-primary] bg-transparent border-0 cursor-pointer">
              <X size={18} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-[--text-secondary]">Select Excel File (.xlsx with Roll_No, Name, and optional Group columns)</span>
                <button
                  type="button"
                  onClick={handleDownloadStudentTemplate}
                  className="text-xs text-[--accent-light] hover:underline flex items-center gap-1 font-semibold bg-transparent border-0 cursor-pointer"
                >
                  <Download size={13} />
                  Download Template
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv"
                className="w-full bg-[--bg-input] text-[--text-primary] placeholder:text-[--text-muted] border border-[--border] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[--border-accent]"
                onChange={(e) => setStudentFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          {studentErrors.length > 0 && (
            <div className="mt-4 p-3 rounded-md text-xs bg-[--red-bg] text-[--red] border border-red-500/20 flex gap-2">
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
            <button onClick={() => setShowUploadPanel(false)} className="btn btn-ghost btn-sm">Cancel</button>
            <button
              onClick={handleStudentUpload}
              disabled={!studentFile || uploading}
              className="btn btn-primary btn-sm"
            >
              {uploading ? "Uploading..." : "Start Import"}
            </button>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[--text-muted]" size={16} />
        <input
          type="text"
          className="search-input w-full"
          placeholder="Search by Roll No, Student Name, or Group..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Floating Bulk Actions Panel */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-3 bg-[--bg-elevated]/95 backdrop-blur-md border border-[--border-accent] rounded-md shadow-lg fade-in">
          <span className="text-xs font-semibold text-[--text-secondary] whitespace-nowrap">
            Selected <strong className="text-[--text-primary]">{selectedIds.length}</strong> students
          </span>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="Group Name"
              className="h-8 bg-[--bg-input] border border-[--border] rounded-md text-xs text-[--text-primary] px-2.5 focus:outline-none focus:border-[--border-accent] w-28"
              value={bulkGroupName}
              onChange={(e) => setBulkGroupName(e.target.value)}
            />
            <button
              onClick={handleBulkAssignGroup}
              disabled={!bulkGroupName.trim() || bulkProcessing}
              className="btn btn-primary btn-sm h-8"
            >
              Assign Group
            </button>
          </div>
          <button
            onClick={handleBulkRemoveGroup}
            disabled={bulkProcessing}
            className="btn btn-ghost btn-sm h-8"
          >
            Remove Group
          </button>
          <div className="w-px h-4 bg-[--border]" />
          <button
            onClick={handleBulkDelete}
            disabled={bulkProcessing}
            className="btn btn-danger btn-sm h-8"
          >
            Delete Selected
          </button>
        </div>
      )}

      {/* Main Grid/Table Card */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-[--border] flex items-center justify-between">
          <span className="text-sm font-bold text-[--text-primary]">Master Students List ({filteredStudents.length})</span>
          {students.length > 0 && searchQuery && (
            <span className="text-xs text-[--text-secondary]">Filtered from {students.length} total</span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[--bg-surface] border-b border-[--border]">
                <th className="w-12 px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-[--border] cursor-pointer"
                    style={{ accentColor: "var(--accent)" }}
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
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.7px]">Roll No</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.7px]">Student Name</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.7px]">Group</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.7px] pr-8">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[--border]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center">
                    <span className="spinner mx-auto block mb-2" />
                    <span className="text-xs text-[--text-secondary]">Loading student directory...</span>
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-[--text-secondary]">
                    <GraduationCap size={40} className="mx-auto mb-2 text-[--text-muted] animate-pulse" />
                    No students found. Try adjusting your search query, or upload a student roster above.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s, index) => {
                  const colorPair = getInitialsColor(s.name);
                  return (
                    <tr key={s.id} className={`${index % 2 === 0 ? 'bg-[--bg-surface]' : ''} transition-colors duration-100 group border-b border-[--border]`}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-[--border] cursor-pointer"
                          style={{ accentColor: "var(--accent)" }}
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
                      <td className="px-4 py-3">
                        <span className="roll-chip">{s.roll_no}</span>
                      </td>
                      <td className="px-4 py-3 text-[13.5px]">
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-full border flex items-center justify-center shrink-0 ${colorPair.bg}`}>
                            <span className={`text-[11px] font-bold ${colorPair.text}`}>
                              {s.name[0]?.toUpperCase() ?? "S"}
                            </span>
                          </div>
                          <span className="font-semibold text-[--text-primary]">{s.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[13.5px]">
                        {editingId === s.id ? (
                          <div className="flex gap-2 items-center">
                            <input
                              type="text"
                              className="bg-[--bg-input] border border-[--border] rounded-md text-xs text-[--text-primary] px-2 h-7 focus:outline-none focus:border-[--border-accent] w-[160px]"
                              value={editingGroup}
                              onChange={(e) => setEditingGroup(e.target.value)}
                            />
                            <button
                              onClick={() => handleSaveInlineEdit(s)}
                              className="inline-flex items-center justify-center w-7 h-7 bg-transparent hover:bg-[--bg-hover] text-[--green] border border-[--border] rounded-md cursor-pointer"
                              title="Save"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="inline-flex items-center justify-center w-7 h-7 bg-transparent hover:bg-[--bg-hover] text-[--red] border border-[--border] rounded-md cursor-pointer"
                              title="Cancel"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7C3AED]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED]" /> {s.group_name}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right pr-8">
                      <div className="actions-cell flex items-center justify-end gap-2">
                        {editingId !== s.id && (
                          <button
                            onClick={() => {
                              setEditingId(s.id);
                              setEditingGroup(s.group_name);
                            }}
                            className="inline-flex items-center justify-center w-7 h-7 bg-transparent hover:bg-[--bg-hover] text-[--text-secondary] hover:text-[--text-primary] border border-[--border] rounded-md cursor-pointer transition-colors duration-100"
                            title="Edit Group"
                          >
                            <Pencil size={12} />
                          </button>
                        )}
                        {/* Inline Delete Button */}
                        {deletingId === s.id ? (
                          <button
                            onClick={() => handleDelete(s.id)}
                            disabled={deleting}
                            className="inline-flex items-center justify-center px-3 h-7 bg-[--red-bg] text-[--red] font-semibold text-xs rounded-md border border-red-500/20 animate-pulse cursor-pointer"
                          >
                            Confirm?
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setDeletingId(s.id);
                              setTimeout(() => setDeletingId((curr) => curr === s.id ? null : curr), 3000);
                            }}
                            className="inline-flex items-center justify-center w-7 h-7 bg-transparent hover:bg-[--red-bg] text-[--text-secondary] hover:text-[--red] border border-[--border] rounded-md cursor-pointer transition-colors duration-100"
                            title="Delete Student"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
