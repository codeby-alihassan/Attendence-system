import React, { useState, useEffect, useCallback } from 'react';
import { UserRole, School, Student, SchoolClass, Section, Attendance, AttendanceAuditLog, UserProfile } from './types';
import { supabaseService } from './services/supabaseService';
import { INITIAL_USER_PROFILES } from './services/seedData';
import { Navigation } from './components/Navigation';
import { OfflineBanner } from './components/OfflineBanner';
import { DashboardView } from './components/DashboardView';
import { ScannerView } from './components/ScannerView';
import { StudentsView } from './components/StudentsView';
import { ClassesView } from './components/ClassesView';
import { IDCardStudio } from './components/IDCardStudio';
import { AttendanceRegisterView } from './components/AttendanceRegisterView';
import { ReportsView } from './components/ReportsView';
import { SchoolSettingsView } from './components/SchoolSettingsView';
import { AuditLogsView } from './components/AuditLogsView';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [currentRole, setCurrentRole] = useState<UserRole>('admin');
  const [isOnline, setIsOnline] = useState(supabaseService.getOnlineStatus());
  
  // Data state
  const [school, setSchool] = useState<School | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [auditLogs, setAuditLogs] = useState<AttendanceAuditLog[]>([]);
  const [selectedStudentForBadge, setSelectedStudentForBadge] = useState<string>('');

  const currentUser: UserProfile = currentRole === 'admin'
    ? INITIAL_USER_PROFILES[0]
    : INITIAL_USER_PROFILES[1];

  // Refresh all state from service
  const refreshAllData = useCallback(async () => {
    const s = await supabaseService.getSchool('e1a2b3c4-0001-4000-8000-000000000001');
    setSchool(s);

    const [st, cl, sec, att, aud] = await Promise.all([
      supabaseService.getStudents(s.id),
      supabaseService.getClasses(s.id),
      supabaseService.getSections(s.id),
      supabaseService.getAttendance(s.id, new Date().toISOString().split('T')[0]),
      supabaseService.getAuditLogs(s.id)
    ]);

    setStudents(st);
    setClasses(cl);
    setSections(sec);
    setAttendance(att);
    setAuditLogs(aud);
  }, []);

  useEffect(() => {
    refreshAllData();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshAllData]);

  if (!school) {
    return (
      <div className="min-h-screen bg-[#FBFBFA] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-orange-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-stone-600 tracking-wide">
            Loading EduPulse Attendance System...
          </p>
        </div>
      </div>
    );
  }

  const hasSupabaseConfigured = supabaseService.getConfig().isConfigured;

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#1A1A1A] flex flex-col font-sans">
      <OfflineBanner />

      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentRole={currentRole}
        setCurrentRole={setCurrentRole}
        school={school}
        isOnline={isOnline}
        hasSupabaseConfigured={hasSupabaseConfigured}
      />

      <main className="flex-1 pb-12">
        {activeTab === 'dashboard' && (
          <DashboardView
            school={school}
            students={students}
            attendance={attendance}
            classes={classes}
            onNavigate={(tab) => setActiveTab(tab)}
            onRefreshData={refreshAllData}
          />
        )}

        {activeTab === 'scanner' && (
          <ScannerView
            school={school}
            operatorId={currentUser.id}
            onAttendanceRecorded={refreshAllData}
          />
        )}

        {activeTab === 'register' && (
          <AttendanceRegisterView
            school={school}
            students={students}
            classes={classes}
            sections={sections}
            attendance={attendance}
            currentUser={currentUser}
            onAttendanceUpdated={refreshAllData}
            onNavigateToAuditLogs={() => setActiveTab('audit')}
          />
        )}

        {activeTab === 'students' && (
          <StudentsView
            school={school}
            students={students}
            classes={classes}
            sections={sections}
            onStudentsUpdated={refreshAllData}
            onNavigateToIDCards={(studentId) => {
              setSelectedStudentForBadge(studentId);
              setActiveTab('idcards');
            }}
          />
        )}

        {activeTab === 'classes' && (
          <ClassesView
            school={school}
            classes={classes}
            sections={sections}
            students={students}
            onDataUpdated={refreshAllData}
          />
        )}

        {activeTab === 'idcards' && (
          <IDCardStudio
            school={school}
            students={students}
            classes={classes}
            sections={sections}
            onStudentsUpdated={refreshAllData}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            school={school}
            attendance={attendance}
            students={students}
            classes={classes}
          />
        )}

        {activeTab === 'settings' && (
          <SchoolSettingsView
            school={school}
            onSchoolUpdated={refreshAllData}
          />
        )}

        {activeTab === 'audit' && (
          <AuditLogsView
            school={school}
            auditLogs={auditLogs}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white py-4 text-center text-xs text-stone-500 no-print">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="font-medium">
            EduPulse School Attendance System · {school.name}
          </p>
          <div className="flex items-center gap-3 text-[11px] text-stone-400">
            <span>PostgreSQL & Supabase Architecture</span>
            <span>·</span>
            <span>CR80 Badges & Single-Scan Daily Policy</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
