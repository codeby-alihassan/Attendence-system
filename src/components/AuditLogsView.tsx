import React, { useState } from 'react';
import { History, ShieldCheck, Search, Calendar, UserCheck } from 'lucide-react';
import { AttendanceAuditLog, School } from '../types';

interface AuditLogsViewProps {
  school: School;
  auditLogs: AttendanceAuditLog[];
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({
  school,
  auditLogs
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLogs = auditLogs.filter(log =>
    (log.student_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.changed_by_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 space-y-6">
      <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <span>Attendance Audit Trail</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
              Immutable
            </span>
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Cryptographic and timestamped trail of all manual status overrides and supervisor adjustments.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student or correction reason..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Attendance Date</th>
                <th className="px-4 py-3">Status Transition</th>
                <th className="px-4 py-3">Supervisor / Staff</th>
                <th className="px-4 py-3">Official Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-stone-50/70 transition">
                  <td className="px-4 py-3 font-mono text-stone-600 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td className="px-4 py-3 font-bold text-stone-900">
                    {log.student_name || 'Student'}
                  </td>
                  <td className="px-4 py-3 font-mono text-stone-600">
                    {log.attendance_date}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 font-bold uppercase text-[10px]">
                      <span className="text-stone-400">{log.previous_status}</span>
                      <span className="text-stone-300">→</span>
                      <span className="text-orange-600 font-extrabold">{log.new_status}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-stone-700">
                    {log.changed_by_name}
                  </td>
                  <td className="px-4 py-3 text-stone-600 italic">
                    "{log.reason}"
                  </td>
                </tr>
              ))}

              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-stone-400 text-xs">
                    No manual corrections recorded yet. All attendance scans remain verified by primary camera scans.
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
