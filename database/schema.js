const { getDb } = require('./db');

function initializeSchema() {
  const db = getDb();

  const schemaSql = `
    -- Users table (Central authentication & credentials)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT CHECK(role IN ('admin', 'teacher', 'student', 'parent', 'accountant')) NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT,
      avatar_url TEXT,
      status TEXT CHECK(status IN ('active', 'suspended', 'inactive')) DEFAULT 'active',
      last_login DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Academic Classes / Sections
    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,                -- e.g. Grade 10
      grade_level INTEGER NOT NULL,       -- e.g. 10
      section TEXT NOT NULL,             -- e.g. A, B, C
      room_number TEXT,
      academic_year TEXT NOT NULL,       -- e.g. 2026-2027
      capacity INTEGER DEFAULT 35,
      class_teacher_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(name, section, academic_year),
      FOREIGN KEY(class_teacher_id) REFERENCES users(id) ON DELETE SET NULL
    );

    -- Academic Subjects
    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,          -- e.g. MATH-101
      department TEXT NOT NULL,
      credits INTEGER DEFAULT 3,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Class Subject assignments (Teachers assigned to Subjects in Classes)
    CREATE TABLE IF NOT EXISTS class_subjects (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      teacher_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(class_id, subject_id),
      FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY(teacher_id) REFERENCES users(id) ON DELETE SET NULL
    );

    -- Parents / Guardians table
    CREATE TABLE IF NOT EXISTS parents (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE,
      full_name TEXT NOT NULL,
      relationship TEXT DEFAULT 'Parent',
      phone TEXT NOT NULL,
      email TEXT,
      occupation TEXT,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    -- Students table
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE,
      admission_number TEXT UNIQUE NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      date_of_birth DATE NOT NULL,
      gender TEXT CHECK(gender IN ('Male', 'Female', 'Other')) NOT NULL,
      blood_group TEXT,
      class_id TEXT NOT NULL,
      parent_id TEXT,
      address TEXT,
      emergency_contact TEXT,
      medical_notes TEXT,
      enrollment_date DATE NOT NULL,
      status TEXT CHECK(status IN ('Active', 'Graduated', 'Suspended', 'Withdrawn')) DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE RESTRICT,
      FOREIGN KEY(parent_id) REFERENCES parents(id) ON DELETE SET NULL
    );

    -- Teachers & Staff Details
    CREATE TABLE IF NOT EXISTS teachers (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      employee_id TEXT UNIQUE NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      qualification TEXT NOT NULL,
      department TEXT NOT NULL,
      designation TEXT NOT NULL,
      joining_date DATE NOT NULL,
      salary REAL DEFAULT 0.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Attendance Records (Strict unique constraint prevents duplicate attendance per student per date)
    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      date DATE NOT NULL,
      status TEXT CHECK(status IN ('Present', 'Absent', 'Late', 'Excused')) NOT NULL,
      remarks TEXT,
      recorded_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, date),
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY(recorded_by) REFERENCES users(id) ON DELETE SET NULL
    );

    -- Exams
    CREATE TABLE IF NOT EXISTS exams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,                -- e.g. Mid-Term Examination 2026
      term TEXT NOT NULL,                -- e.g. Term 1
      academic_year TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status TEXT CHECK(status IN ('Upcoming', 'Ongoing', 'Completed')) DEFAULT 'Upcoming',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Exam Schedules (Specific subject exam for a class)
    CREATE TABLE IF NOT EXISTS exam_schedules (
      id TEXT PRIMARY KEY,
      exam_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      exam_date DATE NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      max_marks REAL NOT NULL DEFAULT 100,
      pass_marks REAL NOT NULL DEFAULT 40,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(exam_id, class_id, subject_id),
      FOREIGN KEY(exam_id) REFERENCES exams(id) ON DELETE CASCADE,
      FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );

    -- Exam Results & Marks (With strict validation)
    CREATE TABLE IF NOT EXISTS exam_results (
      id TEXT PRIMARY KEY,
      exam_schedule_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      marks_obtained REAL NOT NULL,
      grade TEXT NOT NULL,
      remarks TEXT,
      recorded_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(exam_schedule_id, student_id),
      FOREIGN KEY(exam_schedule_id) REFERENCES exam_schedules(id) ON DELETE CASCADE,
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY(recorded_by) REFERENCES users(id) ON DELETE SET NULL
    );

    -- Fee Categories
    CREATE TABLE IF NOT EXISTS fee_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,                 -- e.g. Tuition Fee, Science Lab Fee, Sports Fee
      description TEXT,
      default_amount REAL NOT NULL,
      frequency TEXT CHECK(frequency IN ('Annual', 'Term', 'Monthly', 'One-Time')) DEFAULT 'Term',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Fee Invoices
    CREATE TABLE IF NOT EXISTS fee_invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT UNIQUE NOT NULL,
      student_id TEXT NOT NULL,
      fee_category_id TEXT NOT NULL,
      amount REAL NOT NULL,
      due_date DATE NOT NULL,
      status TEXT CHECK(status IN ('Pending', 'Partial', 'Paid', 'Overdue')) DEFAULT 'Pending',
      academic_year TEXT NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY(fee_category_id) REFERENCES fee_categories(id) ON DELETE RESTRICT
    );

    -- Fee Payments (Guarantees double-entry and transaction history)
    CREATE TABLE IF NOT EXISTS fee_payments (
      id TEXT PRIMARY KEY,
      payment_reference TEXT UNIQUE NOT NULL,
      invoice_id TEXT NOT NULL,
      amount_paid REAL NOT NULL,
      payment_date DATE NOT NULL,
      payment_method TEXT CHECK(payment_method IN ('Card', 'Bank Transfer', 'Cash', 'Online')) NOT NULL,
      transaction_id TEXT,
      notes TEXT,
      received_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(invoice_id) REFERENCES fee_invoices(id) ON DELETE RESTRICT,
      FOREIGN KEY(received_by) REFERENCES users(id) ON DELETE SET NULL
    );

    -- Announcements & Notice Board
    CREATE TABLE IF NOT EXISTS notices (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      priority TEXT CHECK(priority IN ('Normal', 'High', 'Urgent')) DEFAULT 'Normal',
      target_role TEXT CHECK(target_role IN ('All', 'Teachers', 'Parents', 'Students')) DEFAULT 'All',
      author_id TEXT,
      is_pinned INTEGER DEFAULT 0,
      expires_at DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE SET NULL
    );

    -- Immutable Audit Logs (Traceability for fault tolerance and compliance)
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      old_values TEXT,
      new_values TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- System Backups Register
    CREATE TABLE IF NOT EXISTS system_backups (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      backup_type TEXT CHECK(backup_type IN ('Automated', 'Manual')) DEFAULT 'Automated',
      status TEXT CHECK(status IN ('success', 'failed')) DEFAULT 'success',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- High performance Indexes
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
    CREATE INDEX IF NOT EXISTS idx_students_admission ON students(admission_number);
    CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, date);
    CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON attendance(class_id, date);
    CREATE INDEX IF NOT EXISTS idx_exam_results_student ON exam_results(student_id);
    CREATE INDEX IF NOT EXISTS idx_fee_invoices_student ON fee_invoices(student_id);
    CREATE INDEX IF NOT EXISTS idx_fee_invoices_status ON fee_invoices(status);
    CREATE INDEX IF NOT EXISTS idx_fee_payments_invoice ON fee_payments(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
  `;

  db.exec(schemaSql);
  console.log('[Database] Schema verified and initialized successfully.');
}

module.exports = {
  initializeSchema
};
