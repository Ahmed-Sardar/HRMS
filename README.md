# Northwind HRMS

Enterprise Human Resource Management System built with the MERN stack. It covers the full employee lifecycle: organisation setup, onboarding, attendance with breaks, leave, work-from-home with manager/HR approval, performance reporting with a Finance → HR approval workflow, payroll, reimbursements, recruitment, an employee helpdesk, a complete resignation-to-relief exit workflow, documents, assets, announcements, notifications and audit logs. The client uses a shared Liquid Glass design system (translucent surfaces, layered depth, gradient accents) so every module looks and behaves consistently.

- **Client:** React 18 + Vite + Tailwind CSS + DaisyUI + React Router + Redux Toolkit + React Hook Form + Zod + Axios + Lucide + Framer Motion
- **Server:** Node.js + Express + MongoDB (Mongoose) + JWT (access + rotating refresh cookie) + bcryptjs + Multer + Nodemailer + ExcelJS + json2csv + PDFKit

## Repository layout

```
HRMS/
├── client/                  # Vite React application
│   └── src/
│       ├── components/      # UI kit (Card, DataTable, Modal, Field, Badge, ...)
│       ├── hooks/           # useAuth, useFetch
│       ├── layouts/         # AppLayout (sidebar + topbar)
│       ├── pages/           # one folder per module
│       ├── services/        # Axios API clients per module
│       ├── store/           # Redux Toolkit slices (auth, ui)
│       └── utils/           # constants, formatting, navigation, cn
└── server/                  # Express REST API
    └── src/
        ├── config/          # env, db, constants, role→permission matrix
        ├── middleware/      # auth, authorize, validate, upload, error, rate limit
        ├── models/          # 33 Mongoose models
        ├── modules/         # route + service per feature
        ├── services/        # settings, notifications, employee helpers
        ├── utils/           # ApiError, asyncHandler, audit, mail, exports
        └── seed/            # idempotent demo data seeder
```

## Prerequisites

- Node.js 18+
- MongoDB running locally (or a connection string to a MongoDB Atlas cluster)

## Setup

### 1. Server

```bash
cd server
cp .env.example .env      # Windows: copy .env.example .env
npm install
npm run seed              # creates roles, settings, demo users and sample data
npm run dev               # http://localhost:5000
```

`npm run seed` is safe to re-run; it upserts demo records and resets the demo passwords.

### 2. Client

```bash
cd client
cp .env.example .env      # optional, leave VITE_API_URL empty to use the dev proxy
npm install
npm run dev               # http://localhost:5173
```

The Vite dev server proxies `/api` to `http://localhost:5000`, so no CORS configuration is needed in development.

### Demo accounts

All seeded accounts use the password **`Admin@12345`**.

| Role | Email |
| --- | --- |
| Super Admin | `superadmin@hrms.com` |
| Admin | `admin@hrms.com` |
| HR | `hr@hrms.com` |
| Finance | `finance@hrms.com` |
| Employee | `employee@hrms.com` |

Seeded company settings: Northwind Technologies, Asia/Kolkata, working days Monday–Friday, 09:00–18:00, 15 minute grace period, 480 minute full day.

## Environment variables

### `server/.env`

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `development` / `production` |
| `PORT` | API port (default `5000`) |
| `API_PREFIX` | Route prefix (default `/api`) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Signing secrets — replace in production |
| `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | Token lifetimes (`30m`, `7d`) |
| `CLIENT_URL`, `CORS_ORIGINS` | Allowed browser origins |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Optional SMTP; emails are logged to the console when unset |
| `UPLOAD_DIR`, `MAX_FILE_SIZE_MB` | Upload storage folder and per-file limit |
| `RATE_LIMIT_WINDOW_MINUTES`, `RATE_LIMIT_MAX` | API rate limiting |

### `client/.env`

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | API base URL. Leave empty to use the Vite proxy; set to e.g. `http://localhost:5000/api` when serving the client separately |

## Roles and permissions

Five roles are supported: `SUPER_ADMIN`, `ADMIN`, `HR`, `FINANCE`, `EMPLOYEE`. The permission matrix lives in `server/src/config/permissions.js` and is enforced by `authorize(...roles)` and `requirePermission` middleware on every protected route. The client mirrors the same rules through `RoleGate` route guards and role-filtered navigation — the API is always the source of truth.

| Area | Super Admin | Admin | HR | Finance | Employee |
| --- | --- | --- | --- | --- | --- |
| Dashboard | ✔ | ✔ | ✔ | ✔ | ✔ |
| Employees & organisation | ✔ | ✔ | ✔ | read | self |
| User accounts | ✔ | ✔ | — | — | — |
| Attendance (self) | ✔ | ✔ | ✔ | ✔ | ✔ |
| Attendance records / corrections review | ✔ | ✔ | ✔ | — | own requests |
| Shifts | ✔ | ✔ | — | — | — |
| Holidays | ✔ | ✔ | ✔ | ✔ | view |
| Leave approvals | ✔ | ✔ | ✔ | — | own requests |
| Performance reports | ✔ | ✔ | ✔ | ✔ | own |
| Finance verification queue | ✔ | — | — | ✔ | — |
| HR review queue | ✔ | — | ✔ | — | — |
| Payroll register & salary structures | ✔ | — | view structures | ✔ | own payslips |
| Reimbursements review | ✔ | — | — | ✔ | own claims |
| Recruitment | ✔ | ✔ | ✔ | — | — |
| Documents | ✔ | ✔ | ✔ | — | own |
| Assets | ✔ | ✔ | ✔ | register | own |
| Announcements | manage | manage | manage | read | read |
| Settings & audit logs | ✔ | — | — | — | — |

## Performance report workflow

1. The employee creates a report (period, goals, KPIs, tasks, narratives) and optionally attaches Excel/CSV evidence.
2. `SUBMIT` moves it to `SUBMITTED`; the report is snapshotted against server-side attendance and leave data (`preview` endpoint).
3. **Finance** verifies the data: `START_FINANCE_REVIEW` → `FINANCE_APPROVE` / `FINANCE_REJECT` / `FINANCE_REQUEST_CORRECTION`, then `FORWARD_TO_HR`.
4. **HR** reviews and can add manager feedback: `START_HR_REVIEW` → `HR_APPROVE` / `HR_REJECT` / `HR_REQUEST_INFO` / `FORWARD_TO_MANAGER`, then `COMPLETE`.
5. Every transition is validated by a single state machine (`transitionReport`), written to `ReportApprovalHistory` and the audit log, and notifies the relevant users. Self-approval is blocked.

Statuses: `DRAFT`, `SUBMITTED`, `UNDER_FINANCE_REVIEW`, `FINANCE_APPROVED`, `FINANCE_REJECTED`, `CORRECTION_REQUESTED`, `FORWARDED_TO_HR`, `UNDER_HR_REVIEW`, `HR_APPROVED`, `HR_REJECTED`, `COMPLETED`.

## Attendance, breaks and working hours

- Check-in, break start/end, check-out and resume are recorded as events; `breaks[]` keeps every segment plus an immutable `originalEvents` trail.
- Working minutes, break minutes, effective minutes, late marks, half days and overtime are calculated **only on the server** using company settings and the assigned shift.
- Employees can request corrections inside the configured window; HR/Admin approve or reject them, and approved corrections rewrite the attendance record with a `CORRECTION` source and a full audit entry.

## Payroll

- Salary structures define basic, HRA, allowances and deductions; creating a new structure deactivates the previous one.
- `POST /api/payroll/run` computes, per employee, working days, present units, paid leave, loss of pay, overtime and approved reimbursements using company settings (no hardcoded formulas), then creates/updates `DRAFT` records.
- Approving a record generates an immutable payslip snapshot and notifies the employee; marking it paid records the payment reference. Payroll months can be approved in bulk.
- Payslips are rendered as PDFs on demand.

## Exports

Exports are generated on demand and streamed to the browser (nothing is persisted on the server):

- **Excel (`.xlsx`)**, **CSV** and **PDF** for performance reports, payroll registers and the finance summary.
- Payslip PDFs, document and report-attachment downloads.
- All export helpers live in `server/src/utils/exports/` and share the `sendExport` facade.

## API surface (summary)

All routes are mounted under `/api` and require a bearer token except `auth` and `health`.

| Prefix | Highlights |
| --- | --- |
| `/auth` | login, refresh (httpOnly cookie rotation), logout, forgot/reset password, session |
| `/users` | account CRUD, role change, status, password reset |
| `/employees` | list, options, detail, create/update, status, offboard, onboarding tasks, self profile |
| `/departments`, `/designations` | organisation masters |
| `/attendance` | check-in/out, breaks, my records, records, corrections, today, summary |
| `/shifts`, `/holidays` | shift and holiday configuration |
| `/leaves` | apply, my requests, approvals, calendar, balances |
| `/wfh` | policy, apply, my requests, team queue, approvals, calendar, export |
| `/helpdesk` | raise tickets, my tickets, support queue, assignment, comments, status, stats, export |
| `/exits` | resign, initiate exit, approvals, clearances, asset return, exit interview, settlement, letters, export |
| `/performance` | reports CRUD, submit, preview, exports, attachments, goals |
| `/finance` | verification queue, review actions, reimbursements, dashboard, summary export |
| `/hr` | HR queue, review actions, manager feedback, dashboard |
| `/payroll` | structures, run, approve, pay, payslip PDF, exports, my payslips/reimbursements |
| `/recruitment` | jobs, candidates (+resume), stage moves, interviews, feedback, hire |
| `/documents` | upload, list, download, verify, expiring |
| `/assets` | register, my assets, assign, return, retire |
| `/notifications`, `/announcements` | inbox, unread count, mark read, announcement management |
| `/settings` | company settings, roles matrix, audit logs, my activity |
| `/dashboard` | role-aware summary payload |

## Documentation and verification

- `docs/PROJECT-AUDIT.md` — baseline feature audit, classifications and enterprise gap analysis.
- `docs/IMPLEMENTATION-REPORT.md` — what was implemented, API surface, verified checks, remaining work and an honest completion assessment.
- Verification in this pass: `node --check` across the server, a full module-load check (`app` + all route modules + 33 models) and a passing client production build (`npm run build`). A live API run was blocked because the configured MongoDB Atlas cluster refused the connection from this host (IP not whitelisted).

## Notes and limitations

- The original delivery skipped builds and tests; that has since been superseded by the checks above.
- Payroll does not implement statutory tax rules; deductions are configurable salary components, and full-and-final settlement values are explicit and editable.
- Work-from-home limits, approval chain and advance booking window are configurable in Company settings.
- Uploaded files are stored on the local filesystem (`server/uploads`) via Multer; use object storage if you deploy to ephemeral infrastructure.
- Email delivery requires SMTP credentials; without them, mail is logged to the console so flows stay testable.
- `recharts` is installed for future charting; dashboards currently use stat cards, tables and progress indicators to stay within scope.
