/**
 * EduPulse Attendance Management System - Core TypeScript Definitions
 * Multi-tenant relational data structures matching PostgreSQL / Supabase schema.
 */

export type UserRole = 'admin' | 'staff';
export type StudentStatus = 'active' | 'suspended' | 'alumni';
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';
export type ScanMethod = 'qr_camera' | 'manual_admin' | 'auto_cutoff';

export interface School {
  id: string;
  name: string;
  code: string;
  logo_url?: string;
  timezone: string;
  start_time: string; // HH:MM:SS format (e.g. "08:00:00")
  late_threshold_mins: number; // e.g. 15
  cutoff_time: string; // HH:MM:SS format (e.g. "12:00:00")
  academic_year: string; // e.g. "2026-2027"
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  created_at: string;
}

export interface SchoolMembership {
  id: string;
  user_id: string;
  school_id: string;
  role: UserRole;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface SchoolClass {
  id: string;
  school_id: string;
  name: string; // e.g. "Grade 10"
  grade_level?: number;
  created_at: string;
}

export interface Section {
  id: string;
  school_id: string;
  class_id: string;
  name: string; // e.g. "Section A"
  room_number?: string;
  created_at: string;
}

export interface Student {
  id: string;
  school_id: string;
  admission_number: string;
  roll_number: string;
  full_name: string;
  class_id: string;
  section_id: string;
  parent_name?: string;
  parent_phone?: string;
  blood_group?: string;
  photo_url?: string;
  status: StudentStatus;
  admission_date: string;
  created_at: string;
  updated_at: string;
  // Joined convenience fields
  class_name?: string;
  section_name?: string;
  qr_token?: string; // Current raw token for active rendering
  token_preview?: string;
}

export interface QRToken {
  id: string;
  school_id: string;
  student_id: string;
  token_hash: string; // SHA-256 hash
  token_preview: string; // Last 6-8 chars
  is_active: boolean;
  generated_at: string;
  revoked_at?: string;
}

export interface Attendance {
  id: string;
  school_id: string;
  student_id: string;
  attendance_date: string; // YYYY-MM-DD
  checked_in_at: string; // ISO TIMESTAMPTZ string
  status: AttendanceStatus;
  scan_method: ScanMethod;
  recorded_by?: string;
  created_at: string;
  // Joined fields
  student_name?: string;
  admission_number?: string;
  roll_number?: string;
  class_name?: string;
  section_name?: string;
  photo_url?: string;
}

export interface AttendanceAuditLog {
  id: string;
  school_id: string;
  attendance_id: string;
  changed_by: string;
  changed_by_name: string;
  previous_status: AttendanceStatus;
  new_status: AttendanceStatus;
  reason: string;
  created_at: string;
  // Joined
  student_name?: string;
  attendance_date?: string;
}

export interface ActivityLog {
  id: string;
  school_id: string;
  user_id?: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, unknown>;
  created_at: string;
}

export interface ScanResult {
  success: boolean;
  errorCode?: 'ALREADY_SCANNED_TODAY' | 'INVALID_OR_REVOKED_TOKEN' | 'INACTIVE_STUDENT' | 'OFFLINE_ERROR' | 'SERVER_ERROR';
  message: string;
  student?: {
    id: string;
    fullName: string;
    rollNumber: string;
    admissionNumber: string;
    className: string;
    sectionName: string;
    photoUrl?: string;
  };
  attendance?: {
    id: string;
    status: AttendanceStatus;
    checkedInAt: string;
    localTimeFormatted: string;
    attendanceDate: string;
  };
  existingRecord?: {
    checkedInAt: string;
    status: AttendanceStatus;
  };
}

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  isConfigured: boolean;
}
