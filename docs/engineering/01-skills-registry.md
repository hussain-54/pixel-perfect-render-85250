# Skills registry

**Created:** 2026-11-22  
**Location:** `.cursor/skills/*/SKILL.md`

| Skill `name`                           | Path                                                           | Applied when                                                                        |
| -------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `globalroots-architecture-auditor`     | `.cursor/skills/globalroots-architecture-auditor/SKILL.md`     | Structure reviews; new modules; route/server consistency; Phase 2 architecture pass |
| `globalroots-supabase-security`        | `.cursor/skills/globalroots-supabase-security/SKILL.md`        | Authz/RLS/RPC/secrets/IDOR; any security-sensitive change; Phase 2 security pass    |
| `globalroots-uiux-design-system`       | `.cursor/skills/globalroots-uiux-design-system/SKILL.md`       | Portal/marketing UI; motion/a11y; design consistency (Priority 8)                   |
| `globalroots-portal-workflow-auditor`  | `.cursor/skills/globalroots-portal-workflow-auditor/SKILL.md`  | Lifecycle handoffs FD→Counsellor→Finance→Admission→Student                          |
| `globalroots-finance-integrity`        | `.cursor/skills/globalroots-finance-integrity/SKILL.md`        | Signup/university fees; vouchers; banking desk; SoD; Priority 2                     |
| `globalroots-cms-editorial-management` | `.cursor/skills/globalroots-cms-editorial-management/SKILL.md` | CMS/blog publish/SEO/media; Priority 7                                              |
| `globalroots-qa-automation`            | `.cursor/skills/globalroots-qa-automation/SKILL.md`            | After fixes; Phase 5 QA; regression evidence                                        |
| `globalroots-release-readiness`        | `.cursor/skills/globalroots-release-readiness/SKILL.md`        | Phase 6 final report; pre-deploy go/no-go                                           |

## Never-do consistency check

All eight skills share: no service-role client/`VITE_*`; no RLS weakening; no mock financial success; no prod reset; no push without approval. Release skill additionally forbids force-push / Lovable history rewrite. Finance skill additionally forbids silent amount overrides without audit. CMS skill forbids exposing drafts via public RLS. No conflicting permissions.

## Validation

- [x] Every skill directory contains readable `SKILL.md` with `name` + `description` frontmatter
- [x] README index lists all eight
- [x] No application feature code changed in Phase 1
