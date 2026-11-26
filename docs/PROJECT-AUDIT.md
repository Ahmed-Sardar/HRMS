# Northwind HRMS — Project Audit & Gap Analysis

Date: 22 November 2026
Scope: `client/` (React 18 + Vite) and `server/` (Express + MongoDB/Mongoose) as delivered in this repository.

This document records what existed **before** this implementation pass, what was missing against an
enterprise HRMS baseline, and the roadmap that was executed. The companion document
`docs/IMPLEMENTATION-REPORT.md` records what changed.

---

## 1. Existing architecture

| Layer | Technology | Notes |
| --- | --- | --- |
| Client | React 18, Vite 5, React Router 6, Redux Toolkit, React Hook Form + Zod, Axios, Tailwind + DaisyUI, Framer Motion, Lucide, Recharts (installed, unused) | 79 source files, one folder per module |
| Server | Node 18+, Express 4, Mongoose 8, JWT access + rotating refresh cookie, bcryptjs, Zod, Multer, Nodemailer, ExcelJS, json2csv, PDFKit | 93 source files, route + service per module |
| Data | MongoDB (Atlas connection string in `server/.env`) | 30 pre-existing models, no migrations (Mongoose `autoIndex`) |
| Auth | JWT (30m) + httpOnly refresh cookie (7d), lockout after failed attempts, password reset, session endpoint | RBAC via `authorize()` plus a role→permission matrix |
| Roles | `SUPER_ADMIN`, `ADMIN`, `HR`, `FINANCE`, `EMPLOYEE` | No separate `MANAGER` role; reporting manager is modelled on the employee record |
| Files | Local disk `server/uploads` via Multer | Path traversal guarded on document download |
| Exports | Excel, CSV, PDF streamed on demand | `server/src/utils/exports` |
| Tests | None | No test runner, no test files |

### Pre-existing modules verified end-to-end (page → API → controller/service → model)

| Module | State before this pass |
| --- | --- |
| Authentication, sessions, password reset | **COMPLETED** |
| User accounts, role change, activation | **COMPLETED** |
| Employees (CRUD, directory, self profile, status, email-change OTP flow, onboarding tasks, soft delete + permanent-delete tombstone) | **COMPLETED**, with a very basic offboarding endpoint |
| Departments & designations | **COMPLETED** |
| Attendance (check-in, multi-break, check-out, corrections with original-event trail, month calendar, org view, export) | **COMPLETED** |
| Shifts & holiday calendar | **COMPLETED** |
| Leave (apply, balance, overlap/working-day rules, approve/reject, cancel, calendar, export) | **COMPLETED** for a single approval stage |
| Performance reports (goals/KPIs, evidence attachment, Finance→HR state machine, history, exports) | **COMPLETED** |
| Goals / performance goals | **COMPLETED** (basic CRUD) |
| Payroll (structures, monthly run from attendance/leave, approval, payment reference, payslip PDF, exports) | **COMPLETED** except tax/statutory logic and full-and-final settlement |
| Reimbursements (receipt upload, finance review) | **COMPLETED** |
| Recruitment (jobs, candidates, resume upload, stages, interviews, feedback, hire → employee) | **COMPLETED** |
| Documents (upload, verify, expiry listing, download counter, audit) | **COMPLETED**; reminder scheduling absent |
| Assets (register, assign, return, retire, history) | **COMPLETED**; no maintenance log |
| Announcements, notifications (in-app + optional SMTP) | **COMPLETED** |
| Settings, role matrix, audit logs | **COMPLETED** |
| Dashboards per role | **COMPLETED** (stat cards + tables, no charts) |

---

## 2. Feature audit classifications (baseline)

### COMPLETED
Auth/session security, RBAC matrix, employees, departments/designations, attendance with breaks and
corrections, shifts, holidays, leave application/approval with balances, performance report workflow,
payroll run/payslips, reimbursements, recruitment, documents, assets, announcements, notifications,
settings, audit logs, dashboards, Excel/CSV/PDF exports.

### PARTIALLY COMPLETED
| Area | What existed | What was missing |
| --- | --- | --- |
| **Offboarding** | `POST /employees/:id/offboard` set last working day, reason, two booleans; `employmentStatus`, `dateOfExit`, `offboarding` fields | Resignation submission, notice-period logic, manager/HR approvals, withdrawal, exit interview, department clearances, asset clearance, F&F settlement, relieving/experience letters, separation completion and access revocation |
| Leave | Types configurable, accrual quota per year, carry-forward flag | Multi-stage approval, encashment, comp-off/maternity defaults, cancellation of approved leave, accrual/carry-forward job |
| Payroll | Salary structures, LOP, overtime, reimbursements in net pay | Statutory tax/compliance rules (intentionally not invented), salary revision history UI, F&F settlement |
| Attendance | Shifts, weekly offs, corrections | Work-from-home status, biometric/device ingestion, auto-absent scheduling job |
| Documents | Expiry listing endpoint | Scheduled expiry reminders/notifications |
| Assets | Status includes `IN_REPAIR` | Maintenance records, warranty alerts, exit-driven clearance link |
| Performance | Goals CRUD, report workflow | OKRs, peer review, self-assessment cycles, improvement plans, appraisal periods |
| Reports | Per-module exports | Cross-module reporting centre, headcount/attrition analytics, scheduled reports |

### NOT IMPLEMENTED (before this pass)
- Work From Home / remote-work management (no model, routes, policy, calendar or approvals).
- Employee helpdesk / HR ticketing (no tickets, assignment, priority, threads).
- Full employee separation lifecycle (resignation → clearance → settlement → letters).
- Training & learning management (programmes, enrolment, progress, certifications).
- Biometric device integration.
- Birthday / work-anniversary notifications.
- Automated reminder jobs (documents, approvals, onboarding).
- Automated tests and CI.

### NEEDS IMPROVEMENT
- UI was flat slate/white; gradients and glass were limited to the login page and sidebar. No shared
  design tokens for depth, blur, radii or motion.
- No explicit empty/loading/error visual language beyond defaults.
- Bank details and personal data rendered unmasked to every HR/finance viewer.
- Payroll/attendance calculations are server-side and correct, but no recalculation job for missed days.

### BROKEN
- No broken routes or failing builds were found. The repository had never been built or run
  (`README` states verification was syntax-only); the client production build was unverified.

---

## 3. Enterprise gap analysis and decisions

| Requirement | Decision in this pass |
| --- | --- |
| WFH requests, half/full day, approvals, calendar, attendance integration, limits | **Implemented** — new `WfhRequest` model, policy in company settings, manager→HR chain, WFH attendance status, payroll presence, calendar, CSV/Excel/PDF export |
| Employee exit lifecycle | **Implemented** — `ExitRequest` model, resignation + initiation, two-stage approval, withdrawal, clearances, asset return, exit interview, settlement, letters, status transition, user deactivation |
| Employee helpdesk | **Implemented** — `Ticket` model, categories, priorities, SLA target, assignment, threaded comments, status flow, exports |
| Notification coverage | Extended to WFH, tickets, resignations, clearances, settlement, letters; email still honours the existing SMTP setting |
| Liquid Glass design system | **Implemented** as a token + component layer so every existing page inherits it; new pages built on the same primitives |
| Training/LMS, OKR/peer review, biometric ingestion, scheduled reminders, report centre | **Not implemented** in this pass — documented in the implementation report as remaining work |

### Risks and constraints respected
- Existing collections and document shapes were extended additively; no destructive migration, no
  database reset, no renames of existing fields.
- New modules reuse the existing auth, validation, audit, notification, pagination and export helpers.
- Statutory tax rules were **not** invented; settlement uses documented, configurable inputs.
- Employee records are never deleted on exit; only status and access change.
