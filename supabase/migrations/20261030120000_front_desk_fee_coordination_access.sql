-- Align Front Desk org-wide fee-coordination queue with intake record load +
-- signup-fee voucher/proof writes. Fee VERIFY remains Accounts-only.
-- Does not broaden students SELECT RLS or invent verification.

create or replace function public.front_desk_can_coordinate_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or (
      public.is_front_desk()
      and (
        public.is_intake_registrar(p_student_id)
        or exists (
          select 1
          from public.counselling_fee_verification_requests r
          where r.student_id = p_student_id
        )
      )
    );
$$;

comment on function public.front_desk_can_coordinate_student(uuid) is
  'Front Desk may open/coordinate a student when they registered them or a counselling fee-verification request exists (org queue). Never grants fee verify.';

revoke all on function public.front_desk_can_coordinate_student(uuid) from public;
revoke all on function public.front_desk_can_coordinate_student(uuid) from anon;
grant execute on function public.front_desk_can_coordinate_student(uuid) to authenticated;

-- Single-student intake summary for Fix / Open deep-links (registrar OR coordination).
create or replace function public.get_front_desk_intake_record(p_student_id uuid)
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
  inquiry_source text,
  inquiry_channel public.inquiry_channel,
  intake_date date,
  registration_notes text,
  next_follow_up_at date,
  assigned_consultant_id uuid,
  registered_by uuid,
  journey_stage public.journey_stage,
  portal_activated_at timestamptz,
  profile_id uuid,
  archived_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  signup_fee_status public.signup_fee_status,
  signup_fee_amount numeric,
  signup_fee_currency text,
  signup_fee_method text,
  signup_fee_reference text,
  counsellor_name text,
  registrar_name text,
  viewer_is_registrar boolean
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

  if not (public.is_admin() or public.is_front_desk()) then
    raise exception 'Not authorized';
  end if;

  if p_student_id is null then
    raise exception 'Student id is required';
  end if;

  if not public.front_desk_can_coordinate_student(p_student_id) then
    raise exception 'Not authorized';
  end if;

  return query
  select
    s.id,
    s.case_id,
    s.full_name,
    s.email,
    s.phone,
    s.whatsapp,
    s.city,
    s.destination,
    s.program,
    s.study_level,
    s.inquiry_source,
    s.inquiry_channel,
    s.intake_date,
    s.registration_notes,
    s.next_follow_up_at,
    s.assigned_consultant_id,
    s.registered_by,
    s.journey_stage,
    s.portal_activated_at,
    s.profile_id,
    s.archived_at,
    s.created_at,
    s.updated_at,
    f.status as signup_fee_status,
    f.amount as signup_fee_amount,
    f.currency as signup_fee_currency,
    f.payment_method as signup_fee_method,
    f.reference_receipt as signup_fee_reference,
    cp.full_name as counsellor_name,
    rp.full_name as registrar_name,
    (
      public.is_admin()
      or s.registered_by = auth.uid()
    ) as viewer_is_registrar
  from public.students s
  left join public.signup_fee_payments f on f.student_id = s.id
  left join public.profiles cp on cp.id = s.assigned_consultant_id
  left join public.profiles rp on rp.id = s.registered_by
  where s.id = p_student_id
    and s.archived_at is null;
end;
$$;

revoke all on function public.get_front_desk_intake_record(uuid) from public;
revoke all on function public.get_front_desk_intake_record(uuid) from anon;
grant execute on function public.get_front_desk_intake_record(uuid) to authenticated;

-- Fee ledger: Front Desk coordinators may read and write unpaid/claimed (and reopen rejected).
-- VERIFY / WAIVE remain can_verify_signup_fee only (guard + policy).
drop policy if exists signup_fee_select on public.signup_fee_payments;
create policy signup_fee_select on public.signup_fee_payments
  for select
  to authenticated
  using (
    public.can_verify_signup_fee()
    or public.can_access_student(student_id)
    or public.is_front_desk_fee_registrar(student_id)
    or public.front_desk_can_coordinate_student(student_id)
  );

drop policy if exists signup_fee_insert on public.signup_fee_payments;
create policy signup_fee_insert on public.signup_fee_payments
  for insert
  to authenticated
  with check (
    public.can_record_intake()
    and (
      public.can_access_student(student_id)
      or public.is_front_desk_fee_registrar(student_id)
      or public.front_desk_can_coordinate_student(student_id)
    )
    and (
      public.can_verify_signup_fee()
      or status in ('unpaid', 'claimed')
    )
    and verified_by is null
    and verified_at is null
    and (recorded_by is null or recorded_by = auth.uid())
  );

drop policy if exists signup_fee_update on public.signup_fee_payments;
create policy signup_fee_update on public.signup_fee_payments
  for update
  to authenticated
  using (
    public.can_verify_signup_fee()
    or (
      public.can_access_student(student_id)
      and public.can_staff_mutate_student(student_id)
      and status in ('unpaid', 'claimed')
    )
    or (
      public.is_front_desk_fee_registrar(student_id)
      and status in ('unpaid', 'claimed', 'rejected')
    )
    or (
      public.front_desk_can_coordinate_student(student_id)
      and status in ('unpaid', 'claimed', 'rejected')
    )
  )
  with check (
    public.can_verify_signup_fee()
    or (
      (
        public.can_access_student(student_id)
        or public.is_front_desk_fee_registrar(student_id)
        or public.front_desk_can_coordinate_student(student_id)
      )
      and status in ('unpaid', 'claimed')
      and verified_by is null
      and verified_at is null
      and (recorded_by is null or recorded_by = auth.uid())
    )
  );
