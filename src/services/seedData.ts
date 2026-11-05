import { School, SchoolClass, Section, Student, QRToken, Attendance, UserProfile, SchoolMembership } from '../types';

export const SEED_SCHOOL_ID = 'e1a2b3c4-0001-4000-8000-000000000001';
export const SEED_ADMIN_ID = 'u1a2b3c4-0001-4000-8000-000000000001';
export const SEED_STAFF_ID = 'u1a2b3c4-0002-4000-8000-000000000002';

export const INITIAL_SCHOOL: School = {
  id: SEED_SCHOOL_ID,
  name: 'Apex International Academy',
  code: 'AIA-MAIN',
  logo_url: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=160&auto=format&fit=crop&q=80',
  timezone: 'America/New_York',
  start_time: '08:00:00',
  late_threshold_mins: 15,
  cutoff_time: '12:00:00',
  academic_year: '2026-2027',
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z'
};

export const INITIAL_USER_PROFILES: UserProfile[] = [
  {
    id: SEED_ADMIN_ID,
    email: 'admin@apexacademy.edu',
    full_name: 'Dr. Evelyn Sterling',
    avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80',
    created_at: '2026-08-01T00:00:00Z'
  },
  {
    id: SEED_STAFF_ID,
    email: 'marcus.vance@apexacademy.edu',
    full_name: 'Marcus Vance',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    created_at: '2026-08-01T00:00:00Z'
  }
];

export const INITIAL_MEMBERSHIPS: SchoolMembership[] = [
  {
    id: 'm1a2b3c4-0001-4000-8000-000000000001',
    user_id: SEED_ADMIN_ID,
    school_id: SEED_SCHOOL_ID,
    role: 'admin',
    status: 'active',
    created_at: '2026-08-01T00:00:00Z'
  },
  {
    id: 'm1a2b3c4-0002-4000-8000-000000000002',
    user_id: SEED_STAFF_ID,
    school_id: SEED_SCHOOL_ID,
    role: 'staff',
    status: 'active',
    created_at: '2026-08-01T00:00:00Z'
  }
];

export const INITIAL_CLASSES: SchoolClass[] = [
  { id: 'c1-grade-9', school_id: SEED_SCHOOL_ID, name: 'Grade 9', grade_level: 9, created_at: '2026-08-10T00:00:00Z' },
  { id: 'c2-grade-10', school_id: SEED_SCHOOL_ID, name: 'Grade 10', grade_level: 10, created_at: '2026-08-10T00:00:00Z' },
  { id: 'c3-grade-11', school_id: SEED_SCHOOL_ID, name: 'Grade 11', grade_level: 11, created_at: '2026-08-10T00:00:00Z' },
  { id: 'c4-grade-12', school_id: SEED_SCHOOL_ID, name: 'Grade 12', grade_level: 12, created_at: '2026-08-10T00:00:00Z' }
];

export const INITIAL_SECTIONS: Section[] = [
  { id: 'sec-9a', school_id: SEED_SCHOOL_ID, class_id: 'c1-grade-9', name: 'Section A', room_number: 'Room 101', created_at: '2026-08-10T00:00:00Z' },
  { id: 'sec-9b', school_id: SEED_SCHOOL_ID, class_id: 'c1-grade-9', name: 'Section B', room_number: 'Room 102', created_at: '2026-08-10T00:00:00Z' },
  { id: 'sec-10a', school_id: SEED_SCHOOL_ID, class_id: 'c2-grade-10', name: 'Section A', room_number: 'Room 201', created_at: '2026-08-10T00:00:00Z' },
  { id: 'sec-10b', school_id: SEED_SCHOOL_ID, class_id: 'c2-grade-10', name: 'Section B', room_number: 'Room 202', created_at: '2026-08-10T00:00:00Z' },
  { id: 'sec-11a', school_id: SEED_SCHOOL_ID, class_id: 'c3-grade-11', name: 'Section A', room_number: 'Room 301', created_at: '2026-08-10T00:00:00Z' },
  { id: 'sec-12a', school_id: SEED_SCHOOL_ID, class_id: 'c4-grade-12', name: 'Section A', room_number: 'Room 401', created_at: '2026-08-10T00:00:00Z' }
];

// Pre-seeded students with authentic raw tokens and calculated hashes
export const INITIAL_STUDENTS: Student[] = [
  {
    id: 's1-alexander',
    school_id: SEED_SCHOOL_ID,
    admission_number: 'AIA-2026-0101',
    roll_number: '01',
    full_name: 'Alexander J. Morgan',
    class_id: 'c2-grade-10',
    section_id: 'sec-10a',
    parent_name: 'Robert & Clara Morgan',
    parent_phone: '+1 (555) 234-5678',
    blood_group: 'O+',
    photo_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=240&auto=format&fit=crop&q=80',
    status: 'active',
    admission_date: '2026-08-15',
    created_at: '2026-08-15T00:00:00Z',
    updated_at: '2026-08-15T00:00:00Z',
    class_name: 'Grade 10',
    section_name: 'Section A',
    qr_token: 'edupulse_sec_a101b202c303d404e505f606a707b808',
    token_preview: 'b808'
  },
  {
    id: 's2-sophia',
    school_id: SEED_SCHOOL_ID,
    admission_number: 'AIA-2026-0102',
    roll_number: '02',
    full_name: 'Sophia Isabella Chen',
    class_id: 'c2-grade-10',
    section_id: 'sec-10a',
    parent_name: 'David Chen',
    parent_phone: '+1 (555) 345-6789',
    blood_group: 'A+',
    photo_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=240&auto=format&fit=crop&q=80',
    status: 'active',
    admission_date: '2026-08-15',
    created_at: '2026-08-15T00:00:00Z',
    updated_at: '2026-08-15T00:00:00Z',
    class_name: 'Grade 10',
    section_name: 'Section A',
    qr_token: 'edupulse_sec_b202c303d404e505f606a707b808c909',
    token_preview: 'c909'
  },
  {
    id: 's3-liam',
    school_id: SEED_SCHOOL_ID,
    admission_number: 'AIA-2026-0103',
    roll_number: '03',
    full_name: 'Liam Tariq Patel',
    class_id: 'c2-grade-10',
    section_id: 'sec-10a',
    parent_name: 'Amina Patel',
    parent_phone: '+1 (555) 456-7890',
    blood_group: 'B+',
    photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&auto=format&fit=crop&q=80',
    status: 'active',
    admission_date: '2026-08-15',
    created_at: '2026-08-15T00:00:00Z',
    updated_at: '2026-08-15T00:00:00Z',
    class_name: 'Grade 10',
    section_name: 'Section A',
    qr_token: 'edupulse_sec_c303d404e505f606a707b808c909d010',
    token_preview: 'd010'
  },
  {
    id: 's4-emily',
    school_id: SEED_SCHOOL_ID,
    admission_number: 'AIA-2026-0104',
    roll_number: '04',
    full_name: 'Emily Grace Watson',
    class_id: 'c2-grade-10',
    section_id: 'sec-10b',
    parent_name: 'Jonathan Watson',
    parent_phone: '+1 (555) 567-8901',
    blood_group: 'AB+',
    photo_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=240&auto=format&fit=crop&q=80',
    status: 'active',
    admission_date: '2026-08-15',
    created_at: '2026-08-15T00:00:00Z',
    updated_at: '2026-08-15T00:00:00Z',
    class_name: 'Grade 10',
    section_name: 'Section B',
    qr_token: 'edupulse_sec_d404e505f606a707b808c909d010e111',
    token_preview: 'e111'
  },
  {
    id: 's5-marcus',
    school_id: SEED_SCHOOL_ID,
    admission_number: 'AIA-2026-0105',
    roll_number: '05',
    full_name: 'Marcus Anthony Brooks',
    class_id: 'c1-grade-9',
    section_id: 'sec-9a',
    parent_name: 'Kendra Brooks',
    parent_phone: '+1 (555) 678-9012',
    blood_group: 'O-',
    photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&auto=format&fit=crop&q=80',
    status: 'active',
    admission_date: '2026-08-15',
    created_at: '2026-08-15T00:00:00Z',
    updated_at: '2026-08-15T00:00:00Z',
    class_name: 'Grade 9',
    section_name: 'Section A',
    qr_token: 'edupulse_sec_e505f606a707b808c909d010e111f222',
    token_preview: 'f222'
  },
  {
    id: 's6-olivia',
    school_id: SEED_SCHOOL_ID,
    admission_number: 'AIA-2026-0106',
    roll_number: '06',
    full_name: 'Olivia Nicole Ramirez',
    class_id: 'c3-grade-11',
    section_id: 'sec-11a',
    parent_name: 'Carlos Ramirez',
    parent_phone: '+1 (555) 789-0123',
    blood_group: 'A-',
    photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=240&auto=format&fit=crop&q=80',
    status: 'active',
    admission_date: '2026-08-15',
    created_at: '2026-08-15T00:00:00Z',
    updated_at: '2026-08-15T00:00:00Z',
    class_name: 'Grade 11',
    section_name: 'Section A',
    qr_token: 'edupulse_sec_f606a707b808c909d010e111f222a333',
    token_preview: 'a333'
  },
  {
    id: 's7-ethan',
    school_id: SEED_SCHOOL_ID,
    admission_number: 'AIA-2026-0107',
    roll_number: '07',
    full_name: 'Ethan Benjamin Hayes',
    class_id: 'c4-grade-12',
    section_id: 'sec-12a',
    parent_name: 'Sarah Hayes',
    parent_phone: '+1 (555) 890-1234',
    blood_group: 'B-',
    photo_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=240&auto=format&fit=crop&q=80',
    status: 'active',
    admission_date: '2026-08-15',
    created_at: '2026-08-15T00:00:00Z',
    updated_at: '2026-08-15T00:00:00Z',
    class_name: 'Grade 12',
    section_name: 'Section A',
    qr_token: 'edupulse_sec_0707b808c909d010e111f222a333b444',
    token_preview: 'b444'
  },
  {
    id: 's8-chloe',
    school_id: SEED_SCHOOL_ID,
    admission_number: 'AIA-2026-0108',
    roll_number: '08',
    full_name: 'Chloe Danielle Dubois',
    class_id: 'c1-grade-9',
    section_id: 'sec-9b',
    parent_name: 'Pierre Dubois',
    parent_phone: '+1 (555) 901-2345',
    blood_group: 'AB-',
    photo_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=240&auto=format&fit=crop&q=80',
    status: 'active',
    admission_date: '2026-08-15',
    created_at: '2026-08-15T00:00:00Z',
    updated_at: '2026-08-15T00:00:00Z',
    class_name: 'Grade 9',
    section_name: 'Section B',
    qr_token: 'edupulse_sec_1808c909d010e111f222a333b444c555',
    token_preview: 'c555'
  }
];

export const INITIAL_QR_TOKENS: QRToken[] = INITIAL_STUDENTS.map(student => ({
  id: `token-${student.id}`,
  school_id: SEED_SCHOOL_ID,
  student_id: student.id,
  token_hash: `hash_${student.qr_token}`,
  token_preview: student.token_preview || 'xxxx',
  is_active: true,
  generated_at: student.created_at
}));

export const INITIAL_ATTENDANCE: Attendance[] = [
  {
    id: 'att-01',
    school_id: SEED_SCHOOL_ID,
    student_id: 's1-alexander',
    attendance_date: new Date().toISOString().split('T')[0],
    checked_in_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    status: 'present',
    scan_method: 'qr_camera',
    recorded_by: SEED_STAFF_ID,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    student_name: 'Alexander J. Morgan',
    admission_number: 'AIA-2026-0101',
    roll_number: '01',
    class_name: 'Grade 10',
    section_name: 'Section A',
    photo_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=240&auto=format&fit=crop&q=80'
  },
  {
    id: 'att-02',
    school_id: SEED_SCHOOL_ID,
    student_id: 's2-sophia',
    attendance_date: new Date().toISOString().split('T')[0],
    checked_in_at: new Date(Date.now() - 3600000 * 1.8).toISOString(),
    status: 'present',
    scan_method: 'qr_camera',
    recorded_by: SEED_STAFF_ID,
    created_at: new Date(Date.now() - 3600000 * 1.8).toISOString(),
    student_name: 'Sophia Isabella Chen',
    admission_number: 'AIA-2026-0102',
    roll_number: '02',
    class_name: 'Grade 10',
    section_name: 'Section A',
    photo_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=240&auto=format&fit=crop&q=80'
  },
  {
    id: 'att-03',
    school_id: SEED_SCHOOL_ID,
    student_id: 's5-marcus',
    attendance_date: new Date().toISOString().split('T')[0],
    checked_in_at: new Date(Date.now() - 3600000 * 1.2).toISOString(),
    status: 'late',
    scan_method: 'qr_camera',
    recorded_by: SEED_STAFF_ID,
    created_at: new Date(Date.now() - 3600000 * 1.2).toISOString(),
    student_name: 'Marcus Anthony Brooks',
    admission_number: 'AIA-2026-0105',
    roll_number: '05',
    class_name: 'Grade 9',
    section_name: 'Section A',
    photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&auto=format&fit=crop&q=80'
  }
];
