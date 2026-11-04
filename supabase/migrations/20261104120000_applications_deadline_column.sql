-- Ensure applications.deadline exists on remotes where the table was created
-- without this column (CREATE TABLE IF NOT EXISTS in 20261010010000 cannot
-- add columns to a pre-existing table).
-- Nullable: optional university application deadline; never invent defaults.

alter table public.applications
  add column if not exists deadline date;

comment on column public.applications.deadline is
  'Optional university application deadline (calendar date). Null when unknown.';

-- PostgREST / Supabase API schema cache
notify pgrst, 'reload schema';
