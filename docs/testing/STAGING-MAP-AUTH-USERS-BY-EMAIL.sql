-- =============================================================================
-- OBSOLETE — do not use for active setup
-- =============================================================================
-- This script previously mapped three placeholder staging emails
-- (Admin / Admission Officer / Student). That flow is retired.
--
-- Use instead:
--   1) docs/testing/DESIGNATE-PRIMARY-ADMIN.sql
--      → designate hussaindurrani92@gmail.com as primary admin (owner SQL)
--   2) Admin portal → Accounts (/admin/accounts)
--      → invite employees with business role + secure password-setup email
--
-- Do NOT delete Auth users or database records from this file.
-- Do NOT run the old REPLACE_WITH_REAL_* / @example.com placeholder mapping.
-- =============================================================================

select
  'OBSOLETE: use DESIGNATE-PRIMARY-ADMIN.sql then Admin → Accounts'
    as notice;
