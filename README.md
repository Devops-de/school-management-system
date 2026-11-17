# 🏛️ The Vanguard Academy - World-Class School Management System

> **A robust, enterprise-grade, high-availability, fault-tolerant, and zero-inconsistency School Management Web Application built with Node.js, Express, SQLite (WAL Mode), and a modern reactive frontend.**

---

## 🌟 Key Architecture Pillars

### 1. High Availability (HA) & Clustering
- **Multi-Process Worker Pool (`cluster.js`)**: Spawns multiple worker processes supervised by a master process. Incoming HTTP requests are load-balanced across workers with zero downtime.
- **Automated Self-Healing & Resurrection**: If any worker crashes or suffers a fatal fault, the cluster supervisor automatically detects the death and spawns an immediate replacement worker within milliseconds.
- **Graceful Termination**: Handles `SIGTERM` and `SIGINT`, halts incoming requests, drains active HTTP sockets, checkpoints the database WAL log, and closes cleanly.

### 2. Fault Tolerance & Zero Inconsistency
- **SQLite with Write-Ahead Logging (WAL)**: `PRAGMA journal_mode = WAL` allows concurrent readers to query simultaneously while transactions write, avoiding lock contention and database corruption.
- **ACID Transaction Guarantees**: Multi-step business logic (such as recording fee payments, calculating exam GPA and class ranks, or bulk attendance marking) is enclosed in strict SQLite transactions (`db.transaction`).
- **Strict Referential Integrity**: `PRAGMA foreign_keys = ON` enforces relational constraints across students, parents, classes, subjects, marks, and invoices, eliminating orphaned or inconsistent records.
- **Automated Online Hot-Backups**: SQLite's native non-blocking `db.backup()` takes atomic snapshot copies to `data/backups/` periodically and on-demand without interrupting active users.
- **Database Health & Integrity Checks**: `/api/system/health` continuously evaluates `PRAGMA integrity_check` to verify database health.

### 3. Enterprise-Grade Security
- **Role-Based Access Control (RBAC)**: Fine-grained permissions across 5 distinct roles:
  1. `admin` (Principal / Super Administrator)
  2. `teacher` (Academic Faculty)
  3. `accountant` (Bursar & Finance Office)
  4. `student` (Learner)
  5. `parent` (Guardian)
- **Token Security**: Dual-mode JWT support (Authorization `Bearer <token>` and `HttpOnly`, `SameSite=lax` secure cookies).
- **Helmet Security Headers**: Content Security Policy (CSP), anti-clickjacking frameguards, and MIME-sniff protection.
- **Rate Limiting**: Multi-tiered rate limiters protecting against brute-force logins and denial-of-service attempts.
- **100% Prepared Statements**: All database operations use parametric bindings to eliminate SQL injection vulnerabilities.
- **Immutable Audit Trail**: Security actions, attendance marking, financial transactions, and credential changes are recorded in `audit_logs`.

---

## 🚀 World-Class Features

| Module | Description |
|---|---|
| **📊 Real-Time Dashboard** | Visual KPIs (Enrolled Students, Faculty, Daily Attendance %, Fee Collection Rate), live attendance trend bar chart, urgent notice feeds, and at-risk student alerts. |
| **🎓 Student Information System (SIS)** | Comprehensive student profiles with admission numbers, date of birth, blood group, parent links, emergency contacts, medical notes, attendance history gauge, and exam scorecards. |
| **👩‍🏫 Faculty Directory** | Staff profiles, departmental specializations, employee IDs, assigned classes, and credentials. |
| **🏫 Classrooms & Curriculum** | Grade level and section management, room allocations, student roster tracking, and subject-to-teacher mappings. |
| **📋 Smart Daily Attendance** | Date-based class register with 1-click **"Mark All Present"** bulk presets, individual overrides (Present, Absent, Late, Excused), and automatic **< 75% Chronic Absenteeism Watchlist**. |
| **📝 Exams & Official Report Cards** | Assessment terms, timetable scheduling, bulk gradebook marks entry with instant grade preview, and **official printable academic transcripts/report cards** with cumulative GPA, class rank, and principal evaluation. |
| **💳 Fee Management & Invoicing** | Tuition and lab fee structures, individual or class-wide batch invoice generation, payment recording with automatic balance recalculation, and **printable official bursar receipts**. |
| **📢 Campus Notice Board** | Broadcast circulars with priority tags (*Urgent Alert*, *High*, *Normal*), audience targeting (All, Teachers, Parents, Students), and pinned announcements. |
| **⚡ HA Diagnostics & Chaos Testing** | Real-time memory/CPU monitor, cluster PID and worker health, live hot-backup runner, backup archive history, and **Chaos Testing Sandbox** (simulates worker crash and auto-resurrection). |
| **🌟 Student & Parent Portal** | Personalized dashboard for students and parents displaying their individual grades, attendance percentages, pending invoices, and advisory contacts. |

---

## 🔑 Demo User Credentials

The application is pre-seeded with realistic records for immediate evaluation. You can log in directly or use the **"Simulate Persona"** dropdown in the top navigation bar to switch between roles instantly:

| Role | Email / Login | Password | Simulated Persona |
|---|---|---|---|
| **Admin** | `admin@school.edu` | `Admin@123` | Dr. Marcus Sterling (Principal) |
| **Teacher** | `teacher@school.edu` | `Teacher@123` | Dr. Sarah Jenkins (Head of Math) |
| **Accountant** | `accountant@school.edu` | `Accountant@123` | Emma Roberts, CPA (Bursar) |
| **Student** | `student@school.edu` | `Student@123` | Lucas Vance (Grade 10-A) |
| **Parent** | `parent@school.edu` | `Parent@123` | Robert Vance (Guardian) |

---

## 💻 Quick Start & Running the Server

### Prerequisites
- Node.js (v18+ or later)
- npm

### 1. Launch the High-Availability Multi-Worker Cluster (Recommended for Production)
```bash
npm start
```
*Spawns the Cluster Supervisor and multiple self-healing worker processes.*

### 2. Or Launch Standalone Development Server
```bash
npm run dev
```

### 3. Open in Browser
Navigate to:
```
http://localhost:3000
```

### 4. Other Available Commands
- **Re-seed Demo Data**: `npm run seed`
- **Verify Database Integrity**: `npm test`

---

## 📁 Project Architecture

```
School managment sytem/
├── config/
│   └── index.js              # Environment settings, port, JWT secrets, rates
├── database/
│   ├── db.js                 # SQLite connection, WAL mode, foreign keys, PRAGMAs
│   ├── schema.js             # DDL definitions, constraints, check rules, indexes
│   ├── seed.js               # Enterprise demo records & ACID seed transaction
│   └── backupService.js      # Online hot-backup engine and scheduler
├── middleware/
│   ├── auth.js               # JWT verification & RBAC authorization
│   ├── rateLimiter.js        # Global, auth, and heavy-operation rate limiters
│   ├── errorHandler.js       # Global fault-tolerant error boundary
│   └── audit.js              # Immutable audit event logger
├── routes/
│   ├── authRoutes.js         # Authentication, session info, password updates
│   ├── studentRoutes.js      # Student Information System CRUD
│   ├── teacherRoutes.js      # Faculty directory and profiles
│   ├── classRoutes.js        # Classrooms, sections, subjects
│   ├── attendanceRoutes.js   # Daily attendance, stats, absenteeism watchlist
│   ├── examRoutes.js         # Exams, schedules, gradebook, report cards
│   ├── feeRoutes.js          # Invoices, fee structures, payments, receipts
│   ├── noticeRoutes.js       # Campus announcements and circulars
│   ├── auditRoutes.js        # Audit trail logs
│   └── systemRoutes.js       # Health, metrics, hot-backups, chaos testing
├── public/
│   ├── css/
│   │   └── style.css         # Modern academic design system & glassmorphism
│   ├── js/
│   │   ├── api.js            # API client abstraction with token management
│   │   ├── app.js            # Router, state, modals, quick role switcher
│   │   ├── dashboard.js      # KPI cards, charts, activity feeds
│   │   ├── students.js       # SIS view and student profile dossier
│   │   ├── teachers.js       # Faculty directory view
│   │   ├── classes.js        # Classrooms, rosters, and subjects
│   │   ├── attendance.js     # Daily attendance sheet & bulk check-in
│   │   ├── exams.js          # Assessment gradebook & printable report cards
│   │   ├── fees.js           # Invoicing, payments, and printable receipts
│   │   ├── notices.js        # Notice board view
│   │   ├── system.js         # HA diagnostics, backups, chaos test sandbox
│   │   └── portal.js         # Student & Parent personalized workspace
│   └── index.html            # Single Page Application layout
├── cluster.js                # Multi-process supervisor with auto-resurrection
├── server.js                 # Express server configuration & graceful shutdown
├── package.json              # Dependencies and lifecycle scripts
└── README.md                 # Complete documentation
```

---

## 🛡️ Chaos & Fault Tolerance Verification

To experience the system's fault tolerance in action:
1. Open the **"High-Availability & HA"** tab in the sidebar.
2. Under the **Chaos & Fault-Tolerance Verification Sandbox**, click **"💥 Simulate Sudden Worker Crash"**.
3. Watch the terminal output as the worker process deliberately terminates.
4. The Master Cluster Supervisor detects the exit in milliseconds and resurrects a replacement worker immediately—your connection stays alive with **zero downtime**!
