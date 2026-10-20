-- Counsellor → Front Desk fee-verification requests (not admission handover; not Accounts verify).
-- Claimed fee remains unverified until Accounts runs verify_signup_fee_and_activate.
-- Local file is not proof of remote apply.

create table if not exists public.counselling_fee_verification_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  requested_by uuid not null references public.profiles (id),
  registrar_id uuid references public.profiles (id),
  summary text not null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'cancelled')),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists counselling_fee_vr_student_idx
  on public.counselling_fee_verification_requests (student_id);
create index if not exists counselling_fee_vr_registrar_open_idx
  on public.counselling_fee_verification_requests (registrar_id, status)
  where status in ('open', 'in_progress');

drop trigger if exists counselling_fee_vr_set_updated_at
  on public.counselling_fee_verification_requests;
create trigger counselling_fee_vr_set_updated_at
  before update on public.counselling_fee_verification_requests
  for each row execute function public.set_updated_at();

alter table public.counselling_fee_verification_requests enable row level security;

drop policy if exists counselling_fee_vr_select on public.counselling_fee_verification_requests;
create policy counselling_fee_vr_select on public.counselling_fee_verification_requests
  for select to authenticated
  using (
    public.is_admin()
    or requested_by = auth.uid()
    or registrar_id = auth.uid()
    or public.can_verify_signup_fee()
    or public.is_assigned_consultant(student_id)
  );

drop policy if exists counselling_fee_vr_insert on public.counselling_fee_verification_requests;
create policy counselling_fee_vr_insert on public.counselling_fee_verification_requests
  for insert to authenticated
  with check (
    public.is_admin()
    or (
      requested_by = auth.uid()
      and public.is_assigned_consultant(student_id)
    )
  );

drop policy if exists counselling_fee_vr_update on public.counselling_fee_verification_requests;
create policy counselling_fee_vr_update on public.counselling_fee_verification_requests
  for update to authenticated
  using (
    public.is_admin()
    or registrar_id = auth.uid()
    or public.can_verify_signup_fee()
  )
  with check (
    public.is_admin()
    or registrar_id = auth.uid()
    or public.can_verify_signup_fee()
  );

-- Counsellor creates open request for the student's Front Desk registrar.
create or replace function public.request_counselling_fee_verification(
  p_student_id uuid,
  p_summary text
)
returns public.counselling_fee_verification_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student public.students%rowtype;
  v_summary text;
  v_row public.counselling_fee_verification_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_summary := nullif(trim(coalesce(p_summary, '')), '');
  if v_summary is null or char_length(v_summary) < 10 then
    raise exception 'Add a short verification request summary (at least 10 characters).';
  end if;

  select * into v_student from public.students where id = p_student_id for update;
  if not found then
    raise exception 'Student record not found';
  end if;

  if not (
    public.is_admin()
    or (v_student.assigned_consultant_id is not null and v_student.assigned_consultant_id = auth.uid())
  ) then
    raise exception 'Not authorized for this student';
  end if;

  if exists (
    select 1
    from public.counselling_fee_verification_requests r
    where r.student_id = p_student_id
      and r.status in ('open', 'in_progress')
  ) then
    raise exception 'A fee verification request is already open for this student';
  end if;

  if not exists (
    select 1
    from public.student_assessments a
    where a.student_id = p_student_id
      and nullif(trim(a.summary), '') is not null
  ) then
    raise exception 'Save the eligibility assessment before requesting fee verification';
  end if;

  if not exists (
    select 1
    from public.counselling_agreements c
    where c.student_id = p_student_id
      and c.consented = true
  ) then
    raise exception 'Record counselling consent before requesting fee verification';
  end if;

  insert into public.counselling_fee_verification_requests (
    student_id, requested_by, registrar_id, summary, status
  ) values (
    p_student_id,
    auth.uid(),
    v_student.registered_by,
    v_summary,
    'open'
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.request_counselling_fee_verification(uuid, text) from public;
revoke all on function public.request_counselling_fee_verification(uuid, text) from anon;
grant execute on function public.request_counselling_fee_verification(uuid, text) to authenticated;

-- Front Desk / admin / fee verifiers list open requests for their scope.
create or replace function public.list_counselling_fee_verification_requests(
  p_include_resolved boolean default false
)
returns table (
  id uuid,
  student_id uuid,
  case_id text,
  full_name text,
  counsellor_name text,
  summary text,
  status text,
  signup_fee_status public.signup_fee_status,
  requested_by uuid,
  registrar_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not (
    public.is_admin()
    or public.is_front_desk()
    or public.can_verify_signup_fee()
  ) then
    raise exception 'Not authorized';
  end if;

  return query
  select
    r.id,
    r.student_id,
    s.case_id,
    s.full_name,
    cp.full_name as counsellor_name,
    r.summary,
    r.status,
    f.status as signup_fee_status,
    r.requested_by,
    r.registrar_id,
    r.created_at,
    r.updated_at
  from public.counselling_fee_verification_requests r
  join public.students s on s.id = r.student_id
  left join public.profiles cp on cp.id = s.assigned_consultant_id
  left join public.signup_fee_payments f on f.student_id = s.id
  where
    (
      public.is_admin()
      or public.can_verify_signup_fee()
      or (public.is_front_desk() and r.registrar_id = auth.uid())
    )
    and (
      case
        when p_include_resolved then true
        else r.status in ('open', 'in_progress')
      end
    )
  order by r.created_at desc
  limit 200;
end;
$$;

revoke all on function public.list_counselling_fee_verification_requests(boolean) from public;
revoke all on function public.list_counselling_fee_verification_requests(boolean) from anon;
grant execute on function public.list_counselling_fee_verification_requests(boolean) to authenticated;
