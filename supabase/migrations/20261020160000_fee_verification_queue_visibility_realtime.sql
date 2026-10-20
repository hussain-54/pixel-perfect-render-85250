-- Fix Front Desk fee-verification queue visibility + Realtime publication.
-- Root cause: list RPC required r.registrar_id = auth.uid(), which hid rows when
-- students.registered_by / registrar_id was null or mismatched. No Realtime pub.

-- Backfill registrar from current intake ownership.
update public.counselling_fee_verification_requests r
set registrar_id = s.registered_by
from public.students s
where r.student_id = s.id
  and r.registrar_id is null
  and s.registered_by is not null;

-- RLS: Front Desk registrars see their cases; unowned open requests visible to any Front Desk.
drop policy if exists counselling_fee_vr_select on public.counselling_fee_verification_requests;
create policy counselling_fee_vr_select on public.counselling_fee_verification_requests
  for select to authenticated
  using (
    public.is_admin()
    or requested_by = auth.uid()
    or registrar_id = auth.uid()
    or public.can_verify_signup_fee()
    or public.is_assigned_consultant(student_id)
    or public.is_front_desk_fee_registrar(student_id)
    or (
      public.is_front_desk()
      and registrar_id is null
    )
  );

-- Request: keep registrar in sync with students.registered_by at insert time.
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

-- List: ownership via is_intake_registrar OR registrar_id; unowned visible to Front Desk.
-- Include fee claim reference for coordination (not a verification proof).
-- Drop first: return columns changed vs 20261020150000.
drop function if exists public.list_counselling_fee_verification_requests(boolean);

create function public.list_counselling_fee_verification_requests(
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
  fee_amount numeric,
  fee_currency text,
  fee_payment_method text,
  fee_reference_receipt text,
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
    f.amount as fee_amount,
    f.currency as fee_currency,
    f.payment_method as fee_payment_method,
    f.reference_receipt as fee_reference_receipt,
    r.requested_by,
    r.registrar_id,
    r.created_at,
    r.updated_at
  from public.counselling_fee_verification_requests r
  join public.students s on s.id = r.student_id
  left join public.profiles cp on cp.id = s.assigned_consultant_id
  left join lateral (
    select fp.*
    from public.signup_fee_payments fp
    where fp.student_id = s.id
    order by fp.created_at desc
    limit 1
  ) f on true
  where
    (
      public.is_admin()
      or public.can_verify_signup_fee()
      or (
        public.is_front_desk()
        and (
          public.is_intake_registrar(r.student_id)
          or r.registrar_id = auth.uid()
          or (r.registrar_id is null and s.registered_by is null)
        )
      )
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

-- Realtime: only this workflow table (ignore if already published).
do $$
begin
  alter publication supabase_realtime add table public.counselling_fee_verification_requests;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
