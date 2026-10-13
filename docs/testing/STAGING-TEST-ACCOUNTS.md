# Staging test accounts — Global Roots

**Target project:** `gjasuvlqfofpvrqvvnyz` (confirm Dashboard URL before any Auth action)  
**Primary admin:** `hussaindurrani92@gmail.com`  
**Secrets:** Never commit passwords or service-role keys.

## Active setup (use this)

1. Confirm/create Auth user for `hussaindurrani92@gmail.com` in Dashboard → Authentication → Users.  
2. Run [`DESIGNATE-PRIMARY-ADMIN.sql`](./DESIGNATE-PRIMARY-ADMIN.sql) (preflight → assign → verify).  
3. Set server env `SUPABASE_SERVICE_ROLE_KEY` (never `VITE_*`) and sign in as that admin.  
4. Create further employees via **Admin → Settings → User & Account Management** — invite + password-setup email.

**Retired:** Do **not** create the old three placeholder staging accounts (`staging-admin@example.com`, etc.). [`STAGING-MAP-AUTH-USERS-BY-EMAIL.sql`](./STAGING-MAP-AUTH-USERS-BY-EMAIL.sql) is obsolete.

Related:

- [`DESIGNATE-PRIMARY-ADMIN.sql`](./DESIGNATE-PRIMARY-ADMIN.sql) — primary admin designation  
- [`PORTAL-VISUAL-E2E-CHECKLIST.md`](./PORTAL-VISUAL-E2E-CHECKLIST.md)
- [`STAGING-ROLE-MAP-AUDIT.md`](./STAGING-ROLE-MAP-AUDIT.md) — schema findings for role mapping
- [`../database/STAGING-OWNER-VERIFICATION.sql`](../database/STAGING-OWNER-VERIFICATION.sql)
- [`../database/CLIENT-ACCEPTANCE-CHECKLIST.md`](../database/CLIENT-ACCEPTANCE-CHECKLIST.md)
- [`../database/SIGNUP-FEE-SECURITY-REVIEW.md`](../database/SIGNUP-FEE-SECURITY-REVIEW.md)

---

## 1. Authentication model (audited)

### Dual role system — exact values only

| Layer | Source | Exact values | Controls |
|-------|--------|--------------|----------|
| **Portal / technical** | `profiles.role` → `public.app_role` | `student`, `consultant`, `admin`, `super_admin` | Route shells `/student`, `/staff`, `/admin` via `requirePortalAccess` |
| **Business matrix** | `profiles.business_role` → `public.business_role` | See enum below | Module gates, fee verify, HR/marketing/ops helpers |

**`business_role` enum (exact, from M1 migration + `BUSINESS_ROLES`):**

`front_desk_student_affairs` · `counsellor_consultant` · `admission_team` · `student_portal` · `accounts_banking_finance` · `hr_system` · `digital_manager` · `office_ops` · `manager` · `admin`

**Do not invent:** There is no DB `app_role` named `admission_officer`, `front_desk`, `accounts`, or `hr`. UI label “Admission Officer” = `consultant` + `admission_team`.

**Portal landing (`portalHomeByRole` in `src/lib/roles.ts`):**

| `app_role` | Home |
|------------|------|
| `student` | `/student/dashboard` |
| `consultant` | `/staff/dashboard` |
| `admin` | `/admin/dashboard` |
| `super_admin` | `/admin/dashboard` |

Code-only aliases (normalize inbound strings): `staff` / `admission_officer` → `consultant`. Not stored as enum values.

**Trusted AppRole → default business_role** (`resolveBusinessRoleFromTrustedAppRole`) when `profiles.business_role` is null:

| `app_role` | Default matrix role |
|------------|---------------------|
| `student` | `student_portal` |
| `consultant` | `counsellor_consultant` |
| `admin` / `super_admin` | `admin` |

Specialized desks (Front Desk, Accounts, AO, HR, Marketing, Ops, Manager) **must** set `profiles.business_role` explicitly. Server resolvers prefer the DB column over the AppRole default.

### Auth flows (code)

| Flow | Location | Behavior |
|------|----------|----------|
| Sign-in | `signInWithPassword` → `auth.signInWithPassword` → `establishSession` | Role from `profiles` then `app_metadata` via `resolveTrustedRole` — **never** `user_metadata`; portal guards re-establish from JWT so stale cookies cannot pin a student role |
| Sign-up | `signUpStudent` → `auth.signUp` | `handle_new_user` inserts `profiles.role = student`; optional `claim_own_student_record` |
| Sign-out | `signOut` + `clearSession` | Clears Auth session + httpOnly portal cookie |
| Password reset request | `requestPasswordReset` → `resetPasswordForEmail` | `redirectTo` = `{origin}/sign-in` |
| Email confirm | Supabase Auth project setting | If required, sign-up returns check-email message |
| Demo auth | `demo-auth.ts` | **PROD hard-off** — invalid for staging evidence |

### Client env (`.env.example`)

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` only  
- **Never** put the service-role key in Vite env or any frontend bundle  

### Provisioning mechanisms

| Mechanism | Status |
|-----------|--------|
| Public sign-up elevating to staff | **Impossible by design** — new users are `student` |
| Self-assign / elevate `profiles.role` | Blocked by `enforce_profile_role_guard` (admin/super_admin only) |
| In-app staff invite UI | **Admin → Settings → User & Account Management** — Auth Admin invite + `admin_set_user_role` + business_role |
| `admin_set_user_role(uuid, app_role)` | Used by Accounts create path (admin JWT); sets `app_role` only |
| Primary admin bootstrap | [`DESIGNATE-PRIMARY-ADMIN.sql`](./DESIGNATE-PRIMARY-ADMIN.sql) for `hussaindurrani92@gmail.com` |
| Three-account placeholder SQL | **Retired** — do not use |

### Architecture gap (route vs module)

Finance / HR / Marketing / Office Ops **pages** are under `/admin/*`, guarded by `app_role ∈ {admin, super_admin}`.  
Server handlers for those modules also accept `consultant` + matching `business_role`, but consultants are **redirected away** from `/admin`.

| Goal | Account pattern |
|------|-----------------|
| Visual test `/admin/finance|hr|marketing|operations` | `ADM` (`admin` + `admin`) — note admin bypasses many module gates |
| Least-privilege API / RLS for Accounts/HR/MKT/OPS | `consultant` + specific `business_role` (staff shell or API-only evidence) |

---

## 2. Owner provisioning procedure

### A. Primary admin (required first)

1. Dashboard project ref = **`gjasuvlqfofpvrqvvnyz`**.  
2. Ensure Auth user `hussaindurrani92@gmail.com` exists (Add user / Invite).  
3. Run [`DESIGNATE-PRIMARY-ADMIN.sql`](./DESIGNATE-PRIMARY-ADMIN.sql) sections 0 → 1 → 2.  
4. Set `SUPABASE_SERVICE_ROLE_KEY` on the **server** only (see `.env.example`).  
5. Sign in at `/sign-in` with that admin — production login is Supabase Auth only.

### B. Create employees (in-app)

Use **Admin → Accounts**. Fields: full name, email, phone (optional), department (staff desks), business role (maps to a fixed `app_role`). Invitation sends a password-setup link — no plaintext passwords in DB tables.

Do **not** put the service-role key in any `VITE_*` variable.

### C. Password lifecycle checklist

| Step | Method | Live status |
|------|--------|-------------|
| Initial password / invite | Dashboard Create or Invite | **BLOCKED** until owner runs |
| Sign-in | `/sign-in` | **BLOCKED** |
| Session refresh | Hard refresh while signed in | **BLOCKED** |
| Sign-out → sign-in | Portal Sign out | **BLOCKED** |
| Reset request | `/forgot-password` | **BLOCKED** (needs email) |
| Complete reset | Inbox link → new password → sign-in | **BLOCKED** |
| Invalid credentials | Wrong password | Expect neutral error (code path exists) |
| Expired / cleared session | Clear site data or expire JWT | Expect redirect to `/sign-in` |

Code paths exist; **no live pass claimed**.

---

## 3. Account matrix

One disposable email per row. Secrets stay private.

### STU-A — Student

| Field | Value |
|-------|--------|
| Email placeholder | `staging-student-a@example.com` |
| `app_role` | `student` |
| `business_role` | `student_portal` (or null → maps to `student_portal`) |
| Portal | `/student/dashboard` |
| Provisioning | Public `/sign-up` **or** Dashboard create (leave role student) |
| Seed | Front Desk creates CRM student with **same email**; claim links `profile_id` after confirm |
| Password | Sign-up or Dashboard + `/forgot-password` |
| Positive | Own dashboard / profile / docs; claim own record |
| Negative | `/staff/*`, `/admin/*`; other student IDs; fee verify; self-set `portal_activated_at` |

### STU-B — Student (cross-access)

| Field | Value |
|-------|--------|
| Email placeholder | `staging-student-b@example.com` |
| `app_role` / `business_role` | `student` / `student_portal` |
| Portal | `/student/dashboard` |
| Purpose | Deny STU-A ↔ STU-B data access |
| Seed | Separate CRM student + docs/fees as needed |

### FD — Front Desk / Student Affairs

| Field | Value |
|-------|--------|
| Email placeholder | `staging-frontdesk@example.com` |
| `app_role` | `consultant` |
| `business_role` | `front_desk_student_affairs` |
| Portal | `/staff/dashboard` |
| Provisioning | Dashboard + SQL (`role`, `business_role`, `consultants`) |
| Seed | Active `consultants` row (`id` = auth uid) |
| Positive | Intake register; fee **claimed**; no portal activation as verified |
| Negative | Fee → `verified`; `/admin/*`; unassigned students when not assigned |

### ACC — Accounts / Finance

| Field | Value |
|-------|--------|
| Email placeholder | `staging-accounts@example.com` |
| `app_role` (API / RLS) | `consultant` |
| `business_role` | `accounts_banking_finance` |
| Portal (API) | Fee/finance server fns; lands on `/staff` shell |
| Visual `/admin/finance` | Use **ADM** (or separate admin email) — admin bypasses module gates |
| Provisioning | Dashboard + SQL; `consultants` if consultant path |
| Seed | Claimed signup fee; after approved fee migrations, verifier SELECT/verify without assignment |
| Positive | Verify/waive/reject signup fee; university fee verify when M2 live |
| Negative | HR mutate; marketing mutate; non-verifier fee escalation |
| Blocker | App `assertStudentVisibleDb` still assignment-scopes consultants until wire-up |

### CON — Counsellor / Consultant

| Field | Value |
|-------|--------|
| Email placeholder | `staging-counsellor@example.com` |
| `app_role` | `consultant` |
| `business_role` | `counsellor_consultant` |
| Portal | `/staff/dashboard` |
| Provisioning | Dashboard + SQL + `consultants` |
| Seed | `students.assigned_consultant_id` = this user |
| Positive | Assigned workspace; assessment; consent; handover |
| Negative | Unassigned student; fee verify; `/admin/*` |

### AO — Admission Team (Admission Officer UI)

| Field | Value |
|-------|--------|
| Email placeholder | `staging-admission@example.com` |
| `app_role` | `consultant` (**not** a separate DB role) |
| `business_role` | `admission_team` |
| Portal | `/staff/dashboard` (docs / apps / offers) |
| Provisioning | Dashboard + SQL + `consultants` |
| Seed | Submitted handover; documents/apps |
| Positive | Accept/return handover; doc review; stages; offers |
| Negative | Fee verify; HR/ops admin modules; unrelated caseload |

### HR — HR System

| Field | Value |
|-------|--------|
| Email placeholder | `staging-hr@example.com` |
| `app_role` (API) | `consultant` |
| `business_role` | `hr_system` |
| Portal visual | `/admin/hr` needs **admin** shell — use ADM for chrome **or** API JWT for least privilege |
| Provisioning | Dashboard + SQL |
| Positive | Employee / attendance / leave when M3 applied |
| Negative | Fee verify; marketing mutate |

### MKT — Digital Marketing

| Field | Value |
|-------|--------|
| Email placeholder | `staging-marketing@example.com` |
| `app_role` (API) | `consultant` |
| `business_role` | `digital_manager` |
| Portal visual | `/admin/marketing` — admin-shell gap |
| Positive | Campaigns / attribution when M3 marketing applied |
| Negative | HR mutate; fee verify; ops PO |

### OPS — Office Operations

| Field | Value |
|-------|--------|
| Email placeholder | `staging-ops@example.com` |
| `app_role` (API) | `consultant` |
| `business_role` | `office_ops` |
| Portal visual | `/admin/operations` — admin-shell gap |
| Positive | Suppliers / PO / stock when M4 applied |
| Negative | Fee verify; HR mutate |

### ADM — Admin

| Field | Value |
|-------|--------|
| Email placeholder | `staging-admin@example.com` |
| `app_role` | `admin` |
| `business_role` | `admin` |
| Portal | `/admin/dashboard` |
| Provisioning | Dashboard + SQL |
| Positive | Admin nav; fee verify; module pages |
| Negative | Super-admin-only actions (e.g. rehire) should **fail** for plain admin; no demo auth |

### SADM — Super Admin (optional)

| Field | Value |
|-------|--------|
| Email placeholder | `staging-superadmin@example.com` |
| `app_role` | `super_admin` |
| `business_role` | `admin` (matrix maps super_admin → admin) |
| Portal | `/admin/dashboard` |
| Positive | Rehire / elevated admin behaviors per product rules |
| Negative | Still subject to forced RLS; no demo auth |

### MGR — Manager (optional, discovered)

| Field | Value |
|-------|--------|
| Email placeholder | `staging-manager@example.com` |
| `app_role` | `consultant` (API) or `admin` (admin shell) |
| `business_role` | `manager` |
| Notes | Broad matrix rights; included in `can_verify_signup_fee` |

---

## 4. Seed data cheatsheet

| Need | Action |
|------|--------|
| Student CRM | FD intake on `/staff/students` |
| Fee claimed | Intake / fee record (not verified) |
| Counsellor caseload | `assigned_consultant_id` = CON uid |
| Consultants desk | `insert into consultants` (template above) |
| Activation | ACC/ADM verify path after approved migrations |
| Module rows | Create in each module after M2–M4 verified |

---

## 5. Owner blockers

1. Confirm project ref + Auth email/redirect settings.  
2. Designate primary admin via [`DESIGNATE-PRIMARY-ADMIN.sql`](./DESIGNATE-PRIMARY-ADMIN.sql) and verify live.  
3. Configure `SUPABASE_SERVICE_ROLE_KEY` on the host; invite staff via Admin → Accounts.  
4. Complete password lifecycle with a real inbox.  
5. Execute [`PORTAL-VISUAL-E2E-CHECKLIST.md`](./PORTAL-VISUAL-E2E-CHECKLIST.md) — **PASS** only with evidence.  
6. Fee migrations / RPC wiring remain separate owner approvals.

**Private run sheet columns:** Account ID · Real email · User UUID · Password vault ref · Created · Email confirmed · First login · Refresh OK · Reset OK
