const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('./db');
const { initializeSchema } = require('./schema');

async function seedData() {
  const db = getDb();
  initializeSchema();

  // Check if users already seeded
  const userCount = db.prepare('SELECT count(*) as count FROM users').get().count;
  if (userCount > 0) {
    console.log('[Seed] Database already contains data. Skipping initial seeding.');
    return;
  }

  console.log('[Seed] Seeding world-class demo data...');

  const passwordHash = await bcrypt.hash('Admin@123', 10);
  const teacherHash = await bcrypt.hash('Teacher@123', 10);
  const studentHash = await bcrypt.hash('Student@123', 10);
  const parentHash = await bcrypt.hash('Parent@123', 10);
  const accountantHash = await bcrypt.hash('Accountant@123', 10);

  // Wrap all seeding in a single ACID transaction for fault-tolerance
  const seedTransaction = db.transaction(() => {
    // 1. Create Central Users
    const adminId = 'usr_admin_001';
    const teacher1Id = 'usr_teacher_001';
    const teacher2Id = 'usr_teacher_002';
    const accountantId = 'usr_acct_001';
    const student1Id = 'usr_student_001';
    const parent1Id = 'usr_parent_001';

    const insertUser = db.prepare(`
      INSERT INTO users (id, username, email, password_hash, role, full_name, phone, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
    `);

    insertUser.run(adminId, 'admin', 'admin@school.edu', passwordHash, 'admin', 'Dr. Marcus Sterling (Principal)', '+1 (555) 010-0001');
    insertUser.run(teacher1Id, 'teacher1', 'teacher@school.edu', teacherHash, 'teacher', 'Dr. Sarah Jenkins', '+1 (555) 010-0002');
    insertUser.run(teacher2Id, 'teacher2', 'teacher2@school.edu', teacherHash, 'teacher', 'Prof. Michael Chen', '+1 (555) 010-0003');
    insertUser.run(accountantId, 'accountant', 'accountant@school.edu', accountantHash, 'accountant', 'Emma Roberts, CPA', '+1 (555) 010-0004');
    insertUser.run(student1Id, 'student1', 'student@school.edu', studentHash, 'student', 'Lucas Vance', '+1 (555) 010-0005');
    insertUser.run(parent1Id, 'parent1', 'parent@school.edu', parentHash, 'parent', 'Robert Vance', '+1 (555) 010-0006');

    // 2. Teachers Details
    const insertTeacher = db.prepare(`
      INSERT INTO teachers (id, user_id, employee_id, first_name, last_name, qualification, department, designation, joining_date, salary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const t1Id = 'tch_001';
    const t2Id = 'tch_002';
    insertTeacher.run(t1Id, teacher1Id, 'EMP-1001', 'Sarah', 'Jenkins', 'Ph.D. Applied Mathematics', 'Mathematics', 'Head of Department', '2020-08-15', 85000);
    insertTeacher.run(t2Id, teacher2Id, 'EMP-1002', 'Michael', 'Chen', 'M.Sc. Physics & Robotics', 'Sciences', 'Senior Lecturer', '2021-09-01', 78000);

    // 3. Classes
    const insertClass = db.prepare(`
      INSERT INTO classes (id, name, grade_level, section, room_number, academic_year, capacity, class_teacher_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const class10A = 'cls_10A';
    const class10B = 'cls_10B';
    const class11Sci = 'cls_11SCI';
    const class12Hon = 'cls_12HON';

    insertClass.run(class10A, 'Grade 10', 10, 'A', 'Wing B - Rm 301', '2026-2027', 30, teacher1Id);
    insertClass.run(class10B, 'Grade 10', 10, 'B', 'Wing B - Rm 302', '2026-2027', 30, teacher2Id);
    insertClass.run(class11Sci, 'Grade 11 - STEM', 11, 'Science', 'Lab Complex 102', '2026-2027', 28, teacher2Id);
    insertClass.run(class12Hon, 'Grade 12 - Honors', 12, 'AP', 'Main Quad - Rm 405', '2026-2027', 25, teacher1Id);

    // 4. Subjects
    const insertSubject = db.prepare(`
      INSERT INTO subjects (id, name, code, department, credits, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const subMath = 'sub_math';
    const subPhys = 'sub_phys';
    const subEng = 'sub_eng';
    const subCs = 'sub_cs';
    const subChem = 'sub_chem';

    insertSubject.run(subMath, 'Advanced Mathematics', 'MATH-101', 'Mathematics', 4, 'Calculus, Vectors, and Statistics');
    insertSubject.run(subPhys, 'Physics & Mechanics', 'PHY-201', 'Sciences', 4, 'Newtonian Mechanics and Thermodynamics');
    insertSubject.run(subEng, 'World Literature & Rhetoric', 'ENG-101', 'Humanities', 3, 'Critical Analysis and Advanced Writing');
    insertSubject.run(subCs, 'Computer Science & AI', 'CS-301', 'Technology', 4, 'Algorithms, Python, and AI Fundamentals');
    insertSubject.run(subChem, 'Chemistry & Lab Sciences', 'CHEM-201', 'Sciences', 4, 'Organic Chemistry and Molecular Dynamics');

    // 5. Class Subjects
    const insertClassSub = db.prepare(`
      INSERT INTO class_subjects (id, class_id, subject_id, teacher_id)
      VALUES (?, ?, ?, ?)
    `);
    insertClassSub.run('cs_1', class10A, subMath, teacher1Id);
    insertClassSub.run('cs_2', class10A, subPhys, teacher2Id);
    insertClassSub.run('cs_3', class10A, subEng, teacher1Id);
    insertClassSub.run('cs_4', class10A, subCs, teacher2Id);
    insertClassSub.run('cs_5', class10A, subChem, teacher2Id);

    insertClassSub.run('cs_6', class10B, subMath, teacher1Id);
    insertClassSub.run('cs_7', class10B, subPhys, teacher2Id);

    // 6. Parents
    const insertParent = db.prepare(`
      INSERT INTO parents (id, user_id, full_name, relationship, phone, email, occupation, address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const p1Id = 'par_001';
    insertParent.run(p1Id, parent1Id, 'Robert Vance', 'Father', '+1 (555) 010-0006', 'parent@school.edu', 'Senior Software Architect', '742 Evergreen Terrace, Springfield');

    // 7. Students
    const insertStudent = db.prepare(`
      INSERT INTO students (id, user_id, admission_number, first_name, last_name, date_of_birth, gender, blood_group, class_id, parent_id, address, emergency_contact, medical_notes, enrollment_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')
    `);

    const students = [
      { id: 'stu_001', userId: student1Id, adm: 'ADM-2026-001', fn: 'Lucas', ln: 'Vance', dob: '2010-04-12', gender: 'Male', bg: 'O+', cls: class10A, par: p1Id, em: '+1 (555) 010-0006 (Father)', med: 'No known allergies' },
      { id: 'stu_002', userId: null, adm: 'ADM-2026-002', fn: 'Sophia', ln: 'Patel', dob: '2010-08-23', gender: 'Female', bg: 'A+', cls: class10A, par: null, em: '+1 (555) 912-3344', med: 'Asthma (inhaler in locker)' },
      { id: 'stu_003', userId: null, adm: 'ADM-2026-003', fn: 'Liam', ln: 'Johnson', dob: '2010-02-15', gender: 'Male', bg: 'B+', cls: class10A, par: null, em: '+1 (555) 432-1199', med: 'Peanut allergy' },
      { id: 'stu_004', userId: null, adm: 'ADM-2026-004', fn: 'Olivia', ln: 'Martinez', dob: '2010-11-05', gender: 'Female', bg: 'AB+', cls: class10A, par: null, em: '+1 (555) 778-9922', med: 'None' },
      { id: 'stu_005', userId: null, adm: 'ADM-2026-005', fn: 'Ethan', ln: 'Davis', dob: '2010-06-30', gender: 'Male', bg: 'O-', cls: class10A, par: null, em: '+1 (555) 661-8844', med: 'Mild lactose intolerance' },
      { id: 'stu_006', userId: null, adm: 'ADM-2026-006', fn: 'Ava', ln: 'Williams', dob: '2010-09-18', gender: 'Female', bg: 'A-', cls: class10B, par: null, em: '+1 (555) 334-7711', med: 'None' },
      { id: 'stu_007', userId: null, adm: 'ADM-2026-007', fn: 'Noah', ln: 'Brown', dob: '2009-12-10', gender: 'Male', bg: 'B-', cls: class11Sci, par: null, em: '+1 (555) 882-9900', med: 'None' },
      { id: 'stu_008', userId: null, adm: 'ADM-2026-008', fn: 'Emma', ln: 'Taylor', dob: '2008-05-14', gender: 'Female', bg: 'O+', cls: class12Hon, par: null, em: '+1 (555) 112-4455', med: 'None' }
    ];

    for (const s of students) {
      insertStudent.run(
        s.id, s.userId, s.adm, s.fn, s.ln, s.dob, s.gender, s.bg, s.cls, s.par,
        'Metro City, School District 5', s.em, s.med, '2026-01-10'
      );
    }

    // 8. Attendance Records (10 days of attendance for Class 10A students)
    const insertAtt = db.prepare(`
      INSERT INTO attendance (id, student_id, class_id, date, status, remarks, recorded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const days = [
      '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07',
      '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14'
    ];

    const statuses = ['Present', 'Present', 'Present', 'Present', 'Late', 'Present', 'Absent', 'Present', 'Excused', 'Present'];

    students.filter(s => s.cls === class10A).forEach((st, sIdx) => {
      days.forEach((date, dIdx) => {
        let status = 'Present';
        if ((dIdx + sIdx) % 7 === 0) status = 'Late';
        else if ((dIdx + sIdx) % 11 === 0) status = 'Absent';
        else if ((dIdx + sIdx) % 13 === 0) status = 'Excused';

        insertAtt.run(
          `att_${st.id}_${date}`,
          st.id,
          class10A,
          date,
          status,
          status !== 'Present' ? `Recorded note for ${status.toLowerCase()} status` : 'On time',
          teacher1Id
        );
      });
    });

    // 9. Exams & Results
    const insertExam = db.prepare(`
      INSERT INTO exams (id, name, term, academic_year, start_date, end_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const examMidterm = 'ex_mid_2026';
    const examFinal = 'ex_fin_2026';
    insertExam.run(examMidterm, 'Mid-Term Academic Assessment 2026', 'Term 1', '2026-2027', '2026-10-15', '2026-10-25', 'Completed');
    insertExam.run(examFinal, 'Final Semester Board Examination', 'Term 2', '2026-2027', '2026-12-10', '2026-12-22', 'Upcoming');

    const insertSchedule = db.prepare(`
      INSERT INTO exam_schedules (id, exam_id, class_id, subject_id, exam_date, start_time, end_time, max_marks, pass_marks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const schedMath = 'sch_math_10a';
    const schedPhys = 'sch_phys_10a';
    const schedCs   = 'sch_cs_10a';
    const schedEng  = 'sch_eng_10a';

    insertSchedule.run(schedMath, examMidterm, class10A, subMath, '2026-10-16', '09:00', '12:00', 100, 40);
    insertSchedule.run(schedPhys, examMidterm, class10A, subPhys, '2026-10-18', '09:00', '12:00', 100, 40);
    insertSchedule.run(schedCs,   examMidterm, class10A, subCs,   '2026-10-20', '09:00', '12:00', 100, 40);
    insertSchedule.run(schedEng,  examMidterm, class10A, subEng,  '2026-10-22', '09:00', '12:00', 100, 40);

    const insertResult = db.prepare(`
      INSERT INTO exam_results (id, exam_schedule_id, student_id, marks_obtained, grade, remarks, recorded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    function calculateGrade(marks) {
      if (marks >= 90) return 'A+';
      if (marks >= 80) return 'A';
      if (marks >= 70) return 'B';
      if (marks >= 60) return 'C';
      if (marks >= 50) return 'D';
      return 'F';
    }

    const marksMap = {
      'stu_001': { math: 94, phys: 88, cs: 96, eng: 89 },
      'stu_002': { math: 85, phys: 91, cs: 84, eng: 92 },
      'stu_003': { math: 76, phys: 72, cs: 80, eng: 74 },
      'stu_004': { math: 98, phys: 95, cs: 99, eng: 96 },
      'stu_005': { math: 68, phys: 64, cs: 75, eng: 70 }
    };

    for (const [stId, scores] of Object.entries(marksMap)) {
      insertResult.run(uuidv4(), schedMath, stId, scores.math, calculateGrade(scores.math), 'Excellent analytical mastery', teacher1Id);
      insertResult.run(uuidv4(), schedPhys, stId, scores.phys, calculateGrade(scores.phys), 'Solid conceptual grasp', teacher2Id);
      insertResult.run(uuidv4(), schedCs, stId, scores.cs, calculateGrade(scores.cs), 'High problem solving competence', teacher2Id);
      insertResult.run(uuidv4(), schedEng, stId, scores.eng, calculateGrade(scores.eng), 'Articulate essay composition', teacher1Id);
    }

    // 10. Fee Categories & Invoices
    const insertFeeCat = db.prepare(`
      INSERT INTO fee_categories (id, name, description, default_amount, frequency)
      VALUES (?, ?, ?, ?, ?)
    `);
    const feeTuition = 'fee_tuition';
    const feeLab = 'fee_lab';
    const feeTransport = 'fee_transport';
    insertFeeCat.run(feeTuition, 'Semester Tuition Fee', 'Standard tuition and academic facility access', 2500, 'Term');
    insertFeeCat.run(feeLab, 'STEM & Robotics Lab Fee', 'Consumables, high-performance computing, and equipment', 350, 'Term');
    insertFeeCat.run(feeTransport, 'Campus Express Transport', 'Dedicated GPS tracked route bus service', 280, 'Monthly');

    const insertInvoice = db.prepare(`
      INSERT INTO fee_invoices (id, invoice_number, student_id, fee_category_id, amount, due_date, status, academic_year, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const inv1 = 'inv_001';
    const inv2 = 'inv_002';
    const inv3 = 'inv_003';
    const inv4 = 'inv_004';

    insertInvoice.run(inv1, 'INV-2026-0001', 'stu_001', feeTuition, 2500, '2026-11-30', 'Paid', '2026-2027', 'Fall Semester Tuition');
    insertInvoice.run(inv2, 'INV-2026-0002', 'stu_001', feeLab, 350, '2026-11-30', 'Paid', '2026-2027', 'Lab & Computer access');
    insertInvoice.run(inv3, 'INV-2026-0003', 'stu_002', feeTuition, 2500, '2026-12-15', 'Partial', '2026-2027', 'Fall Semester Tuition');
    insertInvoice.run(inv4, 'INV-2026-0004', 'stu_003', feeTuition, 2500, '2026-11-20', 'Pending', '2026-2027', 'Fall Semester Tuition');

    // 11. Payments
    const insertPayment = db.prepare(`
      INSERT INTO fee_payments (id, payment_reference, invoice_id, amount_paid, payment_date, payment_method, transaction_id, notes, received_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertPayment.run(uuidv4(), 'PAY-2026-001', inv1, 2500, '2026-11-02', 'Online', 'TXN-STRIPE-882199', 'Full settlement via student portal', accountantId);
    insertPayment.run(uuidv4(), 'PAY-2026-002', inv2, 350, '2026-11-02', 'Card', 'TXN-POS-44120', 'Paid at bursar desk', accountantId);
    insertPayment.run(uuidv4(), 'PAY-2026-003', inv3, 1500, '2026-11-05', 'Bank Transfer', 'WIRE-ACH-991244', '1st installment payment', accountantId);

    // 12. Notices
    const insertNotice = db.prepare(`
      INSERT INTO notices (id, title, content, priority, target_role, author_id, is_pinned, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertNotice.run(
      'not_001',
      'International STEM & Robotics Exhibition 2026',
      'Our school has been selected to host the Regional Robotics & STEM Cup. Registrations for student teams are now open in the Science department.',
      'High',
      'All',
      adminId,
      1,
      '2026-12-31'
    );

    insertNotice.run(
      'not_002',
      'Mid-Term Assessment Report Cards Published',
      'Official report cards for the Mid-Term Assessment 2026 are now finalized and available for download. Parents are invited to schedule review appointments.',
      'Urgent',
      'All',
      adminId,
      1,
      '2026-12-15'
    );

    insertNotice.run(
      'not_003',
      'Parent-Teacher Association General Meeting',
      'The biannual PTA meeting will take place in the Main Auditorium on Friday, November 28th at 4:30 PM. Agenda includes curriculum updates and campus safety.',
      'Normal',
      'Parents',
      adminId,
      0,
      '2026-11-29'
    );

    // 13. Initial Audit Logs
    const insertAudit = db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, entity, entity_id, new_values, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertAudit.run(uuidv4(), adminId, 'SYSTEM_INITIALIZATION', 'System', 'CORE', 'System initialized with high-availability configuration', '127.0.0.1');
    insertAudit.run(uuidv4(), accountantId, 'RECORD_PAYMENT', 'FeePayment', inv1, 'Recorded full payment of $2500 for Lucas Vance', '127.0.0.1');
  });

  seedTransaction();
  console.log('[Seed] Database seeded successfully with enterprise demo records!');
}

if (require.main === module) {
  seedData()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[Seed] Error during seeding:', err);
      process.exit(1);
    });
}

module.exports = { seedData };
