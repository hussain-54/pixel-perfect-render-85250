-- =============================================================================
-- Global Roots — Persist Admin-editable business-role × module permission matrix
-- Forward-only additive. Extends existing business_role enum + approved modules.
-- Does NOT change profiles.role / technical app_role escalation paths.
-- Local file is not proof of remote apply.
-- =============================================================================

create table if not exists public.business_module_permissions (
  business_role public.business_role not null,
  module text not null,
  permission_level smallint not null
    check (permission_level >= 0 and permission_level <= 3),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (business_role, module),
  constraint business_module_permissions_module_check check (
    module in (
      'students',
      'counselling',
      'admissions',
      'documents',
      'fees_payments',
      'banking_finance',
      'hr_attendance',
      'digital_marketing',
      'orders_sales_purchase',
      'reports',
      'users_roles',
      'settings'
    )
  )
);

comment on table public.business_module_permissions is
  'Editable business-role × module permission levels (0–3). Defaults seeded from approved matrix.';

create index if not exists business_module_permissions_role_idx
  on public.business_module_permissions (business_role);

drop trigger if exists business_module_permissions_set_updated_at
  on public.business_module_permissions;
create trigger business_module_permissions_set_updated_at
  before update on public.business_module_permissions
  for each row execute function public.set_updated_at();

-- Seed approved defaults (idempotent).
insert into public.business_module_permissions (business_role, module, permission_level)
values
  -- front_desk_student_affairs
  ('front_desk_student_affairs', 'students', 2),
  ('front_desk_student_affairs', 'counselling', 1),
  ('front_desk_student_affairs', 'admissions', 1),
  ('front_desk_student_affairs', 'documents', 2),
  ('front_desk_student_affairs', 'fees_payments', 2),
  ('front_desk_student_affairs', 'banking_finance', 0),
  ('front_desk_student_affairs', 'hr_attendance', 1),
  ('front_desk_student_affairs', 'digital_marketing', 1),
  ('front_desk_student_affairs', 'orders_sales_purchase', 0),
  ('front_desk_student_affairs', 'reports', 1),
  ('front_desk_student_affairs', 'users_roles', 0),
  ('front_desk_student_affairs', 'settings', 0),
  -- counsellor_consultant
  ('counsellor_consultant', 'students', 2),
  ('counsellor_consultant', 'counselling', 3),
  ('counsellor_consultant', 'admissions', 1),
  ('counsellor_consultant', 'documents', 2),
  ('counsellor_consultant', 'fees_payments', 1),
  ('counsellor_consultant', 'banking_finance', 0),
  ('counsellor_consultant', 'hr_attendance', 1),
  ('counsellor_consultant', 'digital_marketing', 0),
  ('counsellor_consultant', 'orders_sales_purchase', 0),
  ('counsellor_consultant', 'reports', 1),
  ('counsellor_consultant', 'users_roles', 0),
  ('counsellor_consultant', 'settings', 0),
  -- admission_team
  ('admission_team', 'students', 1),
  ('admission_team', 'counselling', 1),
  ('admission_team', 'admissions', 3),
  ('admission_team', 'documents', 3),
  ('admission_team', 'fees_payments', 2),
  ('admission_team', 'banking_finance', 0),
  ('admission_team', 'hr_attendance', 1),
  ('admission_team', 'digital_marketing', 0),
  ('admission_team', 'orders_sales_purchase', 0),
  ('admission_team', 'reports', 1),
  ('admission_team', 'users_roles', 0),
  ('admission_team', 'settings', 0),
  -- student_portal
  ('student_portal', 'students', 1),
  ('student_portal', 'counselling', 1),
  ('student_portal', 'admissions', 1),
  ('student_portal', 'documents', 2),
  ('student_portal', 'fees_payments', 1),
  ('student_portal', 'banking_finance', 0),
  ('student_portal', 'hr_attendance', 0),
  ('student_portal', 'digital_marketing', 0),
  ('student_portal', 'orders_sales_purchase', 0),
  ('student_portal', 'reports', 0),
  ('student_portal', 'users_roles', 0),
  ('student_portal', 'settings', 0),
  -- accounts_banking_finance
  ('accounts_banking_finance', 'students', 1),
  ('accounts_banking_finance', 'counselling', 0),
  ('accounts_banking_finance', 'admissions', 1),
  ('accounts_banking_finance', 'documents', 0),
  ('accounts_banking_finance', 'fees_payments', 3),
  ('accounts_banking_finance', 'banking_finance', 3),
  ('accounts_banking_finance', 'hr_attendance', 1),
  ('accounts_banking_finance', 'digital_marketing', 0),
  ('accounts_banking_finance', 'orders_sales_purchase', 2),
  ('accounts_banking_finance', 'reports', 2),
  ('accounts_banking_finance', 'users_roles', 0),
  ('accounts_banking_finance', 'settings', 0),
  -- hr_system
  ('hr_system', 'students', 0),
  ('hr_system', 'counselling', 0),
  ('hr_system', 'admissions', 0),
  ('hr_system', 'documents', 1),
  ('hr_system', 'fees_payments', 0),
  ('hr_system', 'banking_finance', 0),
  ('hr_system', 'hr_attendance', 3),
  ('hr_system', 'digital_marketing', 0),
  ('hr_system', 'orders_sales_purchase', 0),
  ('hr_system', 'reports', 1),
  ('hr_system', 'users_roles', 1),
  ('hr_system', 'settings', 0),
  -- digital_manager
  ('digital_manager', 'students', 1),
  ('digital_manager', 'counselling', 0),
  ('digital_manager', 'admissions', 0),
  ('digital_manager', 'documents', 1),
  ('digital_manager', 'fees_payments', 0),
  ('digital_manager', 'banking_finance', 0),
  ('digital_manager', 'hr_attendance', 1),
  ('digital_manager', 'digital_marketing', 3),
  ('digital_manager', 'orders_sales_purchase', 0),
  ('digital_manager', 'reports', 2),
  ('digital_manager', 'users_roles', 0),
  ('digital_manager', 'settings', 0),
  -- office_ops
  ('office_ops', 'students', 0),
  ('office_ops', 'counselling', 0),
  ('office_ops', 'admissions', 0),
  ('office_ops', 'documents', 1),
  ('office_ops', 'fees_payments', 1),
  ('office_ops', 'banking_finance', 1),
  ('office_ops', 'hr_attendance', 1),
  ('office_ops', 'digital_marketing', 0),
  ('office_ops', 'orders_sales_purchase', 3),
  ('office_ops', 'reports', 2),
  ('office_ops', 'users_roles', 0),
  ('office_ops', 'settings', 0),
  -- manager
  ('manager', 'students', 3),
  ('manager', 'counselling', 3),
  ('manager', 'admissions', 3),
  ('manager', 'documents', 3),
  ('manager', 'fees_payments', 3),
  ('manager', 'banking_finance', 2),
  ('manager', 'hr_attendance', 3),
  ('manager', 'digital_marketing', 3),
  ('manager', 'orders_sales_purchase', 3),
  ('manager', 'reports', 3),
  ('manager', 'users_roles', 1),
  ('manager', 'settings', 1),
  -- admin (always Full)
  ('admin', 'students', 3),
  ('admin', 'counselling', 3),
  ('admin', 'admissions', 3),
  ('admin', 'documents', 3),
  ('admin', 'fees_payments', 3),
  ('admin', 'banking_finance', 3),
  ('admin', 'hr_attendance', 3),
  ('admin', 'digital_marketing', 3),
  ('admin', 'orders_sales_purchase', 3),
  ('admin', 'reports', 3),
  ('admin', 'users_roles', 3),
  ('admin', 'settings', 3)
on conflict (business_role, module) do nothing;

alter table public.business_module_permissions enable row level security;

drop policy if exists business_module_permissions_select_admin
  on public.business_module_permissions;
create policy business_module_permissions_select_admin
  on public.business_module_permissions
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists business_module_permissions_insert_admin
  on public.business_module_permissions;
create policy business_module_permissions_insert_admin
  on public.business_module_permissions
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists business_module_permissions_update_admin
  on public.business_module_permissions;
create policy business_module_permissions_update_admin
  on public.business_module_permissions
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No DELETE policy — matrix cells are upserted, never removed via client.

grant select, insert, update on public.business_module_permissions to authenticated;
