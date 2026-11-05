import React, { useState } from 'react';
import {
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  TrendingUp,
  QrCode,
  UserPlus,
  Printer,
  Calendar,
  AlertCircle,
  ArrowUpRight,
  ShieldAlert
} from 'lucide-react';
import { School, Student, Attendance, SchoolClass } from '../types';
import { supabaseService } from '../services/supabaseService';

interface DashboardViewProps {
  school: School;
  students: Student[];
  attendance: Attendance[];
  classes: SchoolClass[];
  onNavigate: (tab: string) => void;
  onRefreshData: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  school,
  students,
  attendance,
  classes,
  onNavigate,
  onRefreshData
}) => {
  const [cutoffProcessing, setCutoffProcessing] = useState(false);
  const [cutoffNotice, setCutoffNotice] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];
  const todaysAttendance = attendance.filter(a => a.attendance_date === todayStr);

  const totalStudents = students.filter(s => s.status === 'active').length;
  const presentToday = todaysAttendance.filter(a => a.status === 'present').length;
  const lateToday = todaysAttendance.filter(a => a.status === 'late').length;
  const absentToday = todaysAttendance.filter(a => a.status === 'absent').length;
  const totalCheckedIn = presentToday + lateToday;

  const attendancePercentage = totalStudents > 0
    ? Math.round((totalCheckedIn / totalStudents) * 100)
    : 0;

  // Unmarked students (neither checked in nor marked absent)
  const unmarkedStudents = Math.max(0, totalStudents - (totalCheckedIn + absentToday));

  // Run Cutoff Absent Routine
  const handleRunCutoff = async () => {
    if (cutoffProcessing) return;
    setCutoffProcessing(true);
    setCutoffNotice(null);
    try {
      const res = await supabaseService.markDailyAbsentStudents(school.id, todayStr);
      setCutoffNotice(res.message);
      onRefreshData();
      setTimeout(() => setCutoffNotice(null), 4000);
    } finally {
      setCutoffProcessing(false);
    }
  };

  // Class-wise attendance breakdown
  const classStats = classes.map(cls => {
    const classStudents = students.filter(s => s.class_id === cls.id && s.status === 'active');
    const classTotal = classStudents.length;
    const classAttended = todaysAttendance.filter(a => {
      const st = classStudents.find(s => s.id === a.student_id);
      return st && (a.status === 'present' || a.status === 'late');
    }).length;
    const rate = classTotal > 0 ? Math.round((classAttended / classTotal) * 100) : 0;
    return {
      class: cls,
      total: classTotal,
      attended: classAttended,
      rate
    };
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 space-y-6">
      {/* Top Banner & Quick Action Header */}
      <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-orange-700 tracking-wide uppercase">
            <span>{school.academic_year} Session</span>
            <span>·</span>
            <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-stone-900 tracking-tight mt-1 font-display">
            {school.name}
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Real-time attendance monitor. School Start: <strong className="font-mono text-stone-700">{school.start_time}</strong> · Late Threshold: <strong className="font-mono text-stone-700">+{school.late_threshold_mins}m</strong> · Cutoff: <strong className="font-mono text-stone-700">{school.cutoff_time}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate('scanner')}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg transition shadow-xs"
          >
            <QrCode className="w-4 h-4" />
            <span>Launch Scanner</span>
          </button>

          <button
            onClick={() => onNavigate('students')}
            className="flex items-center gap-2 px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg transition shadow-xs"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Student</span>
          </button>

          <button
            onClick={handleRunCutoff}
            disabled={cutoffProcessing}
            className="flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-lg border border-stone-200 transition"
            title="Auto-marks any student without check-in as absent"
          >
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>{cutoffProcessing ? 'Processing Cutoff...' : 'Run Absent Cutoff'}</span>
          </button>
        </div>
      </div>

      {cutoffNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{cutoffNotice}</span>
        </div>
      )}

      {/* 5 Core Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Students */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">Total Enrolled</span>
            <Users className="w-4 h-4 text-stone-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-stone-900 font-display mt-2 tabular-nums">
            {totalStudents}
          </p>
          <span className="text-[11px] text-stone-400 mt-1 block">Active student records</span>
        </div>

        {/* Present Today */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">Present (On Time)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-700 font-display mt-2 tabular-nums">
            {presentToday}
          </p>
          <span className="text-[11px] text-emerald-600 font-medium mt-1 block">
            {totalStudents > 0 ? Math.round((presentToday / totalStudents) * 100) : 0}% of student body
          </span>
        </div>

        {/* Late Today */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">Late Arrivals</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-amber-600 font-display mt-2 tabular-nums">
            {lateToday}
          </p>
          <span className="text-[11px] text-amber-700 font-medium mt-1 block">
            Arrived after {school.start_time.slice(0, 5)}
          </span>
        </div>

        {/* Absent Today */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">Absent Today</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-rose-600 font-display mt-2 tabular-nums">
            {absentToday}
          </p>
          <span className="text-[11px] text-stone-400 mt-1 block">
            {unmarkedStudents > 0 ? `+${unmarkedStudents} pending cutoff` : 'Marked officially'}
          </span>
        </div>

        {/* Attendance Rate */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">Attendance Rate</span>
            <TrendingUp className="w-4 h-4 text-orange-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-orange-600 font-display mt-2 tabular-nums">
            {attendancePercentage}%
          </p>
          <span className="text-[11px] text-stone-500 font-medium mt-1 block">
            {totalCheckedIn} of {totalStudents} scanned
          </span>
        </div>
      </div>

      {/* Main Grid: Class-wise Performance & Recent Scans Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Class-wise Attendance Breakdown (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-stone-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-stone-900 font-display">
                Class-Wise Attendance
              </h2>
              <p className="text-xs text-stone-500">
                Today's attendance percentage across all enrolled classes
              </p>
            </div>
            <button
              onClick={() => onNavigate('register')}
              className="text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1"
            >
              <span>View Register</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-4 pt-2">
            {classStats.map(item => (
              <div key={item.class.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-stone-800">
                    {item.class.name}
                  </span>
                  <span className="text-stone-500 font-mono tabular-nums">
                    {item.attended} / {item.total} ({item.rate}%)
                  </span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      item.rate >= 80
                        ? 'bg-emerald-600'
                        : item.rate >= 50
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${item.rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {classStats.length === 0 && (
            <div className="text-center py-8 text-stone-400 text-xs">
              No classes created yet.
            </div>
          )}
        </div>

        {/* Recent Student Check-In Scans (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-stone-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-stone-900 font-display">
                Live Scan Activity
              </h2>
              <p className="text-xs text-stone-500">
                Latest student QR scans recorded today
              </p>
            </div>
            <span className="text-[11px] font-mono text-stone-400">
              {todaysAttendance.length} records
            </span>
          </div>

          <div className="divide-y divide-stone-100 max-h-[340px] overflow-y-auto pr-1">
            {todaysAttendance.slice(0, 7).map(record => (
              <div key={record.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-stone-100 border border-stone-200 overflow-hidden shrink-0 flex items-center justify-center font-bold text-xs text-stone-500">
                    {record.photo_url ? (
                      <img src={record.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      record.student_name ? record.student_name.slice(0, 2).toUpperCase() : 'ST'
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-stone-900 truncate">
                      {record.student_name}
                    </p>
                    <p className="text-[11px] text-stone-500 truncate">
                      {record.class_name} · #{record.roll_number}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`inline-block text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                      record.status === 'present'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : record.status === 'late'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {record.status}
                  </span>
                  <p className="text-[10px] font-mono tabular-nums text-stone-400 mt-0.5">
                    {new Date(record.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}

            {todaysAttendance.length === 0 && (
              <div className="text-center py-10 text-stone-400 text-xs">
                No attendance scans recorded today yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
