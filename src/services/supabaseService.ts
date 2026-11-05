import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  School,
  SchoolClass,
  Section,
  Student,
  Attendance,
  AttendanceAuditLog,
  ActivityLog,
  ScanResult,
  SupabaseConfig,
  UserProfile,
  AttendanceStatus
} from '../types';
import {
  INITIAL_SCHOOL,
  INITIAL_CLASSES,
  INITIAL_SECTIONS,
  INITIAL_STUDENTS,
  INITIAL_ATTENDANCE,
  INITIAL_USER_PROFILES
} from './seedData';
import { generateSecureQRToken, computeSHA256Hash } from './crypto';

const STORAGE_KEY_CONFIG = 'edupulse_supabase_config';
const STORAGE_KEY_STUDENTS = 'edupulse_db_students';
const STORAGE_KEY_CLASSES = 'edupulse_db_classes';
const STORAGE_KEY_SECTIONS = 'edupulse_db_sections';
const STORAGE_KEY_ATTENDANCE = 'edupulse_db_attendance';
const STORAGE_KEY_AUDIT = 'edupulse_db_audit';
const STORAGE_KEY_SCHOOL = 'edupulse_db_school';

class SupabaseService {
  private client: SupabaseClient | null = null;
  private config: SupabaseConfig;
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // In-memory / session state backing authoritative schema
  private school: School;
  private classes: SchoolClass[];
  private sections: Section[];
  private students: Student[];
  private attendance: Attendance[];
  private auditLogs: AttendanceAuditLog[];
  private activityLogs: ActivityLog[];

  constructor() {
    // 1. Check env vars first, then localStorage
    const envUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || '';
    const envKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || '';

    let savedConfig: { url?: string; key?: string } = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (raw) savedConfig = JSON.parse(raw);
    } catch {
      // ignore
    }

    const supabaseUrl = envUrl || savedConfig.url || '';
    const supabaseAnonKey = envKey || savedConfig.key || '';

    this.config = {
      supabaseUrl,
      supabaseAnonKey,
      isConfigured: Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder'))
    };

    if (this.config.isConfigured) {
      try {
        this.client = createClient(this.config.supabaseUrl, this.config.supabaseAnonKey);
      } catch (e) {
        console.error('Failed to initialize Supabase client:', e);
      }
    }

    // Initialize session state
    this.school = this.loadInitialSchool();
    this.classes = this.loadInitialClasses();
    this.sections = this.loadInitialSections();
    this.students = this.loadInitialStudents();
    this.attendance = this.loadInitialAttendance();
    this.auditLogs = [];
    this.activityLogs = [];

    // Online listener
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => { this.isOnline = true; });
      window.addEventListener('offline', () => { this.isOnline = false; });
    }
  }

  public getConfig(): SupabaseConfig {
    return { ...this.config };
  }

  public updateConfig(url: string, key: string): { success: boolean; message: string } {
    try {
      this.config.supabaseUrl = url.trim();
      this.config.supabaseAnonKey = key.trim();
      this.config.isConfigured = Boolean(this.config.supabaseUrl && this.config.supabaseAnonKey);

      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify({
        url: this.config.supabaseUrl,
        key: this.config.supabaseAnonKey
      }));

      if (this.config.isConfigured) {
        this.client = createClient(this.config.supabaseUrl, this.config.supabaseAnonKey);
      } else {
        this.client = null;
      }
      return { success: true, message: 'Supabase configuration saved successfully.' };
    } catch (err: unknown) {
      return { success: false, message: (err as Error).message || 'Failed to update config' };
    }
  }

  public async testConnection(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
    if (!this.config.isConfigured || !this.client) {
      return { ok: false, error: 'Supabase credentials not yet configured' };
    }
    const start = performance.now();
    try {
      const { error } = await this.client.from('schools').select('id').limit(1);
      const latencyMs = Math.round(performance.now() - start);
      if (error) {
        return { ok: false, latencyMs, error: error.message };
      }
      return { ok: true, latencyMs };
    } catch (err: unknown) {
      return { ok: false, error: (err as Error).message || 'Connection test failed' };
    }
  }

  public getOnlineStatus(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  // ==========================================================================
  // CORE: SECURE ONLINE QR ATTENDANCE SCANNING (Strict Single Daily Check-In)
  // ==========================================================================
  public async recordQRAttendance(
    rawToken: string,
    schoolId: string,
    operatorId?: string
  ): Promise<ScanResult> {
    // 1. Strict Online Requirement
    if (!this.getOnlineStatus()) {
      return {
        success: false,
        errorCode: 'OFFLINE_ERROR',
        message: 'Network offline. Scanner requires active internet connection to record attendance.'
      };
    }

    const cleanToken = rawToken.trim();
    if (!cleanToken) {
      return {
        success: false,
        errorCode: 'INVALID_OR_REVOKED_TOKEN',
        message: 'Empty or corrupt QR code.'
      };
    }

    // If live Supabase is configured, call the authoritative backend RPC
    if (this.client && this.config.isConfigured) {
      try {
        const { data, error } = await this.client.rpc('record_qr_attendance', {
          p_token: cleanToken,
          p_school_id: schoolId,
          p_operator_id: operatorId || null
        });

        if (error) {
          return {
            success: false,
            errorCode: 'SERVER_ERROR',
            message: `Supabase database error: ${error.message}`
          };
        }

        if (!data.success) {
          if (data.error_code === 'ALREADY_SCANNED_TODAY') {
            return {
              success: false,
              errorCode: 'ALREADY_SCANNED_TODAY',
              message: `Student already scanned in today (${data.existing_status?.toUpperCase()})`,
              student: {
                id: '',
                fullName: data.student_name || 'Student',
                rollNumber: data.roll_number || '',
                admissionNumber: '',
                className: '',
                sectionName: ''
              },
              existingRecord: {
                checkedInAt: data.first_scanned_at,
                status: data.existing_status
              }
            };
          }
          return {
            success: false,
            errorCode: data.error_code || 'INVALID_OR_REVOKED_TOKEN',
            message: data.message || 'Verification rejected by server'
          };
        }

        return {
          success: true,
          message: 'Attendance recorded successfully',
          student: {
            id: data.student_id,
            fullName: data.student_name,
            rollNumber: data.roll_number,
            admissionNumber: data.admission_number,
            className: data.class_name,
            sectionName: data.section_name,
            photoUrl: data.photo_url
          },
          attendance: {
            id: data.attendance_id,
            status: data.status,
            checkedInAt: data.checked_in_at,
            localTimeFormatted: data.local_time,
            attendanceDate: data.attendance_date
          }
        };
      } catch (err: unknown) {
        console.error('Remote RPC error, falling back to local transactional verification:', err);
      }
    }

    // Transactional logic matching exact PostgreSQL record_qr_attendance function
    return this.executeLocalVerification(cleanToken, schoolId, operatorId);
  }

  private async executeLocalVerification(
    cleanToken: string,
    schoolId: string,
    operatorId?: string
  ): Promise<ScanResult> {
    const student = this.students.find(s => s.qr_token === cleanToken && s.school_id === schoolId);
    if (!student) {
      return {
        success: false,
        errorCode: 'INVALID_OR_REVOKED_TOKEN',
        message: 'Invalid, unknown, or revoked QR security badge.'
      };
    }

    if (student.status !== 'active') {
      return {
        success: false,
        errorCode: 'INACTIVE_STUDENT',
        message: `Student account is currently ${student.status.toUpperCase()}.`
      };
    }

    // Get current local date in school timezone
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Check for existing attendance on this date
    const existing = this.attendance.find(
      a => a.school_id === schoolId && a.student_id === student.id && a.attendance_date === todayStr
    );

    if (existing) {
      return {
        success: false,
        errorCode: 'ALREADY_SCANNED_TODAY',
        message: `Already checked in today at ${new Date(existing.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        student: {
          id: student.id,
          fullName: student.full_name,
          rollNumber: student.roll_number,
          admissionNumber: student.admission_number,
          className: student.class_name || 'Class',
          sectionName: student.section_name || 'Section',
          photoUrl: student.photo_url
        },
        existingRecord: {
          checkedInAt: existing.checked_in_at,
          status: existing.status
        }
      };
    }

    // Determine status (Present vs Late)
    const [startH, startM] = this.school.start_time.split(':').map(Number);
    const schoolStart = new Date(now);
    schoolStart.setHours(startH, startM, 0, 0);
    const lateCutoff = new Date(schoolStart.getTime() + this.school.late_threshold_mins * 60000);

    const status: AttendanceStatus = now > lateCutoff ? 'late' : 'present';

    const newAttendance: Attendance = {
      id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      school_id: schoolId,
      student_id: student.id,
      attendance_date: todayStr,
      checked_in_at: now.toISOString(),
      status,
      scan_method: 'qr_camera',
      recorded_by: operatorId,
      created_at: now.toISOString(),
      student_name: student.full_name,
      admission_number: student.admission_number,
      roll_number: student.roll_number,
      class_name: student.class_name,
      section_name: student.section_name,
      photo_url: student.photo_url
    };

    this.attendance.unshift(newAttendance);
    this.saveAttendance();

    return {
      success: true,
      message: status === 'late' ? 'Marked Late (Arrival after threshold)' : 'Marked Present (On Time)',
      student: {
        id: student.id,
        fullName: student.full_name,
        rollNumber: student.roll_number,
        admissionNumber: student.admission_number,
        className: student.class_name || 'Class',
        sectionName: student.section_name || 'Section',
        photoUrl: student.photo_url
      },
      attendance: {
        id: newAttendance.id,
        status,
        checkedInAt: newAttendance.checked_in_at,
        localTimeFormatted: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        attendanceDate: todayStr
      }
    };
  }

  // ==========================================================================
  // AUTOMATED ABSENT MARKING
  // ==========================================================================
  public async markDailyAbsentStudents(schoolId: string, targetDate?: string): Promise<{ success: boolean; markedCount: number; message: string }> {
    if (!this.getOnlineStatus()) {
      return { success: false, markedCount: 0, message: 'Network offline. Cannot execute cutoff routine.' };
    }

    const dateToProcess = targetDate || new Date().toISOString().split('T')[0];

    if (this.client && this.config.isConfigured) {
      try {
        const { data, error } = await this.client.rpc('mark_daily_absent_students', {
          p_school_id: schoolId,
          p_target_date: dateToProcess
        });
        if (!error && data?.success) {
          return {
            success: true,
            markedCount: data.marked_absent_count || 0,
            message: `Successfully marked ${data.marked_absent_count || 0} missing students as absent.`
          };
        }
      } catch (err) {
        console.warn('RPC mark_daily_absent_students fallback:', err);
      }
    }

    // Local transactional fallback
    let markedCount = 0;
    const activeStudents = this.students.filter(s => s.school_id === schoolId && s.status === 'active');

    for (const student of activeStudents) {
      const hasRecord = this.attendance.some(
        a => a.school_id === schoolId && a.student_id === student.id && a.attendance_date === dateToProcess
      );

      if (!hasRecord) {
        const absentRecord: Attendance = {
          id: `att-abs-${Date.now()}-${student.id}`,
          school_id: schoolId,
          student_id: student.id,
          attendance_date: dateToProcess,
          checked_in_at: new Date().toISOString(),
          status: 'absent',
          scan_method: 'auto_cutoff',
          created_at: new Date().toISOString(),
          student_name: student.full_name,
          admission_number: student.admission_number,
          roll_number: student.roll_number,
          class_name: student.class_name,
          section_name: student.section_name,
          photo_url: student.photo_url
        };
        this.attendance.push(absentRecord);
        markedCount++;
      }
    }

    this.saveAttendance();
    return {
      success: true,
      markedCount,
      message: `Cutoff executed: ${markedCount} active students with no check-in marked absent.`
    };
  }

  // ==========================================================================
  // ATTENDANCE QUERIES & MANUAL CORRECTIONS
  // ==========================================================================
  public async getAttendance(schoolId: string, date: string, classId?: string): Promise<Attendance[]> {
    if (this.client && this.config.isConfigured) {
      try {
        let query = this.client
          .from('attendance')
          .select('*, students(full_name, admission_number, roll_number, photo_url, class_id, section_id)')
          .eq('school_id', schoolId)
          .eq('attendance_date', date);

        if (classId && classId !== 'all') {
          query = query.eq('students.class_id', classId);
        }

        const { data, error } = await query;
        if (!error && data) {
          return data.map((row: any) => ({
            id: row.id,
            school_id: row.school_id,
            student_id: row.student_id,
            attendance_date: row.attendance_date,
            checked_in_at: row.checked_in_at,
            status: row.status,
            scan_method: row.scan_method,
            recorded_by: row.recorded_by,
            created_at: row.created_at,
            student_name: row.students?.full_name,
            admission_number: row.students?.admission_number,
            roll_number: row.students?.roll_number,
            photo_url: row.students?.photo_url
          }));
        }
      } catch (err) {
        console.warn('Supabase fetch attendance fallback:', err);
      }
    }

    return this.attendance.filter(a => {
      const dateMatch = a.school_id === schoolId && a.attendance_date === date;
      if (!dateMatch) return false;
      if (!classId || classId === 'all') return true;
      const student = this.students.find(s => s.id === a.student_id);
      return student?.class_id === classId;
    });
  }

  public async manualCorrectAttendance(
    attendanceId: string,
    newStatus: AttendanceStatus,
    reason: string,
    changedBy: UserProfile
  ): Promise<{ success: boolean; message: string }> {
    if (!reason.trim()) {
      return { success: false, message: 'A mandatory reason is required for attendance correction.' };
    }

    const index = this.attendance.findIndex(a => a.id === attendanceId);
    if (index === -1) {
      return { success: false, message: 'Attendance record not found.' };
    }

    const prev = this.attendance[index];
    const prevStatus = prev.status;

    // Update attendance
    this.attendance[index] = {
      ...prev,
      status: newStatus
    };
    this.saveAttendance();

    // Log to audit trail
    const auditRecord: AttendanceAuditLog = {
      id: `audit-${Date.now()}`,
      school_id: prev.school_id,
      attendance_id: attendanceId,
      changed_by: changedBy.id,
      changed_by_name: changedBy.full_name,
      previous_status: prevStatus,
      new_status: newStatus,
      reason: reason.trim(),
      created_at: new Date().toISOString(),
      student_name: prev.student_name,
      attendance_date: prev.attendance_date
    };
    this.auditLogs.unshift(auditRecord);
    this.saveAuditLogs();

    return { success: true, message: `Status updated to ${newStatus.toUpperCase()}. Audit entry recorded.` };
  }

  public async markStudentDirect(
    studentId: string,
    schoolId: string,
    date: string,
    status: AttendanceStatus,
    reason: string,
    changedBy: UserProfile
  ): Promise<{ success: boolean; message: string }> {
    const student = this.students.find(s => s.id === studentId);
    if (!student) return { success: false, message: 'Student not found.' };

    const existingIndex = this.attendance.findIndex(
      a => a.school_id === schoolId && a.student_id === studentId && a.attendance_date === date
    );

    if (existingIndex >= 0) {
      return this.manualCorrectAttendance(this.attendance[existingIndex].id, status, reason, changedBy);
    }

    const newRecord: Attendance = {
      id: `att-manual-${Date.now()}`,
      school_id: schoolId,
      student_id: studentId,
      attendance_date: date,
      checked_in_at: new Date().toISOString(),
      status,
      scan_method: 'manual_admin',
      recorded_by: changedBy.id,
      created_at: new Date().toISOString(),
      student_name: student.full_name,
      admission_number: student.admission_number,
      roll_number: student.roll_number,
      class_name: student.class_name,
      section_name: student.section_name,
      photo_url: student.photo_url
    };

    this.attendance.unshift(newRecord);
    this.saveAttendance();

    const auditRecord: AttendanceAuditLog = {
      id: `audit-${Date.now()}`,
      school_id: schoolId,
      attendance_id: newRecord.id,
      changed_by: changedBy.id,
      changed_by_name: changedBy.full_name,
      previous_status: 'absent',
      new_status: status,
      reason: reason || 'Manual register initialization',
      created_at: new Date().toISOString(),
      student_name: student.full_name,
      attendance_date: date
    };
    this.auditLogs.unshift(auditRecord);
    this.saveAuditLogs();

    return { success: true, message: `Student marked ${status.toUpperCase()}.` };
  }

  // ==========================================================================
  // STUDENT MANAGEMENT
  // ==========================================================================
  public async getStudents(schoolId: string): Promise<Student[]> {
    return this.students.filter(s => s.school_id === schoolId);
  }

  public async addStudent(studentData: Omit<Student, 'id' | 'created_at' | 'updated_at' | 'qr_token'>): Promise<{ success: boolean; student?: Student; message: string }> {
    // Check duplicate admission number within same school
    const duplicate = this.students.some(
      s => s.school_id === studentData.school_id &&
           s.admission_number.trim().toLowerCase() === studentData.admission_number.trim().toLowerCase()
    );

    if (duplicate) {
      return { success: false, message: `Admission number "${studentData.admission_number}" already exists in this school.` };
    }

    const rawToken = generateSecureQRToken();
    const tokenPreview = rawToken.slice(-6);

    const c = this.classes.find(cl => cl.id === studentData.class_id);
    const sec = this.sections.find(sc => sc.id === studentData.section_id);

    const newStudent: Student = {
      ...studentData,
      id: `s-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      qr_token: rawToken,
      token_preview: tokenPreview,
      class_name: c?.name || 'Class',
      section_name: sec?.name || 'Section',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.students.unshift(newStudent);
    this.saveStudents();

    return { success: true, student: newStudent, message: 'Student registered with secure QR token.' };
  }

  public async updateStudent(id: string, updates: Partial<Student>): Promise<{ success: boolean; message: string }> {
    const index = this.students.findIndex(s => s.id === id);
    if (index === -1) return { success: false, message: 'Student not found.' };

    const c = updates.class_id ? this.classes.find(cl => cl.id === updates.class_id) : undefined;
    const sec = updates.section_id ? this.sections.find(sc => sc.id === updates.section_id) : undefined;

    this.students[index] = {
      ...this.students[index],
      ...updates,
      class_name: c ? c.name : this.students[index].class_name,
      section_name: sec ? sec.name : this.students[index].section_name,
      updated_at: new Date().toISOString()
    };

    this.saveStudents();
    return { success: true, message: 'Student record updated.' };
  }

  public async deleteStudent(id: string): Promise<{ success: boolean; message: string }> {
    const prevLen = this.students.length;
    this.students = this.students.filter(s => s.id !== id);
    if (this.students.length < prevLen) {
      this.saveStudents();
      return { success: true, message: 'Student removed from active directory.' };
    }
    return { success: false, message: 'Student not found.' };
  }

  public async regenerateQRToken(studentId: string): Promise<{ success: boolean; newToken?: string; message: string }> {
    const student = this.students.find(s => s.id === studentId);
    if (!student) return { success: false, message: 'Student not found.' };

    const rawToken = generateSecureQRToken();
    const tokenPreview = rawToken.slice(-6);

    student.qr_token = rawToken;
    student.token_preview = tokenPreview;
    student.updated_at = new Date().toISOString();

    this.saveStudents();
    return { success: true, newToken: rawToken, message: 'New secure QR token generated. Old token revoked.' };
  }

  public async bulkImportStudents(schoolId: string, importedRows: Array<{
    fullName: string;
    admissionNumber: string;
    rollNumber: string;
    className: string;
    sectionName: string;
    parentName?: string;
    parentPhone?: string;
    bloodGroup?: string;
  }>): Promise<{ success: boolean; importedCount: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    for (let i = 0; i < importedRows.length; i++) {
      const row = importedRows[i];
      if (!row.fullName || !row.admissionNumber || !row.rollNumber) {
        errors.push(`Row ${i + 1}: Missing student name, admission number, or roll number.`);
        continue;
      }

      // Check duplicate
      const exists = this.students.some(
        s => s.school_id === schoolId && s.admission_number.toLowerCase() === row.admissionNumber.trim().toLowerCase()
      );
      if (exists) {
        errors.push(`Row ${i + 1}: Duplicate admission number "${row.admissionNumber}".`);
        continue;
      }

      // Find or match class
      let targetClass = this.classes.find(c => c.name.toLowerCase() === (row.className || '').trim().toLowerCase());
      if (!targetClass) {
        targetClass = this.classes[0]; // fallback
      }

      // Find or match section
      let targetSection = this.sections.find(s => s.class_id === targetClass!.id && s.name.toLowerCase() === (row.sectionName || '').trim().toLowerCase());
      if (!targetSection) {
        targetSection = this.sections.find(s => s.class_id === targetClass!.id) || this.sections[0];
      }

      const rawToken = generateSecureQRToken();
      const newStudent: Student = {
        id: `s-bulk-${Date.now()}-${count}`,
        school_id: schoolId,
        admission_number: row.admissionNumber.trim(),
        roll_number: row.rollNumber.trim(),
        full_name: row.fullName.trim(),
        class_id: targetClass.id,
        section_id: targetSection.id,
        parent_name: row.parentName?.trim() || '',
        parent_phone: row.parentPhone?.trim() || '',
        blood_group: row.bloodGroup?.trim() || '',
        status: 'active',
        admission_date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        class_name: targetClass.name,
        section_name: targetSection.name,
        qr_token: rawToken,
        token_preview: rawToken.slice(-6)
      };

      this.students.push(newStudent);
      count++;
    }

    if (count > 0) {
      this.saveStudents();
    }

    return {
      success: count > 0,
      importedCount: count,
      errors
    };
  }

  // ==========================================================================
  // CLASSES & SECTIONS
  // ==========================================================================
  public async getClasses(schoolId: string): Promise<SchoolClass[]> {
    return this.classes.filter(c => c.school_id === schoolId);
  }

  public async getSections(schoolId: string): Promise<Section[]> {
    return this.sections.filter(s => s.school_id === schoolId);
  }

  public async addClass(schoolId: string, name: string, gradeLevel?: number): Promise<{ success: boolean; newClass?: SchoolClass; message: string }> {
    if (!name.trim()) return { success: false, message: 'Class name cannot be empty.' };

    const exists = this.classes.some(c => c.school_id === schoolId && c.name.toLowerCase() === name.trim().toLowerCase());
    if (exists) return { success: false, message: 'A class with this name already exists in this school.' };

    const newClass: SchoolClass = {
      id: `c-${Date.now()}`,
      school_id: schoolId,
      name: name.trim(),
      grade_level: gradeLevel,
      created_at: new Date().toISOString()
    };
    this.classes.push(newClass);
    this.saveClasses();

    return { success: true, newClass, message: 'Class created.' };
  }

  public async addSection(schoolId: string, classId: string, name: string, roomNumber?: string): Promise<{ success: boolean; newSection?: Section; message: string }> {
    if (!name.trim()) return { success: false, message: 'Section name cannot be empty.' };

    const exists = this.sections.some(s => s.class_id === classId && s.name.toLowerCase() === name.trim().toLowerCase());
    if (exists) return { success: false, message: 'This section already exists in the selected class.' };

    const newSection: Section = {
      id: `sec-${Date.now()}`,
      school_id: schoolId,
      class_id: classId,
      name: name.trim(),
      room_number: roomNumber?.trim(),
      created_at: new Date().toISOString()
    };
    this.sections.push(newSection);
    this.saveSections();

    return { success: true, newSection, message: 'Section added to class.' };
  }

  // ==========================================================================
  // AUDIT LOGS & SETTINGS
  // ==========================================================================
  public async getAuditLogs(schoolId: string): Promise<AttendanceAuditLog[]> {
    return this.auditLogs.filter(a => a.school_id === schoolId);
  }

  public async getSchool(schoolId: string): Promise<School> {
    return { ...this.school };
  }

  public async updateSchool(schoolId: string, updates: Partial<School>): Promise<{ success: boolean; message: string }> {
    this.school = {
      ...this.school,
      ...updates,
      updated_at: new Date().toISOString()
    };
    try {
      localStorage.setItem(STORAGE_KEY_SCHOOL, JSON.stringify(this.school));
    } catch {
      // ignore
    }
    return { success: true, message: 'School configuration saved.' };
  }

  public async getStaffMembers(schoolId: string): Promise<UserProfile[]> {
    return INITIAL_USER_PROFILES;
  }

  // ==========================================================================
  // LOCAL STORAGE HYDRATION & PERSISTENCE
  // ==========================================================================
  private loadInitialSchool(): School {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SCHOOL);
      if (raw) return JSON.parse(raw);
    } catch {}
    return INITIAL_SCHOOL;
  }

  private loadInitialClasses(): SchoolClass[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CLASSES);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [...INITIAL_CLASSES];
  }

  private loadInitialSections(): Section[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SECTIONS);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [...INITIAL_SECTIONS];
  }

  private loadInitialStudents(): Student[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_STUDENTS);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [...INITIAL_STUDENTS];
  }

  private loadInitialAttendance(): Attendance[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ATTENDANCE);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [...INITIAL_ATTENDANCE];
  }

  private saveStudents() {
    try {
      localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(this.students));
    } catch {}
  }

  private saveAttendance() {
    try {
      localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(this.attendance));
    } catch {}
  }

  private saveClasses() {
    try {
      localStorage.setItem(STORAGE_KEY_CLASSES, JSON.stringify(this.classes));
    } catch {}
  }

  private saveSections() {
    try {
      localStorage.setItem(STORAGE_KEY_SECTIONS, JSON.stringify(this.sections));
    } catch {}
  }

  private saveAuditLogs() {
    try {
      localStorage.setItem(STORAGE_KEY_AUDIT, JSON.stringify(this.auditLogs));
    } catch {}
  }
}

export const supabaseService = new SupabaseService();
