import React, { useState } from 'react';
import {
  BarChart3,
  Download,
  Printer,
  Calendar,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  FileSpreadsheet
} from 'lucide-react';
import { Attendance, Student, SchoolClass, School } from '../types';

interface ReportsViewProps {
  school: School;
  attendance: Attendance[];
  students: Student[];
  classes: SchoolClass[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  school,
  attendance,
  students,
  classes
}) => {
  const [reportType, setReportType] = useState<'daily' | 'late' | 'absence' | 'class_summary'>('daily');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().split('T')[0]);

  // Filter attendance records
  const filteredAttendance = attendance.filter(rec => {
    const matchesDate = !dateFilter || rec.attendance_date === dateFilter;
    const student = students.find(s => s.id === rec.student_id);
    const matchesClass = selectedClassId === 'all' || student?.class_id === selectedClassId;
    
    if (!matchesDate || !matchesClass) return false;

    if (reportType === 'late') return rec.status === 'late';
    if (reportType === 'absence') return rec.status === 'absent';
    return true;
  });

  const handleExportCSV = () => {
    const headers = ['Student Name', 'Admission ID', 'Class', 'Roll No', 'Date', 'Checked In At', 'Status', 'Scan Method'];
    const rows = filteredAttendance.map(a => [
      `"${a.student_name || ''}"`,
      `"${a.admission_number || ''}"`,
      `"${a.class_name || ''}"`,
      `"${a.roll_number || ''}"`,
      `"${a.attendance_date}"`,
      `"${new Date(a.checked_in_at).toLocaleTimeString()}"`,
      `"${a.status.toUpperCase()}"`,
      `"${a.scan_method}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_report_${school.code}_${dateFilter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <span>Attendance Reports & Analytics</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
              Official Records
            </span>
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Export comprehensive daily, late arrival, and absenteeism reports for school records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-lg border border-stone-200 transition"
          >
            <Download className="w-4 h-4 text-emerald-700" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg transition shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Filter & View Mode Controls */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex flex-wrap items-center gap-1.5 bg-stone-100 p-1 rounded-lg text-xs">
          <button
            onClick={() => setReportType('daily')}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              reportType === 'daily' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Daily Register
          </button>
          <button
            onClick={() => setReportType('late')}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              reportType === 'late' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Late Arrivals
          </button>
          <button
            onClick={() => setReportType('absence')}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              reportType === 'absence' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Absence Log
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-stone-400" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg bg-stone-50 font-mono"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-stone-400" />
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg bg-stone-50 text-stone-800"
            >
              <option value="all">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Printable Report Header (Print View) */}
      <div className="print-only mb-6 text-center border-b pb-4">
        <h2 className="text-xl font-bold uppercase">{school.name}</h2>
        <p className="text-xs text-stone-600">Official Attendance Register · Date: {dateFilter}</p>
      </div>

      {/* Report Data Table */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Admission ID</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Roll No</th>
                <th className="px-4 py-3">Attendance Date</th>
                <th className="px-4 py-3">Check-In Time</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredAttendance.map(rec => (
                <tr key={rec.id} className="hover:bg-stone-50/70 transition">
                  <td className="px-4 py-3 font-bold text-stone-900">{rec.student_name}</td>
                  <td className="px-4 py-3 font-mono text-stone-700">{rec.admission_number}</td>
                  <td className="px-4 py-3 text-stone-700">{rec.class_name}</td>
                  <td className="px-4 py-3 font-mono">#{rec.roll_number}</td>
                  <td className="px-4 py-3 font-mono text-stone-600">{rec.attendance_date}</td>
                  <td className="px-4 py-3 font-mono text-stone-600">
                    {new Date(rec.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        rec.status === 'present'
                          ? 'bg-emerald-50 text-emerald-800'
                          : rec.status === 'late'
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-rose-50 text-rose-800'
                      }`}
                    >
                      {rec.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-500 text-[11px]">
                    {rec.scan_method}
                  </td>
                </tr>
              ))}

              {filteredAttendance.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-stone-400 text-xs">
                    No records found matching the report criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
