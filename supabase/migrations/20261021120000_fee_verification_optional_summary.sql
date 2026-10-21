-- Optional counsellor notes on fee-verification requests.
-- Empty summary stores a factual default action label (not invented case content).

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
  if v_summary is null then
    v_summary := 'Signup fee verification requested';
  end if;
  if char_length(v_summary) > 2000 then
    raise exception 'Keep the verification note under 2000 characters.';
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

comment on function public.request_counselling_fee_verification(uuid, text) is
  'Counsellor requests Front Desk fee verification. Summary notes are optional; empty uses a factual default label.';
