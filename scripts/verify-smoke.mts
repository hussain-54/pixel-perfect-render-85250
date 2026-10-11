import { ALLOWED_STAGE_TRANSITIONS } from "../src/types/applications-pipeline.ts";
import { createSystemTaskIdempotent } from "../src/data/portal-tasks.ts";
import { runTaskAutomationSweep } from "../src/server/task-automation.ts";
import { listAuditEvents, updateAuditEvent, deleteAuditEvent, appendAuditEvent } from "../src/data/immutable-audit.ts";
import { casI20TypeForCountry } from "../src/types/offers-visa.ts";
import { dayKeyInPortalTz, daysUntilDateKey, todayKey } from "../src/lib/task-time.ts";
import { REPORT_METRIC_DEFINITIONS } from "../src/types/reports-ops.ts";
import fs from "fs";

const results = [];
const push = (id, pass, detail) => results.push({ id, pass, detail });

push("stage_invalid_skip", !ALLOWED_STAGE_TRANSITIONS["Docs Pending"].includes("Submitted"), "Docs Pending -> Submitted blocked");
push("stage_valid_path", ALLOWED_STAGE_TRANSITIONS["Docs Pending"].includes("Under Review"), "Docs Pending -> Under Review allowed");

const ref = "auto:verify-dup-test:1";
const a = createSystemTaskIdempotent({ reminderRef: ref, title: "Dup test", studentId: "s1", assigneeId: "c1", dueAt: new Date().toISOString(), priorityLevel: "high" });
const b = createSystemTaskIdempotent({ reminderRef: ref, title: "Dup test", studentId: "s1", assigneeId: "c1", dueAt: new Date().toISOString(), priorityLevel: "high" });
push("task_idempotent", a.created === true && b.created === false, `first=${a.created} second=${b.created}`);

const r1 = runTaskAutomationSweep();
const r2 = runTaskAutomationSweep();
push("sweep_idempotent", r2.created === 0, `firstCreated=${r1.created} secondCreated=${r2.created}`);

let upd=false, del=false;
try { updateAuditEvent(); } catch { upd=true; }
try { deleteAuditEvent(); } catch { del=true; }
const before = listAuditEvents().length;
appendAuditEvent({ actorName: "Verifier", action: "Verification probe", entityType: "Test", entityId: "probe-1", studentId: "s1" });
const after = listAuditEvents().length;
push("audit_append_only", upd && del && after === before + 1, `upd=${upd} del=${del} ${before}->${after}`);

push("cas_uk", casI20TypeForCountry("UK") === "CAS", String(casI20TypeForCountry("UK")));
push("i20_usa", casI20TypeForCountry("USA") === "I-20", String(casI20TypeForCountry("USA")));
push("cas_canada_null", casI20TypeForCountry("Canada") === null, String(casI20TypeForCountry("Canada")));

const today = todayKey();
push("tz_today", /^\d{4}-\d{2}-\d{2}$/.test(today), today);
push("days_until", daysUntilDateKey(today) === 0, String(daysUntilDateKey(today)));
push("missing_date", dayKeyInPortalTz(null) === null && dayKeyInPortalTz("—") === null, "null/em-dash skipped");
push("report_defs", Object.keys(REPORT_METRIC_DEFINITIONS).length >= 8, Object.keys(REPORT_METRIC_DEFINITIONS).join(","));

const out = { passed: results.filter(r=>r.pass).length, failed: results.filter(r=>!r.pass).length, results };
fs.mkdirSync(".data", { recursive: true });
fs.writeFileSync(".data/verify-smoke.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out));
process.exit(out.failed ? 1 : 0);