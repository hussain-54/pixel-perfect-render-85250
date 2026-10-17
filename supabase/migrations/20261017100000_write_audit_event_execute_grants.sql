-- =============================================================================
-- Ensure authenticated can EXECUTE public.write_audit_event (Front Desk intake)
-- Forward-only. DO NOT apply without owner confirmation.
--
-- Symptom: intake_register_student succeeds, then app writeAudit fails with
--   permission denied for function write_audit_event (42501)
-- leaving a created student while the UI reports total failure.
--
-- Does NOT change function body, RLS, or audit_events policies.
-- Does NOT grant EXECUTE to PUBLIC or anon.
-- =============================================================================

revoke all on function public.write_audit_event(text, text, uuid, uuid, jsonb) from public;
revoke all on function public.write_audit_event(text, text, uuid, uuid, jsonb) from anon;

-- Authenticated JWTs (Front Desk / staff / admin) call this via PostgREST after mutations.
grant execute on function public.write_audit_event(text, text, uuid, uuid, jsonb) to authenticated;

comment on function public.write_audit_event(text, text, uuid, uuid, jsonb) is
  'Append-only audit writer (SECURITY DEFINER, search_path=public). EXECUTE: authenticated only — not PUBLIC/anon. Requires auth.uid().';
