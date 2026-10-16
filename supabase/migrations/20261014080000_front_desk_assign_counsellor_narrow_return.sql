-- Narrow front_desk_assign_counsellor return (R2 mitigation).
-- Previously RETURNS public.students (full row). Callers only need assignment
-- confirmation fields; exclude DOB, activation, archive, notes, profile_id.
-- Local migration only until applied on remote — does not close R2 without JWT proof.

drop function if exists public.front_desk_assign_counsellor(uuid, uuid);

create or replace function public.front_desk_assign_counsellor(
  p_student_id uuid,
  p_consultant_id uuid
)
returns table (
  id uuid,
  case_id text,
  full_name text,
  email text,
  phone text,
  whatsapp text,
  city text,
  destination text,
  program text,
  study_level text,
  journey_stage public.journey_stage,
  assigned_consultant_id uuid,
  registered_by uuid,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  desk_ok boolean;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not (public.is_admin() or public.is_front_desk()) then
    raise exception 'Not authorized';
  end if;

  if p_consultant_id is null then
    raise exception 'Counsellor is required';
  end if;

  select exists (
    select 1
    from public.consultants c
    join public.profiles p on p.id = c.id
    where c.id = p_consultant_id
      and c.status = 'active'
      and p.business_role = 'counsellor_consultant'
  ) into desk_ok;

  if not desk_ok then
    raise exception 'Counsellor must be an active Counsellor / Consultant desk';
  end if;

  return query
  update public.students stu
  set assigned_consultant_id = p_consultant_id,
      updated_at = now()
  where stu.id = p_student_id
    and (public.is_admin() or stu.registered_by = auth.uid())
  returning
    stu.id,
    stu.case_id,
    stu.full_name,
    stu.email,
    stu.phone,
    stu.whatsapp,
    stu.city,
    stu.destination,
    stu.program,
    stu.study_level,
    stu.journey_stage,
    stu.assigned_consultant_id,
    stu.registered_by,
    stu.updated_at;

  if not found then
    raise exception 'Student not found or not owned by registrar';
  end if;
end;
$$;

revoke all on function public.front_desk_assign_counsellor(uuid, uuid) from public;
revoke all on function public.front_desk_assign_counsellor(uuid, uuid) from anon;
grant execute on function public.front_desk_assign_counsellor(uuid, uuid) to authenticated;
-- Match production ACL evidence (authenticated + service_role). DROP+CREATE clears prior grants.
grant execute on function public.front_desk_assign_counsellor(uuid, uuid) to service_role;
