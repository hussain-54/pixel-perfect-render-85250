-- Publish signup_fee_payments for Finance / Student Realtime refresh.
-- Why: Accounts ledger and student fee status had no Realtime publication;
-- clients polled only. Does not change RLS or verification RPCs.
-- Safe to re-run: ignores if already in publication.

do $$
begin
  alter publication supabase_realtime add table public.signup_fee_payments;
exception
  when duplicate_object then
    null;
  when undefined_object then
    raise notice 'supabase_realtime publication missing — skip (hosted Realtime may differ)';
end $$;
