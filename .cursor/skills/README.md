# GlobalRoots project Cursor skills

Project skills for the GlobalRoots Complete Engineering Transformation. Each skill is a directory with `SKILL.md` (YAML frontmatter: `name`, `description`).

| Skill                   | Path                                    | Use when                                         |
| ----------------------- | --------------------------------------- | ------------------------------------------------ |
| Architecture auditor    | `globalroots-architecture-auditor/`     | Routes, server fns, data plane, duplication      |
| Supabase security       | `globalroots-supabase-security/`        | Auth, RLS, RPC, storage, secrets, IDOR           |
| UI/UX design system     | `globalroots-uiux-design-system/`       | Tokens, portals, a11y, motion + reduced-motion   |
| Portal workflow auditor | `globalroots-portal-workflow-auditor/`  | FD → Counsellor → Finance → Admission → Student  |
| Finance integrity       | `globalroots-finance-integrity/`        | Fees, vouchers, banking desk, SoD, audit         |
| CMS editorial           | `globalroots-cms-editorial-management/` | Website CMS + blog draft/publish/SEO/media       |
| QA automation           | `globalroots-qa-automation/`            | Vitest/lint/build; E2E plan; role matrices       |
| Release readiness       | `globalroots-release-readiness/`        | Migrations, env, Vercel, rollback, no force-push |

Registry with activation conditions: `docs/engineering/01-skills-registry.md`.

**Shared never-dos (all skills):** no service-role in client; no RLS weakening; no mock financial success; no prod reset; no push/deploy without explicit approval.
