-- =============================================================================
-- Audit trail hardening: more trusted writers, explicit revoke of UPDATE/DELETE,
-- block anon, and consultant-scoped SELECT. Append-only remains via trigger.
-- DO NOT apply without explicit approval.
-- =============================================================================

-- Ensure append-only trigger exists (idempotent with foundation migration).
create or replace function public.reject_audit_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_events is append-only';
end;
$$;

drop trigger if exists audit_events_no_update on public.audit_events;
create trigger audit_events_no_update
  before update or delete on public.audit_events
  for each row execute function public.reject_audit_mutation();

-- Explicit table privileges (do not rely on UI hiding alone).
revoke all on table public.audit_events from anon;
revoke update, delete, truncate on table public.audit_events from authenticated;
revoke update, delete, truncate on table public.audit_events from public;
grant select, insert on table public.audit_events to authenticated;

-- Students must not read the officer audit trail.
drop policy if exists audit_select_staff on public.audit_events;
create policy audit_select_staff on public.audit_events
  for select to authenticated
  using (
    public.is_admin()
    or (
      public.is_consultant()
      and (
        student_id is null
        or public.is_assigned_consultant(student_id)
      )
    )
  );

-- Inserts only as self (or null actor for security-definer writers).
drop policy if exists audit_insert_authenticated on public.audit_events;
create policy audit_insert_authenticated on public.audit_events
  for insert to authenticated
  with check (actor_id = auth.uid() or actor_id is null);

-- No UPDATE/DELETE policies on purpose — combined with REVOKE + trigger.

-- Trusted writers for application stage history
create or replace function public.audit_application_stage_history()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.write_audit_event(
    'application_stage_' || coalesce(new.to_stage::text, 'changed'),
    'application',
    new.application_id,
    (select student_id from public.applications where id = new.application_id),
    jsonb_build_object(
      'from_stage', new.from_stage,
      'to_stage', new.to_stage,
      'note', new.note
    )
  );
  return new;
end;
$$;

drop trigger if exists application_stage_history_audit on public.application_stage_history;
create trigger application_stage_history_audit
  after insert on public.application_stage_history
  for each row execute function public.audit_application_stage_history();

-- Trusted writers for offers
create or replace function public.audit_offer_mutation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  action_text text;
begin
  if tg_op = 'INSERT' then
    action_text := 'offer_created';
  else
    action_text := 'offer_status_' || coalesce(new.status::text, 'updated');
  end if;
  perform public.write_audit_event(
    action_text,
    'offer',
    new.id,
    new.student_id,
    jsonb_build_object(
      'application_id', new.application_id,
      'status', new.status,
      'offer_type', new.offer_type
    )
  );
  return new;
end;
$$;

drop trigger if exists offers_audit_ins on public.offers;
create trigger offers_audit_ins
  after insert on public.offers
  for each row execute function public.audit_offer_mutation();

drop trigger if exists offers_audit_upd on public.offers;
create trigger offers_audit_upd
  after update of status on public.offers
  for each row
  when (old.status is distinct from new.status)
  execute function public.audit_offer_mutation();

-- Internal notes
create or replace function public.audit_internal_note()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.write_audit_event(
    'assessment_note_added',
    'internal_note',
    new.id,
    new.student_id,
    jsonb_build_object('pinned', new.pinned)
  );
  return new;
end;
$$;

drop trigger if exists internal_notes_audit on public.internal_notes;
create trigger internal_notes_audit
  after insert on public.internal_notes
  for each row execute function public.audit_internal_note();

-- Visa decision / stage changes
create or replace function public.audit_visa_milestone()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.write_audit_event(
    'visa_' || coalesce(new.stage::text, 'updated'),
    'visa_milestone',
    new.id,
    new.student_id,
    jsonb_build_object(
      'application_id', new.application_id,
      'stage', new.stage,
      'decision', new.decision
    )
  );
  return new;
end;
$$;

drop trigger if exists visa_milestones_audit on public.visa_milestones;
create trigger visa_milestones_audit
  after insert or update of stage, decision on public.visa_milestones
  for each row execute function public.audit_visa_milestone();