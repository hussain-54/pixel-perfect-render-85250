-- Initialize new Auth users with student + student_portal on INSERT.
-- Profiles INSERT is not subject to enforce_profile_role_guard (UPDATE-only).
-- Avoids service-role UPDATEs of business_role during Front Desk student provisioning.
-- Local file is not proof of remote apply.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, business_role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'student',
    'student_portal'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Creates profiles row for new Auth users as role=student, business_role=student_portal. Staff provisioning may later change role/business_role via admin JWT.';
