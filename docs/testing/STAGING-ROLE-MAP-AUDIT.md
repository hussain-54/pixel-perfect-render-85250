# Staging role-map SQL — schema audit (repo migrations)

**Date:** 2026-10-13  
**Scope:** Read-only inspection of migrations + TypeScript types. **Not** remote-confirmed.  
**Active companion:** [`DESIGNATE-PRIMARY-ADMIN.sql`](./DESIGNATE-PRIMARY-ADMIN.sql) + Admin → Accounts UI.  
**Obsolete:** [`STAGING-MAP-AUTH-USERS-BY-EMAIL.sql`](./STAGING-MAP-AUTH-USERS-BY-EMAIL.sql) (retired three-account placeholders).

---

## 1. `public.profiles`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | FK → `auth.users(id)` ON DELETE CASCADE |
| `email` | `text` NOT NULL | Indexed; not UNIQUE in foundation migration |
| `full_name` | `text` NOT NULL default `''` | |
| `phone` | `text` nullable | |
| `role` | `public.app_role` NOT NULL default `'student'` | Technical / portal path |
| `business_role` | `public.business_role` nullable | Added in M1 (`20261012010000_…`) |
| `created_at` / `updated_at` | `timestamptz` | `profiles_set_updated_at` trigger |

**Not present:** password columns, service keys, or any invented fields.

---

## 2. Enums (exact)

**`public.app_role`:** `student` · `consultant` · `admin` · `super_admin`  
**`public.business_role`:** `front_desk_student_affairs` · `counsellor_consultant` · `admission_team` · `student_portal` · `accounts_banking_finance` · `hr_system` · `digital_manager` · `office_ops` · `manager` · `admin`  
**`public.consultant_status`:** `active` · `inactive`

There is **no** `app_role` value `admission_officer`. Admission Officer UI = `consultant` + `business_role = admission_team`.

---

## 3. Role-assignment logic

| Mechanism | Behavior |
|-----------|----------|
| `handle_new_user` | On `auth.users` insert → profile with `role = 'student'` |
| `enforce_profile_role_guard` | BEFORE UPDATE: changing `role` requires caller `profiles.role` ∈ {`admin`,`super_admin`} via `auth.uid()` |
| `admin_set_user_role(uuid, app_role)` | SECURITY DEFINER; admin-only; updates `role` only (not `business_role`) |
| Portal routing | `profiles.role` → `/student` \| `/staff` \| `/admin` |
| Module matrix | Prefer `profiles.business_role`; AppRole fallback maps `consultant` → `counsellor_consultant` |

**SQL Editor implication:** Dashboard sessions usually have `auth.uid() IS NULL`, so the role guard **blocks** direct `UPDATE profiles.role` unless the trigger is briefly disabled inside the owner script (RLS is **not** disabled). The staging map script does that and re-enables the trigger in the same transaction.

---

## 4. Consultant-related tables / FKs

| Object | Relationship |
|--------|----------------|
| `public.consultants.id` | PK = `profiles.id` |
| `students.assigned_consultant_id` | FK → `consultants(id)` — **caseload** for RLS |
| `students.profile_id` | Optional link Auth student ↔ CRM row |
| Handover `from_consultant_id` / `to_owner_id` | FK → `consultants` (M1) |

Creating a `consultants` row for an Admission Officer does **not** grant access to all students. Access remains admin **or** `assigned_consultant_id = auth.uid()` (plus own `profile_id` for students).

---

## 5. Relevant RLS (unchanged by staging script)

| Table | Policy gist |
|-------|-------------|
| `profiles` SELECT | self, admin, or consultant |
| `profiles` UPDATE | self or admin |
| `consultants` SELECT | all authenticated |
| `consultants` write | admin only |
| `students` SELECT | own profile, assigned consultant, or admin |

Postgres/supabase_admin in SQL Editor typically **bypasses RLS**; application JWTs do not. The script must not widen policies.

---

## 6. Target mapping for this script

| Staging persona | `profiles.role` | `profiles.business_role` | `consultants` row |
|-----------------|-----------------|--------------------------|-------------------|
| Admin | `admin` | `admin` | Not required for `/admin` shell |
| Consultant / Admission Officer | `consultant` | `admission_team` | Upsert `status = active` |
| Student | `student` | `student_portal` | None |

**Explicitly out of scope:** `super_admin`; passwords; assigning every student to the AO; disabling RLS; service-role keys.
