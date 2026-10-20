-- Urgent: Front Desk fee-verification coordination queue must list open requests
-- for any Front Desk desk (not only matching registrar_id). Fee VERIFY remains Accounts-only.
-- Adds forward / return coordinator actions on the existing request table.

alter table public.counselling_fee_verification_requests
  add column if not exists coordinator_note text;

alter table public.counselling_fee_verification_requests
  add column if not exists forwarded_at timestamptz;

alter table public.counselling_fee_verification_requests
  add column if not exists forwarded_by uuid references public.profiles (id);

-- RLS: any Front Desk may SELECT open coordination rows (still no verify permission).
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
    or public.is_front_desk()
  );

drop policy if exists counselling_fee_vr_update on public.counselling_fee_verification_requests;
create policy counselling_fee_vr_update on public.counselling_fee_verification_requests
  for update to authenticated
  using (
    public.is_admin()
    or registrar_id = auth.uid()
    or public.is_front_desk()
    or public.can_verify_signup_fee()
  )
  with check (
    public.is_admin()
    or registrar_id = auth.uid()
    or public.is_front_desk()
    or public.can_verify_signup_fee()
  );

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
  coordinator_note text,
  forwarded_at timestamptz,
  forwarded_by uuid,
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
    r.coordinator_note,
    r.forwarded_at,
    r.forwarded_by,
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
      or public.is_front_desk()
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

-- Front Desk forwards open request to Accounts / Finance (status → in_progress).
create or replace function public.forward_counselling_fee_verification(
  p_request_id uuid,
  p_note text default null
)
returns public.counselling_fee_verification_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.counselling_fee_verification_requests%rowtype;
  v_note text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not (public.is_admin() or public.is_front_desk()) then
    raise exception 'Not authorized';
  end if;

  v_note := nullif(trim(coalesce(p_note, '')), '');

  select * into v_row
  from public.counselling_fee_verification_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Fee verification request not found';
  end if;

  if v_row.status = 'in_progress' and v_row.forwarded_at is not null then
    return v_row; -- idempotent
  end if;

  if v_row.status not in ('open', 'in_progress') then
    raise exception 'Only open requests can be forwarded to Accounts';
  end if;

  update public.counselling_fee_verification_requests
  set
    status = 'in_progress',
    forwarded_at = coalesce(forwarded_at, now()),
    forwarded_by = coalesce(forwarded_by, auth.uid()),
    coordinator_note = coalesce(v_note, coordinator_note),
    updated_at = now()
  where id = p_request_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.forward_counselling_fee_verification(uuid, text) from public;
revoke all on function public.forward_counselling_fee_verification(uuid, text) from anon;
grant execute on function public.forward_counselling_fee_verification(uuid, text) to authenticated;

-- Front Desk returns incomplete request to counsellor (status → cancelled + note).
create or replace function public.return_counselling_fee_verification(
  p_request_id uuid,
  p_reason text
)
returns public.counselling_fee_verification_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.counselling_fee_verification_requests%rowtype;
  v_reason text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not (public.is_admin() or public.is_front_desk()) then
    raise exception 'Not authorized';
  end if;

  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if v_reason is null or char_length(v_reason) < 5 then
    raise exception 'A return reason is required (at least 5 characters).';
  end if;

  select * into v_row
  from public.counselling_fee_verification_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Fee verification request not found';
  end if;

  if v_row.status not in ('open', 'in_progress') then
    raise exception 'Only open or in-progress requests can be returned to the counsellor';
  end if;

  update public.counselling_fee_verification_requests
  set
    status = 'cancelled',
    coordinator_note = v_reason,
    updated_at = now()
  where id = p_request_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.return_counselling_fee_verification(uuid, text) from public;
revoke all on function public.return_counselling_fee_verification(uuid, text) from anon;
grant execute on function public.return_counselling_fee_verification(uuid, text) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.counselling_fee_verification_requests;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
