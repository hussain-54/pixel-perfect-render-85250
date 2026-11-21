---
name: globalroots-portal-workflow-auditor
description: >-
  Audit GlobalRoots end-to-end portal workflows — Front Desk → Counsellor →
  Finance → Admission → Student. Use when tracing handoffs, fee gates,
  registration, or specialty desk routing.
---

# GlobalRoots Portal Workflow Auditor

## Purpose / triggers

Apply when reviewing student lifecycle handoffs, intake registration, counsellor assessment, fee verification requests, admission accept/return, or student self-service.

## Repo inspection steps

1. Front Desk: `staff/front-desk`, `intake`, `register`; `portal-front-desk.ts`, `portal-intake.ts` (`portalIntakeRegisterStudent`, signup fee record/voucher).
2. Counsellor: assignment (`portalAssignCounsellor`), consent/agreement, assessment (`portalSaveStudentAssessment`), `portalRequestFeeVerification`, handover (`portalHandoverToAdmission`).
3. Finance: Fees & Payments (`admin/finance`, `staff/finance`, `portal-finance.ts`, verify RPCs) vs Banking desk (`*/banking`, `portal-finance-desk.ts`) — do not conflate.
4. Admission: queues (`portalListAdmissionHandovers`, `portalUpdateAdmissionHandover`), applications pipeline.
5. Student: claim record, self-only profile/docs/appointments; signup fee gate.
6. Permissions: matrix levels per role for each step; specialty desk route guards.

## Execution steps

1. Document happy path + failure/return paths with server fn names.
2. Verify each mutate has server authz + DB RPC/RLS alignment.
3. Flag UI that implies success without awaiting server result.

## Quality / security constraints

- Preserve separation of duties (e.g. registrar vs verifier where encoded).
- Demo admission data plane stays blocked.

## Testing requirements

- Workflow rule tests: `m1-workflow`, fee verification, handover, signup-fee-*, counsellor/admission rules.
- Regression after any handoff change.

## Deliverables

- Workflow map with statuses PASS / NEEDS REVIEW / BLOCKED / NOT TESTED per stage.

## Never-do

- No service-role in client
- No RLS weakening
- No mock financial success
- No prod reset
- No push without approval
