import React, { useState } from 'react';
import {
  UserPlus,
  Search,
  Filter,
  FileSpreadsheet,
  Edit2,
  Trash2,
  QrCode,
  Download,
  AlertCircle,
  CheckCircle2,
  X,
  UploadCloud
} from 'lucide-react';
import { Student, SchoolClass, Section, School } from '../types';
import { supabaseService } from '../services/supabaseService';

interface StudentsViewProps {
  school: School;
  students: Student[];
  classes: SchoolClass[];
  sections: Section[];
  onStudentsUpdated: () => void;
  onNavigateToIDCards: (studentId: string) => void;
}

export const StudentsView: React.FC<StudentsViewProps> = ({
  school,
  students,
  classes,
  sections,
  onStudentsUpdated,
  onNavigateToIDCards
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('all');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    admissionNumber: '',
    rollNumber: '',
    classId: classes[0]?.id || '',
    sectionId: sections[0]?.id || '',
    parentName: '',
    parentPhone: '',
    photoUrl: '',
    status: 'active' as Student['status']
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // CSV Import State
  const [csvContent, setCsvContent] = useState('');
  const [csvResult, setCsvResult] = useState<{ count: number; errors: string[] } | null>(null);

  const availableSections = selectedClassId !== 'all'
    ? sections.filter(s => s.class_id === selectedClassId)
    : sections;

  const filteredStudents = students.filter(student => {
    const matchesSearch =
      student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.admission_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.roll_number.includes(searchQuery);
    const matchesClass = selectedClassId === 'all' || student.class_id === selectedClassId;
    const matchesSection = selectedSectionId === 'all' || student.section_id === selectedSectionId;
    return matchesSearch && matchesClass && matchesSection;
  });

  const handleOpenAddModal = () => {
    setEditingStudent(null);
    setFormData({
      fullName: '',
      admissionNumber: `AIA-${new Date().getFullYear()}-${String(students.length + 1).padStart(4, '0')}`,
      rollNumber: String(students.length + 1).padStart(2, '0'),
      classId: classes[0]?.id || '',
      sectionId: sections[0]?.id || '',
      parentName: '',
      parentPhone: '',
      photoUrl: '',
      status: 'active'
    });
    setFormError('');
    setShowAddModal(true);
  };

  const handleOpenEditModal = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      fullName: student.full_name,
      admissionNumber: student.admission_number,
      rollNumber: student.roll_number,
      classId: student.class_id,
      sectionId: student.section_id,
      parentName: student.parent_name || '',
      parentPhone: student.parent_phone || '',
      photoUrl: student.photo_url || '',
      status: student.status
    });
    setFormError('');
    setShowAddModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.admissionNumber.trim() || !formData.rollNumber.trim()) {
      setFormError('Please fill all required fields: Name, Admission Number, Roll Number.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      if (editingStudent) {
        const res = await supabaseService.updateStudent(editingStudent.id, {
          full_name: formData.fullName.trim(),
          admission_number: formData.admissionNumber.trim(),
          roll_number: formData.rollNumber.trim(),
          class_id: formData.classId,
          section_id: formData.sectionId,
          parent_name: formData.parentName.trim(),
          parent_phone: formData.parentPhone.trim(),
          photo_url: formData.photoUrl.trim(),
          status: formData.status
        });
        if (!res.success) {
          setFormError(res.message);
          return;
        }
      } else {
        const res = await supabaseService.addStudent({
          school_id: school.id,
          full_name: formData.fullName.trim(),
          admission_number: formData.admissionNumber.trim(),
          roll_number: formData.rollNumber.trim(),
          class_id: formData.classId,
          section_id: formData.sectionId,
          parent_name: formData.parentName.trim(),
          parent_phone: formData.parentPhone.trim(),
          photo_url: formData.photoUrl.trim(),
          status: formData.status,
          admission_date: new Date().toISOString().split('T')[0]
        });
        if (!res.success) {
          setFormError(res.message);
          return;
        }
      }

      setShowAddModal(false);
      onStudentsUpdated();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (student: Student) => {
    if (window.confirm(`Are you sure you want to remove "${student.full_name}" from the active student directory?`)) {
      await supabaseService.deleteStudent(student.id);
      onStudentsUpdated();
    }
  };

  // CSV Import Parser
  const handleCSVImport = async () => {
    if (!csvContent.trim()) return;
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
      setCsvResult({ count: 0, errors: ['CSV must have a header row and at least 1 student row.'] });
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const nameIdx = headers.findIndex(h => h.includes('name'));
    const admIdx = headers.findIndex(h => h.includes('admission') || h.includes('id'));
    const rollIdx = headers.findIndex(h => h.includes('roll'));
    const classIdx = headers.findIndex(h => h.includes('class'));
    const secIdx = headers.findIndex(h => h.includes('sec'));
    const parentIdx = headers.findIndex(h => h.includes('parent'));
    const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('contact'));

    if (nameIdx === -1 || admIdx === -1 || rollIdx === -1) {
      setCsvResult({
        count: 0,
        errors: ['CSV must contain headers for "Full Name", "Admission Number", and "Roll Number".']
      });
      return;
    }

    const parsedRows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      if (cols.length < 3 || !cols[nameIdx]) continue;
      parsedRows.push({
        fullName: cols[nameIdx] || '',
        admissionNumber: cols[admIdx] || '',
        rollNumber: cols[rollIdx] || '',
        className: classIdx !== -1 ? cols[classIdx] : 'Grade 10',
        sectionName: secIdx !== -1 ? cols[secIdx] : 'Section A',
        parentName: parentIdx !== -1 ? cols[parentIdx] : '',
        parentPhone: phoneIdx !== -1 ? cols[phoneIdx] : ''
      });
    }

    const res = await supabaseService.bulkImportStudents(school.id, parsedRows);
    setCsvResult({ count: res.importedCount, errors: res.errors });
    if (res.importedCount > 0) {
      onStudentsUpdated();
    }
  };

  const downloadSampleCSV = () => {
    const sample = `Full Name,Admission Number,Roll Number,Class,Section,Parent Name,Parent Phone
Lucas Bennett,AIA-2026-0201,10,Grade 10,Section A,Mark Bennett,+1 (555) 777-8888
Aria Gupta,AIA-2026-0202,11,Grade 10,Section B,Sunil Gupta,+1 (555) 999-0000
Elena Rostova,AIA-2026-0203,12,Grade 11,Section A,Irina Rostova,+1 (555) 333-2222`;
    const blob = new Blob([sample], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'edupulse_sample_students.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 space-y-6">
      {/* Title & Actions Bar */}
      <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <span>Student Directory</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
              {students.length} Students
            </span>
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Manage student registrations, security tokens, and class assignments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowCSVModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-lg border border-stone-200 transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg transition shadow-xs"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Student</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student by full name, admission number, or roll #..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedClassId}
            onChange={(e) => {
              setSelectedClassId(e.target.value);
              setSelectedSectionId('all');
            }}
            className="px-3 py-2 text-xs border border-stone-300 rounded-lg bg-stone-50 text-stone-800"
          >
            <option value="all">All Classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={selectedSectionId}
            onChange={(e) => setSelectedSectionId(e.target.value)}
            className="px-3 py-2 text-xs border border-stone-300 rounded-lg bg-stone-50 text-stone-800"
          >
            <option value="all">All Sections</option>
            {availableSections.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Students Data Table */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Admission ID</th>
                <th className="px-4 py-3">Class & Section</th>
                <th className="px-4 py-3">Roll No</th>
                <th className="px-4 py-3">Parent / Guardian</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredStudents.map(student => (
                <tr key={student.id} className="hover:bg-stone-50/70 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-stone-100 border border-stone-200 overflow-hidden shrink-0 flex items-center justify-center font-bold text-xs text-stone-500">
                        {student.photo_url ? (
                          <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          student.full_name.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <span className="font-bold text-stone-900">{student.full_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono font-medium text-stone-700">
                    {student.admission_number}
                  </td>
                  <td className="px-4 py-3 text-stone-700">
                    {student.class_name || 'Class'} ({student.section_name || 'A'})
                  </td>
                  <td className="px-4 py-3 font-mono font-medium text-stone-700">
                    #{student.roll_number}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {student.parent_name || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        student.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {student.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                    <button
                      onClick={() => onNavigateToIDCards(student.id)}
                      className="p-1.5 text-stone-600 hover:text-orange-600 hover:bg-orange-50 rounded-md transition"
                      title="View & Print ID Card"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenEditModal(student)}
                      className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-md transition"
                      title="Edit student"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(student)}
                      className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                      title="Remove student"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-stone-400 text-xs">
                    No students match the selected search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT STUDENT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-4 bg-stone-900 text-white flex items-center justify-between">
              <h3 className="text-base font-bold font-display">
                {editingStudent ? 'Edit Student Profile' : 'Register New Student'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-stone-400 hover:text-white p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold uppercase text-stone-600 tracking-wider">
                    Full Legal Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="e.g. Benjamin Arthur Vance"
                    className="w-full mt-1 px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-stone-600 tracking-wider">
                    Admission Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.admissionNumber}
                    onChange={(e) => setFormData({ ...formData, admissionNumber: e.target.value })}
                    placeholder="e.g. AIA-2026-0899"
                    className="w-full mt-1 px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-stone-600 tracking-wider">
                    Roll Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.rollNumber}
                    onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
                    placeholder="e.g. 24"
                    className="w-full mt-1 px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-stone-600 tracking-wider">
                    Class *
                  </label>
                  <select
                    value={formData.classId}
                    onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs border border-stone-300 rounded-lg bg-stone-50"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-stone-600 tracking-wider">
                    Section *
                  </label>
                  <select
                    value={formData.sectionId}
                    onChange={(e) => setFormData({ ...formData, sectionId: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs border border-stone-300 rounded-lg bg-stone-50"
                  >
                    {sections.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-stone-600 tracking-wider">
                    Parent / Guardian Name
                  </label>
                  <input
                    type="text"
                    value={formData.parentName}
                    onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                    placeholder="e.g. Eleanor Vance"
                    className="w-full mt-1 px-3 py-2 text-xs border border-stone-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-stone-600 tracking-wider">
                    Parent Phone
                  </label>
                  <input
                    type="text"
                    value={formData.parentPhone}
                    onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                    className="w-full mt-1 px-3 py-2 text-xs border border-stone-300 rounded-lg font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold uppercase text-stone-600 tracking-wider">
                    Photo URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={formData.photoUrl}
                    onChange={(e) => setFormData({ ...formData, photoUrl: e.target.value })}
                    placeholder="https://example.com/photo.jpg"
                    className="w-full mt-1 px-3 py-2 text-xs border border-stone-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition shadow-xs"
                >
                  {isSubmitting ? 'Saving...' : editingStudent ? 'Update Student' : 'Register Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK CSV IMPORT MODAL */}
      {showCSVModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-4 bg-stone-900 text-white flex items-center justify-between">
              <h3 className="text-base font-bold font-display flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <span>Bulk Student CSV Registration</span>
              </h3>
              <button
                onClick={() => {
                  setShowCSVModal(false);
                  setCsvResult(null);
                }}
                className="text-stone-400 hover:text-white p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between bg-stone-50 p-3 rounded-lg border border-stone-200">
                <div className="text-xs text-stone-600">
                  Import multiple students at once. Format: <code className="bg-stone-200 px-1 py-0.5 rounded text-[11px]">Full Name,Admission Number,Roll Number,Class,Section</code>
                </div>
                <button
                  onClick={downloadSampleCSV}
                  className="flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700 whitespace-nowrap ml-3"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Template</span>
                </button>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-stone-600 tracking-wider">
                  Paste CSV Content
                </label>
                <textarea
                  rows={6}
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  placeholder={`Full Name,Admission Number,Roll Number,Class,Section
Lucas Bennett,AIA-2026-0201,10,Grade 10,Section A
Aria Gupta,AIA-2026-0202,11,Grade 10,Section B`}
                  className="w-full mt-1 p-3 text-xs border border-stone-300 rounded-lg font-mono focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {csvResult && (
                <div className={`p-3 rounded-lg text-xs ${csvResult.count > 0 ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-rose-50 text-rose-900 border border-rose-200'}`}>
                  <p className="font-bold">
                    {csvResult.count > 0 ? `Successfully imported ${csvResult.count} students!` : 'No students imported.'}
                  </p>
                  {csvResult.errors.length > 0 && (
                    <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[11px]">
                      {csvResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100">
                <button
                  onClick={() => setShowCSVModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 rounded-lg transition"
                >
                  Close
                </button>
                <button
                  onClick={handleCSVImport}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition shadow-xs"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Execute Import</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
