-- =============================================================================
-- Phase B2 - Narrow public consultation INSERT (unauthenticated visitors)
-- Forward-only. DO NOT apply without approval.
--
-- Architecture: portalSubmitConsultation validates with Zod, then inserts via
-- the publishable/anon Supabase client (no service-role key). Direct anon INSERT
-- must therefore be allowed, but only for the public lead fields.
--
-- Probe evidence (prior session): INSERT as anon failed with 42501 (RLS).
-- This draft was never applied; content tightened before first apply.
-- =============================================================================

alter table if exists public.consultation_requests enable row level security;

-- Public may INSERT only. No SELECT / UPDATE / DELETE for anon.
drop policy if exists consultation_insert_public on public.consultation_requests;
create policy consultation_insert_public on public.consultation_requests
  for insert to anon, authenticated
  with check (
    length(btrim(full_name)) > 1
    and length(btrim(email)) > 3
    and length(btrim(phone)) >= 8
    and reference_code ~ '^REQ-[A-Z0-9]+$'
    -- Reject workflow spoofing on the public insert path
    and status = 'new'
    and assigned_consultant_id is null
  );

-- Least privilege: anon insert only. Staff SELECT/UPDATE stay in
-- 20261010153000_rls_security_hardening.sql (consultation_select_staff /
-- consultation_update_staff).
revoke all on table public.consultation_requests from anon;
grant insert on table public.consultation_requests to anon;

revoke all on table public.consultation_requests from authenticated;
grant insert, select, update on table public.consultation_requests to authenticated;
