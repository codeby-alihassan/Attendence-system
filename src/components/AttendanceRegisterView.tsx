import React, { useState } from 'react';
import {
  Calendar,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Edit3,
  ShieldCheck,
  Check,
  X,
  History
} from 'lucide-react';
import { Student, SchoolClass, Section, Attendance, AttendanceStatus, School, UserProfile } from '../types';
import { supabaseService } from '../services/supabaseService';

interface AttendanceRegisterViewProps {
  school: School;
  students: Student[];
  classes: SchoolClass[];
  sections: Section[];
  attendance: Attendance[];
  currentUser: UserProfile;
  onAttendanceUpdated: () => void;
  onNavigateToAuditLogs: () => void;
}

export const AttendanceRegisterView: React.FC<AttendanceRegisterViewProps> = ({
  school,
  students,
  classes,
  sections,
  attendance,
  currentUser,
  onAttendanceUpdated,
  onNavigateToAuditLogs
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  
  // Correction modal
  const [correctionTarget, setCorrectionTarget] = useState<{
    student: Student;
    attendanceRecord?: Attendance;
  } | null>(null);
  const [newStatus, setNewStatus] = useState<AttendanceStatus>('present');
  const [correctionReason, setCorrectionReason] = useState('');
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Cutoff routine execution
  const [isProcessingCutoff, setIsProcessingCutoff] = useState(false);
  const [cutoffSuccessMessage, setCutoffSuccessMessage] = useState('');

  // Filter students
  const filteredStudents = students.filter(s => {
    const classMatch = selectedClassId === 'all' || s.class_id === selectedClassId;
    return classMatch && s.status === 'active';
  });

  const getRecordForStudent = (studentId: string): Attendance | undefined => {
    return attendance.find(
      a => a.student_id === studentId && a.attendance_date === selectedDate
    );
  };

  const handleOpenCorrection = (student: Student, record?: Attendance) => {
    setCorrectionTarget({ student, attendanceRecord: record });
    setNewStatus(record ? record.status : 'present');
    setCorrectionReason('');
    setErrorMessage('');
  };

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionTarget) return;
    if (!correctionReason.trim()) {
      setErrorMessage('Please state an official reason for manual attendance correction.');
      return;
    }

    setIsSubmittingCorrection(true);
    setErrorMessage('');

    try {
      if (correctionTarget.attendanceRecord) {
        // Edit existing record
        const res = await supabaseService.manualCorrectAttendance(
          correctionTarget.attendanceRecord.id,
          newStatus,
          correctionReason.trim(),
          currentUser
        );
        if (!res.success) {
          setErrorMessage(res.message);
          return;
        }
      } else {
        // Create manual attendance
        const res = await supabaseService.markStudentDirect(
          correctionTarget.student.id,
          school.id,
          selectedDate,
          newStatus,
          correctionReason.trim(),
          currentUser
        );
        if (!res.success) {
          setErrorMessage(res.message);
          return;
        }
      }

      setCorrectionTarget(null);
      onAttendanceUpdated();
    } finally {
      setIsSubmittingCorrection(false);
    }
  };

  const handleTriggerCutoff = async () => {
    if (isProcessingCutoff) return;
    setIsProcessingCutoff(true);
    setCutoffSuccessMessage('');

    try {
      const res = await supabaseService.markDailyAbsentStudents(school.id, selectedDate);
      setCutoffSuccessMessage(res.message);
      onAttendanceUpdated();
      setTimeout(() => setCutoffSuccessMessage(''), 4000);
    } finally {
      setIsProcessingCutoff(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <span>Daily Attendance Register</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
              Audit Guarded
            </span>
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Verify QR scans, perform manual adjustments with mandatory audit trail reasons.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onNavigateToAuditLogs}
            className="flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-lg border border-stone-200 transition"
          >
            <History className="w-4 h-4 text-stone-600" />
            <span>Audit Trail</span>
          </button>

          <button
            onClick={handleTriggerCutoff}
            disabled={isProcessingCutoff}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg transition shadow-xs"
            title="Mark any remaining unscanned student as absent"
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>{isProcessingCutoff ? 'Marking Absent...' : 'Execute Cutoff Absent'}</span>
          </button>
        </div>
      </div>

      {cutoffSuccessMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{cutoffSuccessMessage}</span>
        </div>
      )}

      {/* Date & Class Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Date Picker */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-stone-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 text-xs border border-stone-300 rounded-lg bg-stone-50 text-stone-800 font-mono font-medium"
            />
          </div>

          {/* Class Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-stone-400" />
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-3 py-1.5 text-xs border border-stone-300 rounded-lg bg-stone-50 text-stone-800"
            >
              <option value="all">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs text-stone-500 font-medium">
          Showing <strong>{filteredStudents.length}</strong> active students
        </div>
      </div>

      {/* Attendance Register Table */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Admission ID</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Roll</th>
                <th className="px-4 py-3">Attendance Status</th>
                <th className="px-4 py-3">Checked In At</th>
                <th className="px-4 py-3">Scan Method</th>
                <th className="px-4 py-3 text-right">Adjustment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredStudents.map(student => {
                const record = getRecordForStudent(student.id);
                const status: AttendanceStatus = record ? record.status : 'absent';
                const hasScanned = Boolean(record);

                return (
                  <tr key={student.id} className="hover:bg-stone-50/70 transition">
                    <td className="px-4 py-3 font-bold text-stone-900">
                      {student.full_name}
                    </td>
                    <td className="px-4 py-3 font-mono text-stone-700">
                      {student.admission_number}
                    </td>
                    <td className="px-4 py-3 text-stone-700">
                      {student.class_name} ({student.section_name})
                    </td>
                    <td className="px-4 py-3 font-mono font-medium text-stone-700">
                      #{student.roll_number}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full inline-block ${
                          status === 'present'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : status === 'late'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : status === 'excused'
                            ? 'bg-blue-50 text-blue-800 border border-blue-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-stone-600">
                      {record ? new Date(record.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-stone-500">
                      {record ? (
                        record.scan_method === 'qr_camera' ? (
                          <span className="text-orange-700 font-medium">QR Camera</span>
                        ) : record.scan_method === 'auto_cutoff' ? (
                          <span className="text-stone-500">Auto Cutoff</span>
                        ) : (
                          <span className="text-stone-600">Manual Admin</span>
                        )
                      ) : (
                        <span className="text-stone-400">Unrecorded</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleOpenCorrection(student, record)}
                        className="px-2.5 py-1 text-xs font-semibold text-stone-700 hover:text-orange-700 hover:bg-orange-50 rounded-md border border-stone-200 transition inline-flex items-center gap-1"
                        title="Adjust attendance status with mandatory reason"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Correct</span>
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-stone-400 text-xs">
                    No students found for this class.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MANUAL ATTENDANCE CORRECTION MODAL */}
      {correctionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-4 bg-stone-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold font-display">Manual Attendance Correction</h3>
                <p className="text-[11px] text-stone-300">
                  {correctionTarget.student.full_name} · #{correctionTarget.student.roll_number}
                </p>
              </div>
              <button
                onClick={() => setCorrectionTarget(null)}
                className="text-stone-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCorrection} className="p-5 space-y-4">
              {errorMessage && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                  {errorMessage}
                </div>
              )}

              <div className="p-3 rounded-lg bg-stone-50 border border-stone-200 text-xs text-stone-700 flex items-center justify-between">
                <span>Date: <strong className="font-mono">{selectedDate}</strong></span>
                <span>Current Status: <strong className="uppercase">{correctionTarget.attendanceRecord?.status || 'Unrecorded'}</strong></span>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-stone-600 tracking-wider">
                  Select New Status *
                </label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {(['present', 'late', 'absent', 'excused'] as AttendanceStatus[]).map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setNewStatus(st)}
                      className={`p-2.5 rounded-lg border text-xs font-bold uppercase tracking-wider transition text-center ${
                        newStatus === st
                          ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                          : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-stone-600 tracking-wider">
                  Official Correction Reason (Mandatory Audit Trail) *
                </label>
                <textarea
                  required
                  rows={3}
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="e.g. Student arrived with doctor note / QR badge damaged at gate..."
                  className="w-full mt-1 p-2.5 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setCorrectionTarget(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCorrection}
                  className="px-4 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-xs"
                >
                  {isSubmittingCorrection ? 'Recording...' : 'Save & Log Correction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
