# Reports — reliable persisted metrics

**Not a second reporting system.** Admin `/admin/reports` uses `portal-module-reports` aggregates. Officer funnel remains on `/staff/reports` (`portal-reports`). Remote M1–M4 apply on `gjasuvlqfofpvrqvvnyz` is **unconfirmed**.

## Implemented report groups (code)

| Group           | Source tables (aggregates only)                                                        | Auth gate                         |
| --------------- | -------------------------------------------------------------------------------------- | --------------------------------- |
| Student journey | `students` (stage, created_at, assigned_consultant_id); handovers for admission owners | students / manager / admin        |
| Admissions      | `applications.stage`, `student_documents` pending_review, `offers`, `visa_milestones`  | admissions / documents            |
| Finance         | `signup_fee_payments` statuses; `university_fee_obligations` by kind+status            | fees/banking edit+                |
| HR              | `hr_attendance_records`, `hr_leave_requests`; `hr_employees` summary (restricted)      | hr_attendance                     |
| Marketing       | `consultation_requests` + campaigns; email∩students for conversion                     | digital marketing / students view |
| Office Ops      | `ops_purchase_orders`, stock receive movements, ops sales, ops expenses                | office ops / expense view         |

## Filters

- Timeframe or explicit start/end dates
- Journey stage, assigned staff (`assigned_consultant_id`), campaign id (marketing inquiries)

## Display rules

- Every metric from persisted rows under RLS
- Conversion / stock / expense sections use **N/A** when unauthorized or query blocked — never invent zero
- Claimed payments ≠ verified
- Ops sales/expenses ≠ student tuition / signup / university fees
- CSV/Excel export: authorized sections only; formula-injection sanitization (`sanitizeSpreadsheetCell` / `escapeCsvCell`)

## Do not invent

- Campaign ROI, ad spend, revenue attribution
- Tuition collected from ops tables
- Demo monthly stats on admin Reports (removed)

## Migration dependency order (owner apply — not verified remote)

1. M1 intake / profile / signup fees
2. M2 university finance
3. M3 HR (`…40000`, `…41000`)
4. M3 Marketing (`…50000`, `…51000`)
5. M4 Office Ops (`…60000`)

Owner docs: `MILESTONE*-OWNER-APPLY.md`. Local files ≠ remote proof.

## Blockers

1. Remote migrations not confirmed applied — follow [`M1-M4-OWNER-RUNBOOK.md`](./M1-M4-OWNER-RUNBOOK.md).
2. Marketing conversion needs student email read under RLS.
3. Ops / HR sections empty or “unavailable” until M3/M4 tables exist on the project.
4. Live acceptance: [`CLIENT-ACCEPTANCE-CHECKLIST.md`](./CLIENT-ACCEPTANCE-CHECKLIST.md) (not executed by engineering without remote Auth).
