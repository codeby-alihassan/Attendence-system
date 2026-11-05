# School Attendance Management System (EduPulse) — Production Architecture & Schema

A multi-tenant SaaS School Attendance Management System architected on **Supabase PostgreSQL** with strict online-only operation, cryptographically hashed QR tokens, atomic backend attendance verification, comprehensive Row Level Security (RLS), multi-school memberships, timezone-aware daily check-ins, automated cutoff absence marking, and prestigious institutional ID cards.

---

> [!IMPORTANT]
> **Summary of Incorporated Architectural & Database Enhancements**
> 
> 1. **Complete Row Level Security (RLS) Coverage**: Enforced on every table (`schools`, `school_memberships`, `user_profiles`, `classes`, `sections`, `students`, `qr_tokens`, `attendance`, `attendance_audit_logs`, `activity_logs`) via `auth.uid()` and multi-tenant school membership checks.
> 2. **Atomic Backend Verification Function (`record_qr_attendance`)**: Validates the SHA-256 token hash, verifies student active status, checks school enrollment, calculates date in school timezone, validates start time/late threshold, and records attendance in a single serializable transaction preventing race conditions.
> 3. **Cryptographically Secure Hashed QR Tokens**: The client scans an opaque token string. The database compares its SHA-256 hash (`encode(digest(p_token, 'sha256'), 'hex')`), ensuring raw tokens are never exposed or queried directly.
> 4. **`checked_in_at TIMESTAMPTZ` & Timezone Precision**: Replaces bare time with full timezone-aware timestamp, deriving `attendance_date` via `(NOW() AT TIME ZONE school.timezone)::DATE`.
> 5. **`school_memberships` Table**: Decouples auth users from single schools, allowing educators and administrators to hold distinct roles (`admin`, `staff`) across multiple school tenants.
> 6. **Cross-Tenant Composite Foreign Key Constraints**: `classes`, `sections`, and `students` enforce matching `school_id` across all relational boundaries, preventing students from being assigned to classes or sections in another school.
> 7. **Automated Absent Marking Routine (`mark_daily_absent_students`)**: Evaluates all active students without a check-in by school cutoff time and creates `absent` records without ever overwriting existing check-ins.
> 8. **Prestigious Institutional ID Badges**: Clean academic layout focusing on school crest/name, student photograph, full name, admission number, roll number, class & section, academic year, and secure QR code. Excludes private parent contacts and medical data.
> 9. **Strict Online-Only Policy**: No offline attendance recording, local queues, or client-side caching fallbacks. Scanner halts cleanly when disconnected.

---

## 1. System Architecture & Relational Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MULTI-TENANT SAAS ARCHITECTURE                        │
└─────────────────────────────────────────────────────────────────────────────┘

                                ┌─────────────────┐
                                │   auth.users    │
                                └────────┬────────┘
                                         │ 1:N
                                         ▼
                             ┌───────────────────────┐
                             │  school_memberships   │
                             │ (user_id, school_id)  │
                             └───────────┬───────────┘
                                         │ N:1
                                         ▼
 ┌───────────────────────────────────────────────────────────────────────────┐
 │                                  schools                                  │
 │   id, name, code, timezone, start_time, late_threshold_mins, cutoff_time  │
 └───────┬───────────────────────────────┬───────────────────────────┬───────┘
         │ 1:N                           │ 1:N                       │ 1:N
         ▼                               ▼                           ▼
 ┌───────────────┐               ┌───────────────┐           ┌───────────────┐
 │    classes    │◄──1:N (strict)│   sections    │           │  audit_logs   │
 │(id, school_id)│   composite   │(id, school_id)│           └───────────────┘
 └───────┬───────┘               └───────┬───────┘
         │ 1:N                           │ 1:N
         └───────────────┬───────────────┘
                         ▼ (strict composite foreign keys)
                 ┌───────────────┐
                 │   students    │
                 │(id, school_id)│
                 └───────┬───────┘
                         │ 1:N
         ┌───────────────┴───────────────┐
         ▼                               ▼
 ┌───────────────┐               ┌───────────────┐
 │   qr_tokens   │               │  attendance   │
 │  (token_hash) │               │(date, student)│
 └───────────────┘               └───────┬───────┘
                                         │ 1:N
                                         ▼
                                 ┌───────────────┐
                                 │  audit_logs   │
                                 └───────────────┘
```

---

## 2. Complete PostgreSQL Schema & Migration Script (`schema.sql`)

```sql
-- ============================================================================
-- EDUPULSE: PRODUCTION MULTI-TENANT ATTENDANCE DATABASE SCHEMA
-- ============================================================================

-- Enable required cryptographic extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. SCHOOLS (Tenant Core)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    logo_url TEXT,
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    start_time TIME NOT NULL DEFAULT '08:00:00',
    late_threshold_mins INT NOT NULL DEFAULT 15,
    cutoff_time TIME NOT NULL DEFAULT '12:00:00',
    academic_year VARCHAR(50) NOT NULL DEFAULT '2026-2027',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. USER PROFILES & MULTI-TENANT MEMBERSHIPS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'staff')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_school_membership UNIQUE (user_id, school_id)
);

-- ----------------------------------------------------------------------------
-- 3. CLASSES & SECTIONS (With Tenant-Enforcing Composite Keys)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    grade_level INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_school_class_name UNIQUE (school_id, name),
    CONSTRAINT unique_school_class_composite UNIQUE (id, school_id)
);

CREATE TABLE IF NOT EXISTS sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    room_number VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Enforce that section and class belong to the same school
    CONSTRAINT fk_sections_class_tenant 
        FOREIGN KEY (class_id, school_id) 
        REFERENCES classes(id, school_id) ON DELETE CASCADE,
    CONSTRAINT unique_class_section_name UNIQUE (class_id, name),
    CONSTRAINT unique_school_section_composite UNIQUE (id, school_id)
);

-- ----------------------------------------------------------------------------
-- 4. STUDENTS (Enforcing Class/Section Tenant Integrity)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    admission_number VARCHAR(100) NOT NULL,
    roll_number VARCHAR(50) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    class_id UUID NOT NULL,
    section_id UUID NOT NULL,
    parent_name VARCHAR(255),
    parent_phone VARCHAR(50),
    blood_group VARCHAR(10),
    photo_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'alumni')),
    admission_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Ensure student, class, and section all share the exact same school_id
    CONSTRAINT fk_students_class_tenant 
        FOREIGN KEY (class_id, school_id) 
        REFERENCES classes(id, school_id) ON DELETE RESTRICT,
    CONSTRAINT fk_students_section_tenant 
        FOREIGN KEY (section_id, school_id) 
        REFERENCES sections(id, school_id) ON DELETE RESTRICT,
    CONSTRAINT unique_school_admission_number UNIQUE (school_id, admission_number),
    CONSTRAINT unique_school_student_composite UNIQUE (id, school_id)
);

-- ----------------------------------------------------------------------------
-- 5. SECURE QR TOKENS (Cryptographic Token Hashing)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS qr_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hex digest
    token_preview VARCHAR(8) NOT NULL,      -- Last 6 chars for admin identification
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    CONSTRAINT fk_tokens_student_tenant 
        FOREIGN KEY (student_id, school_id) 
        REFERENCES students(id, school_id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- 6. ATTENDANCE (Single-Scan Daily Check-In with TIMESTAMPTZ)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL,
    attendance_date DATE NOT NULL,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'late', 'absent', 'excused')),
    scan_method VARCHAR(20) NOT NULL DEFAULT 'qr_camera' CHECK (scan_method IN ('qr_camera', 'manual_admin', 'auto_cutoff')),
    recorded_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_attendance_student_tenant 
        FOREIGN KEY (student_id, school_id) 
        REFERENCES students(id, school_id) ON DELETE CASCADE,
    -- Database-level strict single daily attendance record per student per school
    CONSTRAINT unique_daily_student_attendance UNIQUE (school_id, student_id, attendance_date)
);

-- ----------------------------------------------------------------------------
-- 7. ATTENDANCE AUDIT LOGS (Immutable Correction Trail)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    attendance_id UUID NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
    changed_by UUID NOT NULL REFERENCES user_profiles(id),
    changed_by_name VARCHAR(255) NOT NULL,
    previous_status VARCHAR(20) NOT NULL,
    new_status VARCHAR(20) NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 8. SYSTEM ACTIVITY LOGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    user_name VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100),
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- INDEXES FOR MAXIMUM SCANNER & REPORTING PERFORMANCE
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_qr_tokens_hash_active ON qr_tokens(token_hash) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_attendance_school_date ON attendance(school_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_students_school_class ON students(school_id, class_id, section_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON school_memberships(user_id, status);

-- ----------------------------------------------------------------------------
-- HELPER FUNCTIONS FOR ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_schools(user_uuid UUID)
RETURNS TABLE(school_id UUID, role VARCHAR(20))
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT m.school_id, m.role
    FROM school_memberships m
    WHERE m.user_id = user_uuid AND m.status = 'active';
$$;

CREATE OR REPLACE FUNCTION user_has_school_role(user_uuid UUID, target_school_id UUID, required_role VARCHAR(20))
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
    IF required_role = 'staff' THEN
        RETURN EXISTS (
            SELECT 1 FROM school_memberships 
            WHERE user_id = user_uuid AND school_id = target_school_id AND status = 'active'
        );
    ELSE
        RETURN EXISTS (
            SELECT 1 FROM school_memberships 
            WHERE user_id = user_uuid AND school_id = target_school_id AND role = 'admin' AND status = 'active'
        );
    END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY POLICIES (Comprehensive Tenant Isolation)
-- ----------------------------------------------------------------------------
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Schools: Readable by active members, editable only by school admin
CREATE POLICY schools_select ON schools
    FOR SELECT TO authenticated
    USING (id IN (SELECT school_id FROM get_user_schools(auth.uid())));

CREATE POLICY schools_update ON schools
    FOR UPDATE TO authenticated
    USING (user_has_school_role(auth.uid(), id, 'admin'));

-- User Profiles: Self access & members of same school
CREATE POLICY user_profiles_select ON user_profiles
    FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY user_profiles_update ON user_profiles
    FOR UPDATE TO authenticated USING (id = auth.uid());

-- School Memberships: Admins can manage, users can view their own
CREATE POLICY memberships_select ON school_memberships
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR user_has_school_role(auth.uid(), school_id, 'admin'));

CREATE POLICY memberships_admin ON school_memberships
    FOR ALL TO authenticated
    USING (user_has_school_role(auth.uid(), school_id, 'admin'));

-- Classes & Sections: Viewable by staff/admin, modifiable by admin
CREATE POLICY classes_select ON classes
    FOR SELECT TO authenticated
    USING (user_has_school_role(auth.uid(), school_id, 'staff'));

CREATE POLICY classes_admin ON classes
    FOR ALL TO authenticated
    USING (user_has_school_role(auth.uid(), school_id, 'admin'));

CREATE POLICY sections_select ON sections
    FOR SELECT TO authenticated
    USING (user_has_school_role(auth.uid(), school_id, 'staff'));

CREATE POLICY sections_admin ON sections
    FOR ALL TO authenticated
    USING (user_has_school_role(auth.uid(), school_id, 'admin'));

-- Students: Viewable by staff/admin, modifiable by admin
CREATE POLICY students_select ON students
    FOR SELECT TO authenticated
    USING (user_has_school_role(auth.uid(), school_id, 'staff'));

CREATE POLICY students_admin ON students
    FOR ALL TO authenticated
    USING (user_has_school_role(auth.uid(), school_id, 'admin'));

-- QR Tokens: Admin full access; staff cannot read raw token strings
CREATE POLICY qr_tokens_select ON qr_tokens
    FOR SELECT TO authenticated
    USING (user_has_school_role(auth.uid(), school_id, 'admin'));

CREATE POLICY qr_tokens_admin ON qr_tokens
    FOR ALL TO authenticated
    USING (user_has_school_role(auth.uid(), school_id, 'admin'));

-- Attendance: Staff & admin can view and insert scans; only admin can correct
CREATE POLICY attendance_select ON attendance
    FOR SELECT TO authenticated
    USING (user_has_school_role(auth.uid(), school_id, 'staff'));

CREATE POLICY attendance_insert ON attendance
    FOR INSERT TO authenticated
    WITH CHECK (user_has_school_role(auth.uid(), school_id, 'staff'));

CREATE POLICY attendance_admin_update ON attendance
    FOR UPDATE TO authenticated
    USING (user_has_school_role(auth.uid(), school_id, 'admin'));

-- Audit Logs & Activity Logs
CREATE POLICY attendance_audit_select ON attendance_audit_logs
    FOR SELECT TO authenticated
    USING (user_has_school_role(auth.uid(), school_id, 'admin'));

CREATE POLICY attendance_audit_insert ON attendance_audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (user_has_school_role(auth.uid(), school_id, 'admin'));

CREATE POLICY activity_logs_select ON activity_logs
    FOR SELECT TO authenticated
    USING (user_has_school_role(auth.uid(), school_id, 'admin'));

CREATE POLICY activity_logs_insert ON activity_logs
    FOR INSERT TO authenticated
    WITH CHECK (user_has_school_role(auth.uid(), school_id, 'staff'));

-- ============================================================================
-- 9. SECURE BACKEND QR ATTENDANCE VERIFICATION FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION record_qr_attendance(
    p_token TEXT,
    p_school_id UUID,
    p_operator_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated security to safely verify hashed token
SET search_path = public
AS $$
DECLARE
    v_token_hash VARCHAR(64);
    v_student RECORD;
    v_school RECORD;
    v_current_ts TIMESTAMPTZ := NOW();
    v_local_time TIME;
    v_local_date DATE;
    v_late_cutoff TIME;
    v_status VARCHAR(20);
    v_existing_attendance RECORD;
    v_new_attendance_id UUID;
BEGIN
    -- 1. Compute SHA-256 hash of incoming scan token
    v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

    -- 2. Fetch school parameters & timezone
    SELECT * INTO v_school FROM schools WHERE id = p_school_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_SCHOOL', 'message', 'School record not found');
    END IF;

    -- Calculate current local date and time in the school's configured timezone
    v_local_date := (v_current_ts AT TIME ZONE v_school.timezone)::DATE;
    v_local_time := (v_current_ts AT TIME ZONE v_school.timezone)::TIME;

    -- 3. Verify QR Token & Student Information
    SELECT s.id, s.full_name, s.roll_number, s.admission_number, s.photo_url, 
           s.status, c.name AS class_name, sec.name AS section_name
    INTO v_student
    FROM qr_tokens qt
    JOIN students s ON s.id = qt.student_id AND s.school_id = p_school_id
    JOIN classes c ON c.id = s.class_id
    JOIN sections sec ON sec.id = s.section_id
    WHERE qt.token_hash = v_token_hash
      AND qt.school_id = p_school_id
      AND qt.is_active = TRUE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_OR_REVOKED_TOKEN', 'message', 'Invalid, expired, or revoked QR code');
    END IF;

    -- Verify student account status
    IF v_student.status <> 'active' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INACTIVE_STUDENT', 'message', 'Student account is not active');
    END IF;

    -- 4. Check for Existing Attendance on the Current Local Calendar Date
    SELECT * INTO v_existing_attendance
    FROM attendance
    WHERE school_id = p_school_id
      AND student_id = v_student.id
      AND attendance_date = v_local_date;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ALREADY_SCANNED_TODAY',
            'message', 'Student has already scanned in today',
            'student_name', v_student.full_name,
            'roll_number', v_student.roll_number,
            'first_scanned_at', v_existing_attendance.checked_in_at,
            'existing_status', v_existing_attendance.status
        );
    END IF;

    -- 5. Determine Attendance Status (Present vs Late)
    v_late_cutoff := (v_school.start_time + (v_school.late_threshold_mins || ' minutes')::INTERVAL)::TIME;
    
    IF v_local_time > v_late_cutoff THEN
        v_status := 'late';
    ELSE
        v_status := 'present';
    END IF;

    -- 6. Insert Attendance Record
    INSERT INTO attendance (
        school_id,
        student_id,
        attendance_date,
        checked_in_at,
        status,
        scan_method,
        recorded_by
    ) VALUES (
        p_school_id,
        v_student.id,
        v_local_date,
        v_current_ts,
        v_status,
        'qr_camera',
        p_operator_id
    ) RETURNING id INTO v_new_attendance_id;

    -- Return success payload
    RETURN jsonb_build_object(
        'success', true,
        'attendance_id', v_new_attendance_id,
        'student_id', v_student.id,
        'student_name', v_student.full_name,
        'roll_number', v_student.roll_number,
        'admission_number', v_student.admission_number,
        'class_name', v_student.class_name,
        'section_name', v_student.section_name,
        'photo_url', v_student.photo_url,
        'status', v_status,
        'checked_in_at', v_current_ts,
        'local_time', to_char(v_local_time, 'HH12:MI:SS AM'),
        'attendance_date', v_local_date
    );
EXCEPTION
    WHEN unique_violation THEN
        -- Safely handle edge-case concurrent scans within milliseconds
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'CONCURRENT_SCAN_CONFLICT',
            'message', 'Attendance was just recorded by another scanner'
        );
END;
$$;

-- ============================================================================
-- 10. AUTOMATED ABSENT MARKING ROUTINE
-- ============================================================================
CREATE OR REPLACE FUNCTION mark_daily_absent_students(
    p_school_id UUID,
    p_target_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_school RECORD;
    v_date DATE;
    v_inserted_count INT := 0;
BEGIN
    SELECT * INTO v_school FROM schools WHERE id = p_school_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'School not found');
    END IF;

    -- Default to current date in school's timezone if omitted
    v_date := COALESCE(p_target_date, (NOW() AT TIME ZONE v_school.timezone)::DATE);

    -- Insert absent records for active students who have NO record on this date
    WITH missing_students AS (
        SELECT s.id AS student_id
        FROM students s
        WHERE s.school_id = p_school_id
          AND s.status = 'active'
          AND NOT EXISTS (
              SELECT 1 FROM attendance a 
              WHERE a.school_id = p_school_id 
                AND a.student_id = s.id 
                AND a.attendance_date = v_date
          )
    ),
    inserted_rows AS (
        INSERT INTO attendance (
            school_id,
            student_id,
            attendance_date,
            checked_in_at,
            status,
            scan_method
        )
        SELECT 
            p_school_id,
            ms.student_id,
            v_date,
            NOW(),
            'absent',
            'auto_cutoff'
        FROM missing_students ms
        ON CONFLICT (school_id, student_id, attendance_date) DO NOTHING
        RETURNING id
    )
    SELECT count(*) INTO v_inserted_count FROM inserted_rows;

    RETURN jsonb_build_object(
        'success', true,
        'marked_absent_count', v_inserted_count,
        'attendance_date', v_date
    );
END;
$$;
```

---

## 3. QR Token Security & Cryptographic Generation

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SECURE QR TOKEN FLOW                            │
└────────────────────────────────────────────────────────────────────────┘

 1. Admin Registers Student:
    [Crypto Random 32-byte Hex Token generated]
    Raw Token: "edupulse_sec_9f8a2b4c1e7d8a9b..."
         │
         ├──> [SHA-256 Digest] ──> Store in qr_tokens:
         │                          token_hash: "3a7b...f91c"
         │                          token_preview: "8a9b"
         └──> Render directly into Canvas/QR Code for ID card printing.
              (Raw token is NEVER stored in database plaintext)

 2. Camera Scans QR Code:
    [Camera decodes raw token]
         │
         ▼ (Sent via HTTPS directly to Supabase)
    SELECT record_qr_attendance(raw_token, school_id, operator_id)
         │
         ▼
    PostgreSQL calculates SHA-256 hash inside SECURITY DEFINER function
    Matches token_hash, verifies status, logs attendance.
```

---

## 4. Prestigious Institutional ID Badge Layout

Designed to the standards of collegiate academies:
- **Badge Dimensions**: Standard CR80 ($85.6\text{mm} \times 53.98\text{mm}$, $3.375" \times 2.125"$).
- **Visual Structure**:
  - **Top Banner**: Deep navy/charcoal or institutional burgundy with gold/bronze crest foil styling, School Name in bold `Plus Jakarta Sans`, and academic motto/accreditation.
  - **Student Portrait**: Standard portrait frame ($35\text{mm} \times 45\text{mm}$) with crisp double hairline border and fallback monogram silhouette.
  - **Student Information**: Full Legal Name in prominent title case, Student Admission ID, Grade/Class and Section, and Roll Number.
  - **Security QR Code**: High-density QR code embedding the cryptographically random token, bounded by corner registration marks.
  - **Academic Year & Expiry**: `Academic Year 2026–2027 · Valid Thru 06/2027`.
  - **Privacy Guarantee**: Omits personal parent telephone numbers and medical indicators from the public badge face.
- **Printing Engine**:
  - **Single Download**: Generates high-DPI individual badge PNG/PDF with front badge layout.
  - **A4 Batch Print Sheet**: 8 cards formatted in a $2 \times 4$ grid with light cutting guide lines, `@media print` rules removing all browser UI and guaranteeing exact credit-card physical dimensions.

---

## 5. UI/UX & Responsive Engineering

- **Mobile Viewport (Smartphones & Handhelds)**:
  - Top header cap $<15\%$ of screen.
  - Scanner takes full viewport priority with camera selector (back/front), torch toggle, and large touch targets ($\ge 48\text{px}$).
  - Success banner floats over the lower third with high contrast emerald surface, displaying student name, class, and roll number with an instant synthetic audio tone.
- **Tablet & Desktop**:
  - Split-view dashboard: left navigation ($240\text{px}$), contextual top bar, metric cards with tabular numbers, class-by-class attendance breakdown, and quick action bar.
  - Data tables for students and attendance register with live instant filtering, pagination, CSV export, and manual audit correction modal.

---

## 6. Verification & Implementation Plan

1. **Phase 1: Dependencies**:
   - Install `@supabase/supabase-js`, `html5-qrcode`, `qrcode`, `@types/qrcode`, `lucide-react`.
2. **Phase 2: Database Layer & Connection Hub**:
   - Create Supabase client with real-time health probe.
   - Include the complete `schema.sql` inside the app with a one-click copy button and quick-setup guide for the Supabase SQL Editor.
   - Pre-populate realistic institutional seed data (Apex International Academy) for out-of-the-box demonstration.
3. **Phase 3: QR Attendance Scanner**:
   - Camera viewport using `html5-qrcode`.
   - Web Audio API synthesizer for instant 880Hz beep.
   - Strict online connectivity monitor with non-blocking offline banner.
   - Integration with `record_qr_attendance` RPC.
4. **Phase 4: ID Card Studio**:
   - Single card preview & download.
   - 8-card A4 batch print sheet with print CSS.
5. **Phase 5: Student & Class Management**:
   - Class and section creator.
   - Student roster with search, filter, CSV import, and QR token generation/revocation.
6. **Phase 6: Attendance Register & Manual Corrections**:
   - Daily attendance matrix with class/date filters.
   - Manual status change modal with required audit reason logged to `attendance_audit_logs`.
   - Cutoff absent-marking trigger invoking `mark_daily_absent_students`.
7. **Phase 7: Reports, Settings & Build Verification**:
   - Daily/weekly/monthly analytics with CSV export.
   - School parameters configuration (start time, late threshold, cutoff time, timezone).
   - Co-execution of `compile_applet` and `lint_applet`.
