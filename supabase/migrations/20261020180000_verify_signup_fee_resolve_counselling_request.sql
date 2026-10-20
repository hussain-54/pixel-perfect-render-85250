-- =============================================================================
-- Atomic: signup-fee verify/waive/reject also resolves counselling fee requests
-- in the same transaction. Adds auditable reconcile from fee truth (never invents
-- a verification). Local file is not proof of remote apply.
-- =============================================================================

create or replace function public.verify_signup_fee_and_activate(
  p_fee_id uuid,
  p_student_id uuid,
  p_action text,
  p_notes text default null,
  p_activate_portal boolean default true
)
returns table (
  fee_id uuid,
  student_id uuid,
  status public.signup_fee_status,
  portal_activated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next public.signup_fee_status;
  v_fee public.signup_fee_payments%rowtype;
  v_activated timestamptz;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_action not in ('verify', 'waive', 'reject') then
    raise exception 'invalid action';
  end if;

  if not public.can_verify_signup_fee() then
    raise exception 'not authorized to verify signup fees';
  end if;

  v_next := case p_action
    when 'verify' then 'verified'::public.signup_fee_status
    when 'waive' then 'waived'::public.signup_fee_status
    else 'rejected'::public.signup_fee_status
  end;

  select *
  into v_fee
  from public.signup_fee_payments f
  where f.id = p_fee_id
    and f.student_id = p_student_id
  for update;

  if not found then
    raise exception 'signup fee row not found for student';
  end if;

  update public.signup_fee_payments f
  set
    status = v_next,
    verified_by = auth.uid(),
    verified_at = now(),
    notes = coalesce(nullif(trim(p_notes), ''), f.notes)
  where f.id = v_fee.id
  returning * into v_fee;

  v_activated := null;
  if p_activate_portal and v_next in ('verified', 'waived') then
    update public.students s
    set portal_activated_at = coalesce(s.portal_activated_at, now())
    where s.id = p_student_id
    returning s.portal_activated_at into v_activated;

    if not found then
      raise exception 'student row missing during activation';
    end if;
  else
    select s.portal_activated_at into v_activated
    from public.students s
    where s.id = p_student_id;
  end if;

  -- Same transaction: close open counsellor → FD coordination requests.
  -- Fee status remains the payment source of truth; request status tracks process.
  update public.counselling_fee_verification_requests r
  set
    status = 'resolved',
    resolved_at = coalesce(r.resolved_at, now()),
    resolved_by = coalesce(r.resolved_by, auth.uid())
  where r.student_id = p_student_id
    and r.status in ('open', 'in_progress');

  return query
  select v_fee.id, v_fee.student_id, v_fee.status, v_activated;
end;
$$;

comment on function public.verify_signup_fee_and_activate(uuid, uuid, text, text, boolean) is
  'Single-transaction signup-fee verify/waive/reject, optional portal activation, and resolve of open counselling fee-verification requests.';

-- Reconcile stuck requests from authoritative fee status (never invents a verification).
create or replace function public.reconcile_counselling_fee_request_from_fee(
  p_student_id uuid
)
returns table (
  student_id uuid,
  fee_status public.signup_fee_status,
  requests_resolved integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee public.signup_fee_payments%rowtype;
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if not (
    public.is_admin()
    or public.is_front_desk()
    or public.can_verify_signup_fee()
  ) then
    raise exception 'not authorized to reconcile fee verification requests';
  end if;

  select *
  into v_fee
  from public.signup_fee_payments f
  where f.student_id = p_student_id
  order by f.created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'signup fee row not found for student';
  end if;

  if v_fee.status not in (
    'verified'::public.signup_fee_status,
    'waived'::public.signup_fee_status,
    'rejected'::public.signup_fee_status
  ) then
    raise exception 'fee is not in a terminal verified/waived/rejected state';
  end if;

  update public.counselling_fee_verification_requests r
  set
    status = 'resolved',
    resolved_at = coalesce(r.resolved_at, now()),
    resolved_by = coalesce(r.resolved_by, auth.uid())
  where r.student_id = p_student_id
    and r.status in ('open', 'in_progress');

  get diagnostics v_count = row_count;

  return query
  select p_student_id, v_fee.status, v_count;
end;
$$;

revoke all on function public.reconcile_counselling_fee_request_from_fee(uuid) from public;
revoke all on function public.reconcile_counselling_fee_request_from_fee(uuid) from anon;
grant execute on function public.reconcile_counselling_fee_request_from_fee(uuid) to authenticated;

comment on function public.reconcile_counselling_fee_request_from_fee(uuid) is
  'Closes open/in_progress counselling fee-verification requests only when signup fee is already verified, waived, or rejected. Does not change fee status.';

-- Expose fee verified_at on the FD list for outcome display.
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
  fee_verified_at timestamptz,
  requested_by uuid,
  registrar_id uuid,
  coordinator_note text,
  forwarded_at timestamptz,
  forwarded_by uuid,
  resolved_at timestamptz,
  resolved_by uuid,
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
    f.verified_at as fee_verified_at,
    r.requested_by,
    r.registrar_id,
    r.coordinator_note,
    r.forwarded_at,
    r.forwarded_by,
    r.resolved_at,
    r.resolved_by,
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
