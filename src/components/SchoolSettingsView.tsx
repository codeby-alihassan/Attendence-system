import React, { useState } from 'react';
import {
  Settings,
  Database,
  Key,
  CheckCircle2,
  AlertCircle,
  Copy,
  Download,
  Clock,
  Globe,
  Building,
  Save,
  Shield,
  ExternalLink
} from 'lucide-react';
import { School } from '../types';
import { supabaseService } from '../services/supabaseService';
import { SCHEMA_SQL } from '../services/schemaSql';

interface SchoolSettingsViewProps {
  school: School;
  onSchoolUpdated: () => void;
}

export const SchoolSettingsView: React.FC<SchoolSettingsViewProps> = ({
  school,
  onSchoolUpdated
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'supabase'>('general');

  // School General Form
  const [schoolName, setSchoolName] = useState(school.name);
  const [schoolCode, setSchoolCode] = useState(school.code);
  const [timezone, setTimezone] = useState(school.timezone);
  const [startTime, setStartTime] = useState(school.start_time);
  const [lateThreshold, setLateThreshold] = useState(String(school.late_threshold_mins));
  const [cutoffTime, setCutoffTime] = useState(school.cutoff_time);
  const [academicYear, setAcademicYear] = useState(school.academic_year);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  // Supabase Config Form
  const currentConfig = supabaseService.getConfig();
  const [supabaseUrl, setSupabaseUrl] = useState(currentConfig.supabaseUrl);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(currentConfig.supabaseAnonKey);
  const [connTestResult, setConnTestResult] = useState<{
    tested: boolean;
    ok: boolean;
    latencyMs?: number;
    error?: string;
  } | null>(null);
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [copiedSQL, setCopiedSQL] = useState(false);

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabaseService.updateSchool(school.id, {
      name: schoolName.trim(),
      code: schoolCode.trim(),
      timezone,
      start_time: startTime,
      late_threshold_mins: Number(lateThreshold) || 15,
      cutoff_time: cutoffTime,
      academic_year: academicYear
    });
    setSaveSuccessNotice(true);
    onSchoolUpdated();
    setTimeout(() => setSaveSuccessNotice(false), 3000);
  };

  const handleSaveSupabaseConfig = (e: React.FormEvent) => {
    e.preventDefault();
    supabaseService.updateConfig(supabaseUrl, supabaseAnonKey);
    onSchoolUpdated();
    handleTestConnection();
  };

  const handleTestConnection = async () => {
    setIsTestingConn(true);
    setConnTestResult(null);
    try {
      const res = await supabaseService.testConnection();
      setConnTestResult({
        tested: true,
        ok: res.ok,
        latencyMs: res.latencyMs,
        error: res.error
      });
    } finally {
      setIsTestingConn(false);
    }
  };

  const handleCopySQL = () => {
    navigator.clipboard.writeText(SCHEMA_SQL);
    setCopiedSQL(true);
    setTimeout(() => setCopiedSQL(false), 2500);
  };

  const handleDownloadSQL = () => {
    const blob = new Blob([SCHEMA_SQL], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'edupulse_schema_migrations.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 space-y-6">
      {/* Settings Top Bar */}
      <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <span>School Settings & Supabase Hub</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
              Admin Exclusive
            </span>
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Configure school schedules, late thresholds, timezones, and cloud PostgreSQL connections.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex bg-stone-100 p-1 rounded-lg border border-stone-200 text-xs self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition ${
              activeTab === 'general' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>School Parameters</span>
          </button>
          <button
            onClick={() => setActiveTab('supabase')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition ${
              activeTab === 'supabase' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            <span>Supabase Database & RLS</span>
          </button>
        </div>
      </div>

      {saveSuccessNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>School parameters saved successfully.</span>
        </div>
      )}

      {/* TAB 1: SCHOOL GENERAL PARAMETERS */}
      {activeTab === 'general' && (
        <div className="bg-white rounded-xl border border-stone-200 p-5 sm:p-6 shadow-xs space-y-6">
          <form onSubmit={handleSaveGeneral} className="space-y-5">
            <div>
              <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
                Institutional Details
              </h2>
              <p className="text-xs text-stone-500">
                School identification details displayed on student ID badges and daily reports.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] font-bold uppercase text-stone-600">School Name *</label>
                <input
                  type="text"
                  required
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-stone-600">School Code *</label>
                <input
                  type="text"
                  required
                  value={schoolCode}
                  onChange={(e) => setSchoolCode(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-xs border border-stone-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-stone-600">Academic Year *</label>
                <input
                  type="text"
                  required
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-xs border border-stone-300 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-stone-100">
              <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
                Attendance Schedule & Rules
              </h2>
              <p className="text-xs text-stone-500">
                Determines on-time vs late status and cutoff times in the school's configured timezone.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-[11px] font-bold uppercase text-stone-600">Timezone *</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-xs border border-stone-300 rounded-lg bg-stone-50"
                >
                  <option value="America/New_York">America/New_York (EST/EDT)</option>
                  <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                  <option value="UTC">UTC Standard</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-stone-600">School Start Time *</label>
                <input
                  type="time"
                  step="1"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-xs border border-stone-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-stone-600">Late Threshold (Mins) *</label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  required
                  value={lateThreshold}
                  onChange={(e) => setLateThreshold(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-xs border border-stone-300 rounded-lg font-mono"
                />
                <span className="text-[10px] text-stone-400 mt-0.5 block">Grace period after start time</span>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-stone-600">Daily Cutoff Time *</label>
                <input
                  type="time"
                  step="1"
                  required
                  value={cutoffTime}
                  onChange={(e) => setCutoffTime(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-xs border border-stone-300 rounded-lg font-mono"
                />
                <span className="text-[10px] text-stone-400 mt-0.5 block">Unscanned students marked absent</span>
              </div>
            </div>

            <div className="pt-4 border-t border-stone-100 flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg transition shadow-xs"
              >
                <Save className="w-4 h-4" />
                <span>Save School Settings</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: SUPABASE POSTGRESQL & RLS CONFIGURATION */}
      {activeTab === 'supabase' && (
        <div className="space-y-6">
          {/* Connection Credentials Card */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div>
              <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-600" />
                <span>Live Supabase PostgreSQL Connection</span>
              </h2>
              <p className="text-xs text-stone-500">
                Connect your school tenant to an authoritative cloud Supabase instance with Row Level Security.
              </p>
            </div>

            <form onSubmit={handleSaveSupabaseConfig} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase text-stone-600">
                    Supabase Project URL
                  </label>
                  <input
                    type="url"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    placeholder="https://xyzcompany.supabase.co"
                    className="w-full mt-1 px-3 py-2 text-xs border border-stone-300 rounded-lg font-mono focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-stone-600">
                    Supabase Anon Public Key
                  </label>
                  <input
                    type="password"
                    value={supabaseAnonKey}
                    onChange={(e) => setSupabaseAnonKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full mt-1 px-3 py-2 text-xs border border-stone-300 rounded-lg font-mono focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTestingConn || !supabaseUrl || !supabaseAnonKey}
                    className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 disabled:opacity-50 text-stone-800 text-xs font-semibold rounded-lg border border-stone-200 transition"
                  >
                    {isTestingConn ? 'Testing Latency...' : 'Test Connection'}
                  </button>

                  {connTestResult && (
                    <span className={`text-xs font-semibold flex items-center gap-1 ${connTestResult.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {connTestResult.ok ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Connected ({connTestResult.latencyMs}ms latency)</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-rose-600" />
                          <span>{connTestResult.error || 'Connection failed'}</span>
                        </>
                      )}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition shadow-xs"
                >
                  Save Supabase Keys
                </button>
              </div>
            </form>
          </div>

          {/* Migration Schema Viewer & 1-Click Copy */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-2">
                  <Shield className="w-4 h-4 text-orange-600" />
                  <span>Production PostgreSQL DDL & Migration Scripts</span>
                </h3>
                <p className="text-xs text-stone-500">
                  Includes tables, composite tenant foreign keys, indexes, RLS policies, and <code className="bg-stone-100 px-1 py-0.5 rounded text-[11px] font-mono">record_qr_attendance()</code>.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopySQL}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-lg border border-stone-200 transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedSQL ? 'Copied to Clipboard!' : 'Copy SQL Schema'}</span>
                </button>
                <button
                  onClick={handleDownloadSQL}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg transition shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download schema.sql</span>
                </button>
              </div>
            </div>

            {/* Code container */}
            <div className="bg-stone-950 text-stone-200 p-4 rounded-xl font-mono text-[11px] max-h-96 overflow-y-auto leading-relaxed border border-stone-800 select-all">
              <pre>{SCHEMA_SQL}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
