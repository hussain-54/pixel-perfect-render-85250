# Portal workflow audit (code + repo docs)

**Date:** 2026-10-14  
**Sources:** repository routes/server functions, `docs/PROJECT_AUDIT.md`, `docs/testing/PORTAL-VISUAL-E2E-CHECKLIST.md`, `docs/testing/STAGING-ROLE-MAP-AUDIT.md`, `src/lib/business-permissions.ts`.  
**Not found in repo:** `Admission Officer Portal Wireframes.pdf`, `Role-Based Access Portal.html` (permission matrix already encoded in `business-permissions.ts`).  
**Live production E2E:** not performed in this pass.

Status: **WORKING** (code path + Supabase plane intended) · **PARTIAL** · **MOCK-ONLY** · **MISSING**

---

## End-to-end chain

Front Desk → Counsellor → Admission Team → Finance/visa → Student tracking → Admin

| Stage                             | Implemented surface                                  | Persist to Supabase?                                | Scoping                        | Verdict                                                   |
| --------------------------------- | ---------------------------------------------------- | --------------------------------------------------- | ------------------------------ | --------------------------------------------------------- |
| Front Desk intake / leads         | `/staff/students`, `/staff/leads`, intake server fns | Yes when JWT session + tables applied               | Assignment / role matrix       | **PARTIAL** — code present; live E2E BLOCKED historically |
| Counsellor assessment / consent   | Student workspace assessment + counselling agreement | Yes (AO server fns)                                 | Assigned consultant            | **PARTIAL**                                               |
| Admission handover / applications | `/staff/applications`, pipeline stages               | Yes                                                 | Desk / admin                   | **PARTIAL**                                               |
| Documents upload / review         | `/staff/documents`, student upload                   | Yes (storage + queue)                               | Student own / assigned / admin | **PARTIAL**                                               |
| Offers & visa                     | `/staff/offers`                                      | Yes                                                 | Desk / admin                   | **PARTIAL**                                               |
| Finance / fees                    | Admin `/admin/finance` + fee claim/verify paths      | PARTIAL — fee RPC migrations authored, wiring gated | Accounts business_role / admin | **PARTIAL** / **BLOCKED** until owner SQL                 |
| Tasks / reports / activity        | `/staff/tasks`, reports, activity                    | Yes for Supabase sessions                           | Desk / admin                   | **PARTIAL**                                               |
| Notifications                     | Student + portal notification reads                  | Mixed (some mock audience lists)                    | Audience filter                | **PARTIAL**                                               |
| Admin users / roles               | Settings → User & Account Management                 | Auth Admin + profiles                               | Admin/super_admin only         | **WORKING** (code; needs service-role env)                |
| Student portal                    | `/student/*`                                         | Yes for linked profile                              | Own `profile_id`               | **PARTIAL**                                               |

---

## Working (code-level)

- Role routing: student → `/student/*`, consultant → `/staff/*`, admin/super_admin → `/admin/*` (`roles.ts` + portal guard).
- Direct admin account create via Auth Admin `createUser` (no invite email).
- Optional change-password + forgot/reset password routes.
- Business-role permission matrix unit-tested (`business-permissions`).
- Consultant assignment scoping helpers (`assigned_consultant_id`, `resolveConsultantDeskId`).
- Staff nav covers dashboard, students, appointments, applications, documents, offers, tasks, leads, reports, activity.

## Partially working

- Officer dashboard / CRM modules: live when Supabase session + migrations applied; otherwise fail closed or demo-mock plane.
- Signup fee verify/activate: migrations authored; RPC wiring / owner apply still gated (`PROJECT_AUDIT`).
- Finance/HR/Marketing/Ops admin modules: pages exist; least-privilege API depends on `business_role` + applied M2–M4 SQL.
- Reports/export: server fns exist; formats/coverage vary by module.
- Leads: staff leads route present; depth vs wireframe counselling funnel not fully proven live.

## Missing / not in repo evidence

- Wireframe PDF and Role-Based Access HTML artifacts (matrix only in TS).
- Confirmed live E2E PASS rows (checklist still BLOCKED).
- Guaranteed org-wide student access for ordinary consultants (correctly **absent** by design).
- Automatic notification delivery channels (email/push) beyond in-app lists.

## Authorization notes (do not widen)

- Ordinary account create never offers `super_admin`.
- Consultant desks do not grant org-wide students; RLS + server visibility use assignment.
- Admin finance shell ≠ automatic Accounts verify without business_role + policies.

**Verdict for release of workflows:** still **BLOCKED on live verification** even where code is present. Auth session fix in this pass addresses sign-in → staff dashboard token validation; it does not by itself complete CRM acceptance.
