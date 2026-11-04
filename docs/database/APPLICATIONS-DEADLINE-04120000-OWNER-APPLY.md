# Owner apply — `applications.deadline` column

**Migration:** `supabase/migrations/20261104120000_applications_deadline_column.sql`  
**Project ref:** `gjasuvlqfofpvrqvvnyz`  
**Why:** Live PostgREST returns `42703 column applications.deadline does not exist` while `applications` itself exists. Repo foundation SQL defined `deadline`, but `CREATE TABLE IF NOT EXISTS` cannot add columns to a pre-existing table — remotes that already had `applications` never received `deadline`.

## Apply (Dashboard SQL Editor)

1. Confirm project picker is **`gjasuvlqfofpvrqvvnyz`**.
2. Open SQL Editor → New query.
3. Paste and run the full contents of `20261104120000_applications_deadline_column.sql`.
4. Verify:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'applications'
  and column_name = 'deadline';
-- expect: deadline | date | YES
```

5. If inserts still fail with schema-cache wording after a minute, run:

```sql
notify pgrst, 'reload schema';
```

Or restart the API from Project Settings → API (Supabase-supported cache refresh).

## App verification (Admission Team)

1. Create application **without** deadline → succeeds; list shows row; deadline displays as —.
2. Create application **with** deadline `YYYY-MM-DD` → persists and displays.
3. Existing applications without deadline still load.
4. Unauthorized roles cannot create applications (unchanged RLS / module permission).

## Do not

- Manually invent default deadlines for existing rows.
- Create a second deadline column under another name.
- Apply this against a different Supabase project.
