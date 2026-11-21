/**
 * Banking & Finance desk — office ledger + student fee balances overview.
 * Student fee verification remains under Fees & Payments (portal-finance / portal-intake).
 */
import { createServerFn } from "@tanstack/react-start";
import { AuthError, requireRoles, requireTrustedSession } from "@/server/portal-auth";
import { denyFrontDeskConsultantWorkflows, requireModulePermission } from "@/server/staff-access";
import {
  computeBooks,
  isMissingFinanceDeskRelation,
  NON_POSTABLE_KINDS,
  parseFinanceDeskEntryDetail,
  validateFinanceDeskWrite,
  type FinanceDeskAudit,
  type FinanceDeskBill,
  type FinanceDeskEntry,
  type FinanceDeskEntryDetail,
  type FinanceDeskSnapshot,
} from "@/lib/finance-desk";

function toError(error: unknown): never {
  if (error instanceof AuthError) {
    throw new Error(`${error.status}:${error.message}`);
  }
  throw error instanceof Error ? error : new Error("Finance desk authorization failed.");
}

const SCHEMA_NOTE =
  "Finance desk tables are not available yet. Apply migration 20261108160000_finance_desk_foundation.sql.";

async function requireFinanceDeskView() {
  const session = await requireTrustedSession();
  requireRoles(session, ["consultant", "admin", "super_admin"]);
  denyFrontDeskConsultantWorkflows(session, "finance desk");
  await requireModulePermission(session, "banking_finance", 1, "Banking & Finance");
  return session;
}

async function requireFinanceDeskMutate() {
  const session = await requireTrustedSession();
  requireRoles(session, ["consultant", "admin", "super_admin"]);
  denyFrontDeskConsultantWorkflows(session, "finance desk");
  await requireModulePermission(session, "banking_finance", 2, "Banking & Finance changes");
  return session;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;
function deskDb(client: unknown): AnyDb {
  return client as AnyDb;
}

function mapEntry(row: Record<string, unknown>): FinanceDeskEntry {
  const detail = parseFinanceDeskEntryDetail(row["detail"]);
  return {
    id: String(row["id"]),
    kind: String(row["kind"] ?? ""),
    title: String(row["title"] ?? ""),
    amount: Number(row["amount"] ?? 0),
    currency: String(row["currency"] ?? "PKR"),
    status: String(row["status"] ?? "draft") as FinanceDeskEntry["status"],
    entryDate: String(row["entry_date"] ?? "").slice(0, 10),
    detail,
    studentId: (row["student_id"] as string | null) ?? null,
    parentId: (row["parent_id"] as string | null) ?? null,
    createdAt: String(row["created_at"] ?? ""),
  };
}

function mapAudit(row: Record<string, unknown>): FinanceDeskAudit {
  return {
    id: String(row["id"]),
    action: String(row["action"] ?? ""),
    target: String(row["target"] ?? ""),
    detail: String(row["detail"] ?? ""),
    createdAt: String(row["created_at"] ?? ""),
  };
}

function emptySnapshot(note: string, schemaReady: boolean): FinanceDeskSnapshot {
  return {
    schemaReady,
    note,
    lock: "open",
    connections: {
      FBR: false,
      SRB: false,
      PRA: false,
      KPRA: false,
      BRA: false,
    },
    books: {
      assets: 0,
      liabilities: 0,
      equity: 0,
      income: 0,
      expenses: 0,
      profit: 0,
      equation: true,
      debit: 0,
      credit: 0,
    },
    cash: 0,
    petty: 0,
    receivable: 0,
    payable: 0,
    salaryPayable: 0,
    loanPayable: 0,
    taxPayable: 0,
    clientFunds: 0,
    investments: 0,
    clearing: 0,
    pendingOpsExpenses: 0,
    pendingUniversityFees: 0,
    pendingSignupFees: 0,
    bills: [],
    entries: [],
    audits: [],
    feesHref: "/admin/finance",
    operationsHref: "/admin/operations",
  };
}

export const portalGetFinanceDesk = createServerFn({ method: "GET" })
  .validator((data: { staffShell?: boolean } | undefined) => data ?? {})
  .handler(async ({ data }): Promise<FinanceDeskSnapshot> => {
    try {
      const session = await requireFinanceDeskView();
      const staffShell = Boolean(data.staffShell);
      const base = emptySnapshot(
        "GlobalRoots Banking & Finance desk. Student fee verification stays in Fees & Payments. Office ledger drafts are not student tuition.",
        true,
      );
      base.feesHref = staffShell ? "/staff/finance" : "/admin/finance";
      base.operationsHref = staffShell ? "/staff/operations" : "/admin/operations";

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        return {
          ...base,
          schemaReady: false,
          note: "Finance desk requires the live data plane.",
        };
      }
      const client = deskDb(requireAoSupabaseClient());

      // Student fee balances (real ledgers — not inventing paid amounts beyond status).
      const bills: FinanceDeskBill[] = [];
      let pendingSignupFees = 0;
      let pendingUniversityFees = 0;
      let receivable = 0;

      const signupRes = await client
        .from("signup_fee_payments")
        .select("id, student_id, amount, status, currency, students(full_name, case_id)")
        .order("updated_at", { ascending: false })
        .limit(200);
      if (!signupRes.error && signupRes.data) {
        for (const row of signupRes.data as Record<string, unknown>[]) {
          const amount = Number(row["amount"] ?? 0);
          const status = String(row["status"] ?? "");
          const paid = status === "verified" || status === "waived" ? amount : 0;
          const outstanding = status === "verified" || status === "waived" ? 0 : amount;
          if (["unpaid", "claimed", "pending"].includes(status) || status === "claimed") {
            pendingSignupFees += 1;
          }
          if (outstanding > 0) receivable += outstanding;
          const student = row["students"] as
            { full_name?: string; case_id?: string } | null | undefined;
          bills.push({
            id: String(row["id"]),
            studentId: String(row["student_id"] ?? ""),
            studentName: student?.full_name || student?.case_id || "Student",
            title: "Signup / intake fee",
            amount,
            paid,
            outstanding,
            source: "signup",
            status,
          });
        }
      }

      const uniRes = await client
        .from("university_fee_obligations")
        .select("id, student_id, label, amount, status, kind, students(full_name, case_id)")
        .order("updated_at", { ascending: false })
        .limit(200);
      if (!uniRes.error && uniRes.data) {
        for (const row of uniRes.data as Record<string, unknown>[]) {
          const amount = Number(row["amount"] ?? 0);
          const status = String(row["status"] ?? "");
          const paid = status === "verified" || status === "waived" ? amount : 0;
          const outstanding = status === "verified" || status === "waived" ? 0 : amount;
          if (status === "due" || status === "claimed") pendingUniversityFees += 1;
          if (outstanding > 0) receivable += outstanding;
          const student = row["students"] as
            { full_name?: string; case_id?: string } | null | undefined;
          bills.push({
            id: String(row["id"]),
            studentId: String(row["student_id"] ?? ""),
            studentName: student?.full_name || student?.case_id || "Student",
            title: String(row["label"] || row["kind"] || "University fee"),
            amount,
            paid,
            outstanding,
            source: "university",
            status,
          });
        }
      }

      let pendingOpsExpenses = 0;
      let payable = 0;
      const expRes = await client
        .from("ops_expenses")
        .select("amount, status")
        .in("status", ["draft", "submitted"])
        .limit(500);
      if (!expRes.error && expRes.data) {
        for (const row of expRes.data as { amount?: number; status?: string }[]) {
          if (row.status === "submitted") pendingOpsExpenses += 1;
          payable += Number(row.amount ?? 0);
        }
      }

      let entries: FinanceDeskEntry[] = [];
      let audits: FinanceDeskAudit[] = [];
      let schemaReady = true;

      const entriesRes = await client
        .from("finance_desk_entries")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(300);
      if (entriesRes.error) {
        if (isMissingFinanceDeskRelation(entriesRes.error.message)) {
          schemaReady = false;
        } else {
          throw new AuthError(entriesRes.error.message, 500);
        }
      } else {
        entries = ((entriesRes.data ?? []) as Record<string, unknown>[]).map(mapEntry);
      }

      if (schemaReady) {
        const auditsRes = await client
          .from("finance_desk_audits")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);
        if (!auditsRes.error) {
          audits = ((auditsRes.data ?? []) as Record<string, unknown>[]).map(mapAudit);
        }
      }

      const posted = entries.filter((e) => e.status === "posted");
      const sumKind = (kinds: string[]) =>
        posted.filter((e) => kinds.includes(e.kind)).reduce((n, e) => n + e.amount, 0);

      const books = computeBooks(entries);
      return {
        ...base,
        schemaReady,
        note: schemaReady
          ? base.note
          : `${SCHEMA_NOTE} Student fee balances below still load from live fee tables.`,
        books,
        cash: sumKind(["receipt", "loan-draw", "invest-sell", "petty-replenish"]),
        petty: Math.max(0, sumKind(["petty-replenish"]) - sumKind(["petty-spend"])),
        receivable,
        payable,
        salaryPayable: 0,
        loanPayable: Math.max(0, sumKind(["loan-draw"]) - sumKind(["loan-repay"])),
        taxPayable: Math.max(0, sumKind(["tax-challan", "withholding"])),
        clientFunds: sumKind(["receipt"]),
        investments: Math.max(0, sumKind(["invest-buy"]) - sumKind(["invest-sell"])),
        clearing: Math.max(
          0,
          sumKind(["payorder-issue"]) - sumKind(["payorder-clear", "payorder-cancel"]),
        ),
        pendingOpsExpenses,
        pendingUniversityFees,
        pendingSignupFees,
        bills,
        entries,
        audits,
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalSaveFinanceDeskEntry = createServerFn({ method: "POST" })
  .validator(
    (data: {
      kind: string;
      title: string;
      amount?: number;
      entryDate?: string;
      detail?: FinanceDeskEntryDetail;
      studentId?: string | null;
      parentId?: string | null;
      billId?: string;
      principal?: number;
      interest?: number;
      carrying?: number;
      proceeds?: number;
      withheld?: number;
      net?: number;
      count?: number;
      fund?: string;
      number?: string;
      reference?: string;
      department?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const session = await requireFinanceDeskMutate();
      const kind = data.kind.trim();
      let amount = Number(data.amount ?? 0);
      if (kind === "loan-repay") {
        amount = Number(data.principal ?? 0) + Number(data.interest ?? 0);
      }
      if (kind === "invest-sell") {
        amount = Number(data.proceeds ?? 0);
      }
      if (kind === "withholding") {
        amount = Number(data.withheld ?? 0) + Number(data.net ?? 0);
      }
      if (kind === "payorder-clear" || kind === "payorder-cancel") {
        amount = 0;
      }

      const validated = validateFinanceDeskWrite({
        kind,
        title: data.title,
        amount,
        ...(data.entryDate !== undefined ? { entryDate: data.entryDate } : {}),
      });
      if (!validated.ok) throw new AuthError(validated.message, 400);

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Live data plane required.", 400);
      }
      const client = deskDb(requireAoSupabaseClient());

      const detail: FinanceDeskEntryDetail = {
        ...(data.detail ?? {}),
      };
      if (data.billId) detail.billId = data.billId;
      if (data.fund) detail.fund = data.fund;
      if (data.number) detail.number = data.number;
      if (data.reference) detail.reference = data.reference;
      if (data.department) detail.department = data.department;
      if (data.count != null) detail.count = data.count;
      if (data.principal != null) detail.principal = data.principal;
      if (data.interest != null) detail.interest = data.interest;
      if (data.carrying != null) detail.carrying = data.carrying;
      if (data.proceeds != null) detail.proceeds = data.proceeds;
      if (data.withheld != null) detail.withheld = data.withheld;
      if (data.net != null) detail.net = data.net;
      if (kind === "tax-return" || kind === "tax-challan") detail.external = false;
      if (kind === "payorder-issue") detail.state = "issued";

      const parentId = data.parentId ?? null;
      if ((kind === "payorder-clear" || kind === "payorder-cancel") && parentId) {
        const { data: parent, error: parentErr } = await client
          .from("finance_desk_entries")
          .select("id, amount, status, kind, detail, title")
          .eq("id", parentId)
          .maybeSingle();
        if (parentErr) throw new AuthError(parentErr.message, 500);
        if (!parent || parent.kind !== "payorder-issue" || parent.status !== "posted") {
          throw new AuthError("Choose a posted issued pay order.", 400);
        }
        amount = Number(parent.amount ?? 0);
        detail.state = kind === "payorder-clear" ? "cleared" : "cancelled";
        detail.parentTitle = String((parent as { title?: string | null }).title ?? "");
      }

      const { data: row, error } = await client
        .from("finance_desk_entries")
        .insert({
          kind,
          title: data.title.trim(),
          amount,
          currency: "PKR",
          status: "draft",
          entry_date: data.entryDate || new Date().toISOString().slice(0, 10),
          detail,
          student_id: data.studentId || null,
          parent_id: parentId,
          created_by: session.userId ?? null,
        })
        .select("id")
        .single();
      if (error) {
        if (isMissingFinanceDeskRelation(error.message)) throw new AuthError(SCHEMA_NOTE, 503);
        throw new AuthError(error.message, 500);
      }

      await client.from("finance_desk_audits").insert({
        action: "entry.draft",
        target: kind,
        detail: data.title.trim(),
        entry_id: row.id,
        created_by: session.userId ?? null,
      });

      return { ok: true as const, id: row.id as string };
    } catch (error) {
      toError(error);
    }
  });

export const portalPostFinanceDeskEntry = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireFinanceDeskMutate();
      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) throw new AuthError("Live data plane required.", 400);
      const client = deskDb(requireAoSupabaseClient());

      const { data: current, error: curErr } = await client
        .from("finance_desk_entries")
        .select("id, kind, status, title, parent_id, detail")
        .eq("id", data.id)
        .maybeSingle();
      if (curErr) throw new AuthError(curErr.message, 500);
      if (!current) throw new AuthError("Entry not found.", 404);
      if (current.status !== "draft") throw new AuthError("Only drafts can be posted.", 400);
      if (NON_POSTABLE_KINDS.has(String(current.kind))) {
        throw new AuthError("This kind is a plan or working paper and cannot be posted.", 400);
      }

      const { error } = await client
        .from("finance_desk_entries")
        .update({
          status: "posted",
          posted_by: session.userId ?? null,
          posted_at: new Date().toISOString(),
        })
        .eq("id", data.id);
      if (error) throw new AuthError(error.message, 500);

      if (
        (current.kind === "payorder-clear" || current.kind === "payorder-cancel") &&
        current.parent_id
      ) {
        const state = current.kind === "payorder-clear" ? "cleared" : "cancelled";
        const parentDetail = parseFinanceDeskEntryDetail(current.detail);
        await client
          .from("finance_desk_entries")
          .update({
            detail: { ...parentDetail, state },
          })
          .eq("id", current.parent_id);
        // Also update parent detail.state from parent's own detail
        const { data: parent } = await client
          .from("finance_desk_entries")
          .select("detail")
          .eq("id", current.parent_id)
          .maybeSingle();
        if (parent) {
          const prev = parseFinanceDeskEntryDetail(parent.detail);
          await client
            .from("finance_desk_entries")
            .update({ detail: { ...prev, state } })
            .eq("id", current.parent_id);
        }
      }

      await client.from("finance_desk_audits").insert({
        action: "entry.post",
        target: String(current.kind),
        detail: String(current.title),
        entry_id: data.id,
        created_by: session.userId ?? null,
      });

      return { ok: true as const };
    } catch (error) {
      toError(error);
    }
  });

export const portalReverseFinanceDeskEntry = createServerFn({ method: "POST" })
  .validator((data: { id: string; reason: string }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireFinanceDeskMutate();
      const reason = data.reason.trim();
      if (reason.length < 3) throw new AuthError("Enter a reversal reason.", 400);

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) throw new AuthError("Live data plane required.", 400);
      const client = deskDb(requireAoSupabaseClient());

      const { data: current, error: curErr } = await client
        .from("finance_desk_entries")
        .select("*")
        .eq("id", data.id)
        .maybeSingle();
      if (curErr) throw new AuthError(curErr.message, 500);
      if (!current) throw new AuthError("Entry not found.", 404);
      if (current.status !== "posted")
        throw new AuthError("Only posted entries can be reversed.", 400);
      if (current.kind === "reversal") throw new AuthError("Cannot reverse a reversal.", 400);

      const { error: updErr } = await client
        .from("finance_desk_entries")
        .update({
          status: "reversed",
          reversed_by: session.userId ?? null,
          reversed_at: new Date().toISOString(),
          reverse_reason: reason,
        })
        .eq("id", data.id);
      if (updErr) throw new AuthError(updErr.message, 500);

      await client.from("finance_desk_entries").insert({
        kind: "reversal",
        title: `Reversal · ${current.title}`,
        amount: Number(current.amount ?? 0),
        currency: current.currency || "PKR",
        status: "posted",
        entry_date: new Date().toISOString().slice(0, 10),
        detail: { reverses: data.id, reason },
        parent_id: data.id,
        created_by: session.userId ?? null,
        posted_by: session.userId ?? null,
        posted_at: new Date().toISOString(),
      });

      await client.from("finance_desk_audits").insert({
        action: "entry.reverse",
        target: String(current.kind),
        detail: reason,
        entry_id: data.id,
        created_by: session.userId ?? null,
      });

      return { ok: true as const };
    } catch (error) {
      toError(error);
    }
  });
