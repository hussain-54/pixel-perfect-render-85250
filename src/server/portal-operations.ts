/**
 * Office Operations — suppliers, purchases, stock, ops sales, expenses.
 * Distinct from student tuition / university fee obligations.
 */
import { createServerFn } from "@tanstack/react-start";
import {
  AuthError,
  requireRoles,
  requireTrustedSession,
  type TrustedSession,
} from "@/server/portal-auth";
import {
  canMutateOfficeOps,
  canViewOfficeOps,
  canViewOpsExpenses,
  expenseImpliesVerifiedPayment,
  isValidPurchaseTransition,
  validateMoneyAmount,
  validateReceiveQuantity,
  type OpsExpenseStatus,
  type OpsPurchaseStatus,
} from "@/lib/ops-rules";
import {
  resolveBusinessRoleFromTrustedAppRole,
  type BusinessRole,
} from "@/lib/business-permissions";

function toError(error: unknown): never {
  if (error instanceof AuthError) {
    throw new Error(`${error.status}:${error.message}`);
  }
  throw error instanceof Error ? error : new Error("Authorization failed.");
}

async function resolveSessionBusinessRole(session: TrustedSession): Promise<BusinessRole | null> {
  const mapped = resolveBusinessRoleFromTrustedAppRole(session.role);
  if (!session.userId || session.source !== "supabase") return mapped;
  try {
    const { requireAoSupabaseClient } = await import("@/server/ao-data");
    const client = requireAoSupabaseClient();
    const { data } = await client
      .from("profiles")
      .select("business_role")
      .eq("id", session.userId)
      .maybeSingle();
    if (data?.business_role) return data.business_role as BusinessRole;
  } catch {
    /* fall through */
  }
  return mapped;
}

function requireOpsView(session: TrustedSession, businessRole: BusinessRole | null) {
  if (!canViewOfficeOps({ appRole: session.role, businessRole })) {
    throw new AuthError("You do not have access to Office Operations.", 403);
  }
}

function requireOpsMutate(session: TrustedSession, businessRole: BusinessRole | null) {
  if (!canMutateOfficeOps({ appRole: session.role, businessRole })) {
    throw new AuthError("You do not have permission to change Office Operations records.", 403);
  }
}

export const portalGetOpsDashboard = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const session = await requireTrustedSession();
    requireRoles(session, ["consultant", "admin", "super_admin"]);
    const businessRole = await resolveSessionBusinessRole(session);
    requireOpsView(session, businessRole);

    const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
    const canMutate = canMutateOfficeOps({ appRole: session.role, businessRole });
    const canSeeExpenses = canViewOpsExpenses({ appRole: session.role, businessRole });

    if (!usesSupabaseDataPlane(session)) {
      return {
        ok: true as const,
        suppliers: [] as Array<{
          id: string;
          name: string;
          status: string;
          email: string;
          phone: string;
        }>,
        purchases: [] as Array<{
          id: string;
          supplierId: string;
          status: string;
          currency: string;
        }>,
        purchaseLines: [] as Array<{
          id: string;
          purchaseOrderId: string;
          inventoryItemId: string;
          quantityOrdered: number;
          quantityReceived: number;
        }>,
        inventory: [] as Array<{
          id: string;
          sku: string;
          name: string;
          quantityOnHand: number;
          unit: string;
        }>,
        salesOrders: [] as Array<{
          id: string;
          customerName: string;
          status: string;
          totalAmount: number;
        }>,
        expenses: [] as Array<{
          id: string;
          category: string;
          description: string;
          amount: number;
          status: string;
          incurredOn: string;
        }>,
        pendingPurchases: 0,
        pendingExpenses: 0,
        canMutate,
        canSeeExpenses,
        note: "Operational sales are not student tuition or university fee obligations.",
      };
    }

    const client = requireAoSupabaseClient();
    const [sup, po, lines, inv, sales, exp] = await Promise.all([
      client
        .from("ops_suppliers")
        .select("id, name, status, email, phone")
        .order("name")
        .limit(100),
      client
        .from("ops_purchase_orders")
        .select("id, supplier_id, status, currency")
        .order("created_at", { ascending: false })
        .limit(100),
      client
        .from("ops_purchase_lines")
        .select("id, purchase_order_id, inventory_item_id, quantity_ordered, quantity_received")
        .limit(500),
      client
        .from("ops_inventory_items")
        .select("id, sku, name, quantity_on_hand, unit")
        .order("name")
        .limit(200),
      client
        .from("ops_sales_orders")
        .select("id, customer_name, status, total_amount")
        .order("created_at", { ascending: false })
        .limit(100),
      canSeeExpenses
        ? client
            .from("ops_expenses")
            .select("id, category, description, amount, status, incurred_on")
            .order("created_at", { ascending: false })
            .limit(100)
        : Promise.resolve({ data: [], error: null }),
    ]);
    for (const r of [sup, po, lines, inv, sales, exp]) {
      if (r.error) throw new Error(r.error.message);
    }

    const purchases = po.data ?? [];
    const expenses = exp.data ?? [];

    return {
      ok: true as const,
      suppliers: (sup.data ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        email: s.email,
        phone: s.phone,
      })),
      purchases: purchases.map((p) => ({
        id: p.id,
        supplierId: p.supplier_id,
        status: p.status,
        currency: p.currency,
      })),
      purchaseLines: (lines.data ?? []).map((l) => ({
        id: l.id,
        purchaseOrderId: l.purchase_order_id,
        inventoryItemId: l.inventory_item_id,
        quantityOrdered: Number(l.quantity_ordered),
        quantityReceived: Number(l.quantity_received),
      })),
      inventory: (inv.data ?? []).map((i) => ({
        id: i.id,
        sku: i.sku,
        name: i.name,
        quantityOnHand: Number(i.quantity_on_hand),
        unit: i.unit,
      })),
      salesOrders: (sales.data ?? []).map((o) => ({
        id: o.id,
        customerName: o.customer_name,
        status: o.status,
        totalAmount: Number(o.total_amount),
      })),
      expenses: expenses.map((e) => ({
        id: e.id,
        category: e.category,
        description: e.description,
        amount: Number(e.amount),
        status: e.status,
        incurredOn: e.incurred_on,
      })),
      pendingPurchases: purchases.filter((p) =>
        ["submitted", "approved", "partially_received"].includes(p.status),
      ).length,
      pendingExpenses: expenses.filter((e) => e.status === "submitted").length,
      canMutate,
      canSeeExpenses,
      note: "Operational sales are not student tuition or university fee obligations.",
    };
  } catch (error) {
    toError(error);
  }
});

export const portalUpsertOpsSupplier = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id?: string;
      name: string;
      contactName?: string;
      email?: string;
      phone?: string;
      status?: "active" | "inactive";
      notes?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      const businessRole = await resolveSessionBusinessRole(session);
      requireOpsMutate(session, businessRole);
      if (!data.name.trim()) throw new AuthError("Supplier name is required.", 400);

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Office Operations require the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();

      if (data.id?.trim()) {
        const { data: row, error } = await client
          .from("ops_suppliers")
          .update({
            name: data.name.trim(),
            contact_name: data.contactName?.trim() ?? "",
            email: data.email?.trim() ?? "",
            phone: data.phone?.trim() ?? "",
            status: data.status ?? "active",
            notes: data.notes?.trim() || null,
          })
          .eq("id", data.id.trim())
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        const { writeAudit } = await import("@/services/db");
        await writeAudit(client, {
          action: "ops.supplier.update",
          entity_type: "ops_suppliers",
          entity_id: row.id,
          metadata: { name: data.name.trim() },
        });
        return { ok: true as const, supplierId: row.id };
      }

      const { data: row, error } = await client
        .from("ops_suppliers")
        .insert({
          name: data.name.trim(),
          contact_name: data.contactName?.trim() || "",
          email: data.email?.trim() || "",
          phone: data.phone?.trim() || "",
          status: data.status ?? "active",
          notes: data.notes?.trim() || null,
          created_by: session.userId ?? null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      const { writeAudit } = await import("@/services/db");
      await writeAudit(client, {
        action: "ops.supplier.create",
        entity_type: "ops_suppliers",
        entity_id: row.id,
        metadata: { name: data.name.trim() },
      });
      return { ok: true as const, supplierId: row.id };
    } catch (error) {
      toError(error);
    }
  });

export const portalUpsertOpsInventoryItem = createServerFn({ method: "POST" })
  .validator((data: { id?: string; sku: string; name: string; unit?: string }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      const businessRole = await resolveSessionBusinessRole(session);
      requireOpsMutate(session, businessRole);
      if (!data.sku.trim() || !data.name.trim()) {
        throw new AuthError("SKU and name are required.", 400);
      }

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Office Operations require the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();

      if (data.id?.trim()) {
        const { data: row, error } = await client
          .from("ops_inventory_items")
          .update({
            sku: data.sku.trim(),
            name: data.name.trim(),
            unit: data.unit?.trim() || "unit",
          })
          .eq("id", data.id.trim())
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        return { ok: true as const, itemId: row.id };
      }

      const { data: row, error } = await client
        .from("ops_inventory_items")
        .insert({
          sku: data.sku.trim(),
          name: data.name.trim(),
          unit: data.unit?.trim() || "unit",
          quantity_on_hand: 0,
        })
        .select("id")
        .single();
      if (error) {
        if (/unique|duplicate/i.test(error.message)) {
          throw new AuthError("SKU already exists.", 409);
        }
        throw new Error(error.message);
      }
      return { ok: true as const, itemId: row.id };
    } catch (error) {
      toError(error);
    }
  });

export const portalCreatePurchaseOrder = createServerFn({ method: "POST" })
  .validator(
    (data: {
      supplierId: string;
      currency?: string;
      notes?: string;
      lines: Array<{ inventoryItemId: string; quantityOrdered: number; unitCost: number }>;
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      const businessRole = await resolveSessionBusinessRole(session);
      requireOpsMutate(session, businessRole);
      if (!data.lines.length) throw new AuthError("At least one purchase line is required.", 400);
      for (const line of data.lines) {
        if (line.quantityOrdered <= 0) throw new AuthError("Ordered quantity must be > 0.", 400);
        const money = validateMoneyAmount(line.unitCost);
        if (!money.ok) throw new AuthError(money.error, 400);
      }

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Office Operations require the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();

      const { data: po, error } = await client
        .from("ops_purchase_orders")
        .insert({
          supplier_id: data.supplierId,
          status: "draft",
          currency: data.currency?.trim() || "PKR",
          notes: data.notes?.trim() || null,
          created_by: session.userId ?? null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      const { error: lineErr } = await client.from("ops_purchase_lines").insert(
        data.lines.map((l) => ({
          purchase_order_id: po.id,
          inventory_item_id: l.inventoryItemId,
          quantity_ordered: l.quantityOrdered,
          quantity_received: 0,
          unit_cost: l.unitCost,
        })),
      );
      if (lineErr) throw new Error(lineErr.message);

      const { writeAudit } = await import("@/services/db");
      await writeAudit(client, {
        action: "ops.purchase.create",
        entity_type: "ops_purchase_orders",
        entity_id: po.id,
        metadata: { supplier_id: data.supplierId, lines: data.lines.length },
      });

      return { ok: true as const, purchaseOrderId: po.id };
    } catch (error) {
      toError(error);
    }
  });

export const portalUpdatePurchaseStatus = createServerFn({ method: "POST" })
  .validator((data: { purchaseOrderId: string; status: OpsPurchaseStatus }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      const businessRole = await resolveSessionBusinessRole(session);
      requireOpsMutate(session, businessRole);

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Office Operations require the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();
      const { data: existing, error: loadErr } = await client
        .from("ops_purchase_orders")
        .select("id, status")
        .eq("id", data.purchaseOrderId)
        .maybeSingle();
      if (loadErr) throw new Error(loadErr.message);
      if (!existing) throw new AuthError("Purchase order not found.", 404);
      if (!isValidPurchaseTransition(existing.status as OpsPurchaseStatus, data.status)) {
        throw new AuthError("Invalid purchase status transition.", 400);
      }

      const patch =
        data.status === "approved"
          ? {
              status: data.status,
              approved_by: session.userId ?? null,
              approved_at: new Date().toISOString(),
            }
          : { status: data.status };

      const { error } = await client
        .from("ops_purchase_orders")
        .update(patch)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);

      const { writeAudit } = await import("@/services/db");
      await writeAudit(client, {
        action: "ops.purchase.status",
        entity_type: "ops_purchase_orders",
        entity_id: existing.id,
        metadata: { from: existing.status, to: data.status },
      });

      return { ok: true as const, purchaseOrderId: existing.id, status: data.status };
    } catch (error) {
      toError(error);
    }
  });

export const portalReceivePurchaseLine = createServerFn({ method: "POST" })
  .validator((data: { purchaseLineId: string; quantity: number; notes?: string }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      const businessRole = await resolveSessionBusinessRole(session);
      requireOpsMutate(session, businessRole);

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Office Operations require the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();

      const { data: line, error: loadErr } = await client
        .from("ops_purchase_lines")
        .select("*")
        .eq("id", data.purchaseLineId)
        .maybeSingle();
      if (loadErr) throw new Error(loadErr.message);
      if (!line) throw new AuthError("Purchase line not found.", 404);

      const { data: po } = await client
        .from("ops_purchase_orders")
        .select("id, status")
        .eq("id", line.purchase_order_id)
        .maybeSingle();
      if (!po) throw new AuthError("Purchase order not found.", 404);
      if (!["approved", "partially_received"].includes(po.status)) {
        throw new AuthError("Purchase must be approved before receiving stock.", 400);
      }

      const recv = validateReceiveQuantity({
        ordered: Number(line.quantity_ordered),
        alreadyReceived: Number(line.quantity_received),
        receiving: data.quantity,
      });
      if (!recv.ok) throw new AuthError(recv.error, 400);

      const { error: lineUpdErr } = await client
        .from("ops_purchase_lines")
        .update({ quantity_received: recv.nextReceived })
        .eq("id", line.id);
      if (lineUpdErr) throw new Error(lineUpdErr.message);

      const { data: item, error: itemErr } = await client
        .from("ops_inventory_items")
        .select("id, quantity_on_hand")
        .eq("id", line.inventory_item_id)
        .maybeSingle();
      if (itemErr) throw new Error(itemErr.message);
      if (!item) throw new AuthError("Inventory item not found.", 404);

      const newQty = Number(item.quantity_on_hand) + data.quantity;
      const { error: stockErr } = await client
        .from("ops_inventory_items")
        .update({ quantity_on_hand: newQty })
        .eq("id", item.id);
      if (stockErr) throw new Error(stockErr.message);

      const { error: movErr } = await client.from("ops_stock_movements").insert({
        inventory_item_id: item.id,
        kind: "receive",
        quantity: data.quantity,
        purchase_order_id: po.id,
        notes: data.notes?.trim() || null,
        recorded_by: session.userId ?? null,
      });
      if (movErr) throw new Error(movErr.message);

      const { data: allLines } = await client
        .from("ops_purchase_lines")
        .select("quantity_ordered, quantity_received")
        .eq("purchase_order_id", po.id);
      const fully =
        (allLines ?? []).length > 0 &&
        (allLines ?? []).every(
          (l) => Number(l.quantity_received) >= Number(l.quantity_ordered) - 1e-9,
        );
      const nextPoStatus: OpsPurchaseStatus = fully ? "received" : "partially_received";
      await client.from("ops_purchase_orders").update({ status: nextPoStatus }).eq("id", po.id);

      const { writeAudit } = await import("@/services/db");
      await writeAudit(client, {
        action: "ops.purchase.receive",
        entity_type: "ops_purchase_orders",
        entity_id: po.id,
        metadata: {
          line_id: line.id,
          quantity: data.quantity,
          status: nextPoStatus,
        },
      });

      return { ok: true as const, purchaseOrderId: po.id, status: nextPoStatus };
    } catch (error) {
      toError(error);
    }
  });

export const portalCreateOpsSalesOrder = createServerFn({ method: "POST" })
  .validator(
    (data: { customerName: string; totalAmount: number; currency?: string; notes?: string }) =>
      data,
  )
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      const businessRole = await resolveSessionBusinessRole(session);
      requireOpsMutate(session, businessRole);
      if (!data.customerName.trim()) throw new AuthError("Customer name is required.", 400);
      const money = validateMoneyAmount(data.totalAmount);
      if (!money.ok) throw new AuthError(money.error, 400);

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Office Operations require the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();
      const { data: row, error } = await client
        .from("ops_sales_orders")
        .insert({
          customer_name: data.customerName.trim(),
          status: "draft",
          currency: data.currency?.trim() || "PKR",
          total_amount: data.totalAmount,
          notes: data.notes?.trim() || null,
          created_by: session.userId ?? null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      const { writeAudit } = await import("@/services/db");
      await writeAudit(client, {
        action: "ops.sales.create",
        entity_type: "ops_sales_orders",
        entity_id: row.id,
        metadata: {
          total_amount: data.totalAmount,
          not_student_fee: true,
        },
      });

      return { ok: true as const, salesOrderId: row.id };
    } catch (error) {
      toError(error);
    }
  });

export const portalUpsertOpsExpense = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id?: string;
      category: string;
      description: string;
      amount: number;
      currency?: string;
      status?: OpsExpenseStatus;
      incurredOn?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      const businessRole = await resolveSessionBusinessRole(session);
      requireOpsMutate(session, businessRole);
      if (!data.description.trim()) throw new AuthError("Expense description is required.", 400);
      const money = validateMoneyAmount(data.amount);
      if (!money.ok) throw new AuthError(money.error, 400);
      // Documented invariant — expenses are never verified student/university payments.
      void expenseImpliesVerifiedPayment(data.status ?? "draft");

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        throw new AuthError("Office Operations require the live data plane.", 400);
      }
      const client = requireAoSupabaseClient();

      if (data.id?.trim()) {
        const expenseUpdate: {
          category: string;
          description: string;
          amount: number;
          currency: string;
          status: OpsExpenseStatus;
          incurred_on?: string;
        } = {
          category: data.category.trim() || "general",
          description: data.description.trim(),
          amount: data.amount,
          currency: data.currency?.trim() || "PKR",
          status: data.status ?? "draft",
        };
        const incurred = data.incurredOn?.trim();
        if (incurred) expenseUpdate.incurred_on = incurred;

        const { data: row, error } = await client
          .from("ops_expenses")
          .update(expenseUpdate)
          .eq("id", data.id.trim())
          .select("id, status")
          .single();
        if (error) throw new Error(error.message);
        return { ok: true as const, expenseId: row.id, verifiedPayment: false as const };
      }

      const { data: row, error } = await client
        .from("ops_expenses")
        .insert({
          category: data.category.trim() || "general",
          description: data.description.trim(),
          amount: data.amount,
          currency: data.currency?.trim() || "PKR",
          status: data.status ?? "draft",
          incurred_on: data.incurredOn?.trim() || new Date().toISOString().slice(0, 10),
          created_by: session.userId ?? null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      const { writeAudit } = await import("@/services/db");
      await writeAudit(client, {
        action: "ops.expense.create",
        entity_type: "ops_expenses",
        entity_id: row.id,
        metadata: { amount: data.amount, verified_payment: false },
      });

      return { ok: true as const, expenseId: row.id, verifiedPayment: false as const };
    } catch (error) {
      toError(error);
    }
  });
