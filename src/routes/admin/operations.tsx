import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  Panel,
  PermissionDenied,
  StatCard,
  TableWrap,
  fmtDate,
  portalErrorMessage,
} from "@/components/common";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createOpsSalesOrder,
  createPurchaseOrder,
  getOpsDashboard,
  receivePurchaseLine,
  updatePurchaseStatus,
  upsertOpsExpense,
  upsertOpsInventoryItem,
  upsertOpsSupplier,
} from "@/services";
import type { OpsExpenseStatus, OpsPurchaseStatus } from "@/lib/ops-rules";

export const Route = createFileRoute("/admin/operations")({
  component: AdminOperations,
});

function AdminOperations() {
  const queryClient = useQueryClient();
  const dashQ = useQuery({
    queryKey: ["admin", "ops-dashboard"],
    queryFn: getOpsDashboard,
    staleTime: 15_000,
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [supplierForm, setSupplierForm] = useState({
    id: "",
    name: "",
    contactName: "",
    email: "",
    phone: "",
    status: "active" as "active" | "inactive",
  });
  const [invForm, setInvForm] = useState({ id: "", sku: "", name: "", unit: "unit" });
  const [poForm, setPoForm] = useState({
    supplierId: "",
    inventoryItemId: "",
    quantityOrdered: "1",
    unitCost: "0",
    currency: "PKR",
  });
  const [receiveForm, setReceiveForm] = useState({ purchaseLineId: "", quantity: "1" });
  const [saleForm, setSaleForm] = useState({
    customerName: "",
    totalAmount: "0",
    currency: "PKR",
    notes: "",
  });
  const [expForm, setExpForm] = useState({
    id: "",
    category: "office",
    description: "",
    amount: "0",
    status: "draft" as OpsExpenseStatus,
    incurredOn: "",
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "ops-dashboard"] });

  const supplierM = useMutation({
    mutationFn: () => {
      const payload: Parameters<typeof upsertOpsSupplier>[0] = {
        name: supplierForm.name,
        contactName: supplierForm.contactName,
        email: supplierForm.email,
        phone: supplierForm.phone,
        status: supplierForm.status,
      };
      if (supplierForm.id.trim()) payload.id = supplierForm.id.trim();
      return upsertOpsSupplier(payload);
    },
    onSuccess: async () => {
      setMsg("Supplier saved.");
      setSupplierForm({
        id: "",
        name: "",
        contactName: "",
        email: "",
        phone: "",
        status: "active",
      });
      await invalidate();
    },
    onError: (e) => setMsg(portalErrorMessage(e, "Supplier save failed.")),
  });

  const invM = useMutation({
    mutationFn: () => {
      const payload: Parameters<typeof upsertOpsInventoryItem>[0] = {
        sku: invForm.sku,
        name: invForm.name,
        unit: invForm.unit,
      };
      if (invForm.id.trim()) payload.id = invForm.id.trim();
      return upsertOpsInventoryItem(payload);
    },
    onSuccess: async () => {
      setMsg("Inventory item saved (qty changes only via receiving).");
      setInvForm({ id: "", sku: "", name: "", unit: "unit" });
      await invalidate();
    },
    onError: (e) => setMsg(portalErrorMessage(e, "Inventory save failed.")),
  });

  const poM = useMutation({
    mutationFn: () =>
      createPurchaseOrder({
        supplierId: poForm.supplierId,
        currency: poForm.currency,
        lines: [
          {
            inventoryItemId: poForm.inventoryItemId,
            quantityOrdered: Number(poForm.quantityOrdered),
            unitCost: Number(poForm.unitCost),
          },
        ],
      }),
    onSuccess: async () => {
      setMsg("Purchase order created as draft.");
      await invalidate();
    },
    onError: (e) => setMsg(portalErrorMessage(e, "PO create failed.")),
  });

  const statusM = useMutation({
    mutationFn: (input: { purchaseOrderId: string; status: OpsPurchaseStatus }) =>
      updatePurchaseStatus(input),
    onSuccess: async () => {
      setMsg("Purchase status updated.");
      await invalidate();
    },
    onError: (e) => setMsg(portalErrorMessage(e, "Status update failed.")),
  });

  const receiveM = useMutation({
    mutationFn: () =>
      receivePurchaseLine({
        purchaseLineId: receiveForm.purchaseLineId,
        quantity: Number(receiveForm.quantity),
      }),
    onSuccess: async () => {
      setMsg("Stock received via inventory movement.");
      setReceiveForm({ purchaseLineId: "", quantity: "1" });
      await invalidate();
    },
    onError: (e) => setMsg(portalErrorMessage(e, "Receive failed.")),
  });

  const saleM = useMutation({
    mutationFn: () => {
      const payload: Parameters<typeof createOpsSalesOrder>[0] = {
        customerName: saleForm.customerName,
        totalAmount: Number(saleForm.totalAmount),
        currency: saleForm.currency,
      };
      if (saleForm.notes.trim()) payload.notes = saleForm.notes.trim();
      return createOpsSalesOrder(payload);
    },
    onSuccess: async () => {
      setMsg("Operational sale recorded (not student tuition).");
      setSaleForm({ customerName: "", totalAmount: "0", currency: "PKR", notes: "" });
      await invalidate();
    },
    onError: (e) => setMsg(portalErrorMessage(e, "Sale create failed.")),
  });

  const expM = useMutation({
    mutationFn: () => {
      const payload: Parameters<typeof upsertOpsExpense>[0] = {
        category: expForm.category,
        description: expForm.description,
        amount: Number(expForm.amount),
        status: expForm.status,
      };
      if (expForm.id.trim()) payload.id = expForm.id.trim();
      if (expForm.incurredOn.trim()) payload.incurredOn = expForm.incurredOn.trim();
      return upsertOpsExpense(payload);
    },
    onSuccess: async () => {
      setMsg("Expense saved — not a verified payment.");
      setExpForm({
        id: "",
        category: "office",
        description: "",
        amount: "0",
        status: "draft",
        incurredOn: "",
      });
      await invalidate();
    },
    onError: (e) => setMsg(portalErrorMessage(e, "Expense save failed.")),
  });

  if (dashQ.isLoading) return <LoadingRows rows={6} />;
  if (dashQ.isError) {
    const text = portalErrorMessage(dashQ.error);
    if (text.includes("403") || text.toLowerCase().includes("permission")) {
      return <PermissionDenied body={text} />;
    }
    return <ErrorState body={text} />;
  }

  const data = dashQ.data;
  if (!data) return <ErrorState body="Operations dashboard unavailable." />;

  const receivableLines = data.purchaseLines.filter((l) => {
    const po = data.purchases.find((p) => p.id === l.purchaseOrderId);
    return (
      po &&
      ["approved", "partially_received"].includes(po.status) &&
      l.quantityReceived < l.quantityOrdered
    );
  });

  return (
    <div>
      <PageHeader
        title="Orders / Sales / Purchase"
        subtitle="Suppliers, purchases, stock, operational sales and expenses — separate from student fees."
      />
      {msg ? <p className="mb-3 text-sm text-navy">{msg}</p> : null}
      <p className="mb-4 text-xs text-muted-foreground">{data.note}</p>
      <p className="mb-6 text-xs text-muted-foreground">
        Student tuition / university fees live under{" "}
        <Link to="/admin/finance" className="font-semibold text-royal hover:underline">
          Finance
        </Link>
        . Do not treat ops expenses as verified payments.
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatCard label="Suppliers" value={data.suppliers.length} />
        <StatCard label="Pending purchases" value={data.pendingPurchases} />
        <StatCard label="Inventory SKUs" value={data.inventory.length} />
        <StatCard
          label="Pending expenses"
          value={data.canSeeExpenses ? data.pendingExpenses : "n/a"}
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Panel title={data.canMutate ? "Supplier" : "Suppliers (view only)"}>
          {data.canMutate ? (
            <div className="mb-4 grid gap-2 text-sm">
              <Input
                placeholder="Name *"
                value={supplierForm.name}
                onChange={(e) => setSupplierForm((f) => ({ ...f, name: e.target.value }))}
              />
              <Input
                placeholder="Contact"
                value={supplierForm.contactName}
                onChange={(e) => setSupplierForm((f) => ({ ...f, contactName: e.target.value }))}
              />
              <Input
                placeholder="Email"
                value={supplierForm.email}
                onChange={(e) => setSupplierForm((f) => ({ ...f, email: e.target.value }))}
              />
              <Input
                placeholder="Phone"
                value={supplierForm.phone}
                onChange={(e) => setSupplierForm((f) => ({ ...f, phone: e.target.value }))}
              />
              <select
                className="h-9 rounded-md border border-border bg-background px-2"
                value={supplierForm.status}
                onChange={(e) =>
                  setSupplierForm((f) => ({
                    ...f,
                    status: e.target.value as "active" | "inactive",
                  }))
                }
              >
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
              <Input
                placeholder="Existing ID to update (optional)"
                value={supplierForm.id}
                onChange={(e) => setSupplierForm((f) => ({ ...f, id: e.target.value }))}
              />
              <Button
                size="sm"
                variant="navy"
                disabled={!supplierForm.name.trim() || supplierM.isPending}
                onClick={() => {
                  setMsg(null);
                  supplierM.mutate();
                }}
              >
                Save supplier
              </Button>
            </div>
          ) : null}
          {!data.suppliers.length ? (
            <EmptyState title="No suppliers" body="Apply M4 ops migration, then add a supplier." />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Contact</th>
                </tr>
              </thead>
              <tbody>
                {data.suppliers.map((s) => (
                  <tr key={s.id}>
                    <td className="font-medium text-navy">{s.name}</td>
                    <td>
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="text-xs">
                      {s.email || "—"} / {s.phone || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Panel>

        <Panel title="Inventory catalog">
          {data.canMutate ? (
            <div className="mb-4 grid gap-2 text-sm">
              <Input
                placeholder="SKU *"
                value={invForm.sku}
                onChange={(e) => setInvForm((f) => ({ ...f, sku: e.target.value }))}
              />
              <Input
                placeholder="Name *"
                value={invForm.name}
                onChange={(e) => setInvForm((f) => ({ ...f, name: e.target.value }))}
              />
              <Input
                placeholder="Unit"
                value={invForm.unit}
                onChange={(e) => setInvForm((f) => ({ ...f, unit: e.target.value }))}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!invForm.sku.trim() || !invForm.name.trim() || invM.isPending}
                onClick={() => {
                  setMsg(null);
                  invM.mutate();
                }}
              >
                Save item
              </Button>
            </div>
          ) : null}
          {!data.inventory.length ? (
            <EmptyState title="No SKUs" body="Create catalog items before purchase orders." />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Name</th>
                  <th>On hand</th>
                </tr>
              </thead>
              <tbody>
                {data.inventory.map((i) => (
                  <tr key={i.id}>
                    <td className="font-mono text-xs">{i.sku}</td>
                    <td>{i.name}</td>
                    <td>
                      {i.quantityOnHand} {i.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Panel>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Purchases">
          {data.canMutate ? (
            <div className="mb-4 grid gap-2 text-sm">
              <select
                className="h-9 rounded-md border border-border bg-background px-2"
                value={poForm.supplierId}
                onChange={(e) => setPoForm((f) => ({ ...f, supplierId: e.target.value }))}
              >
                <option value="">Supplier *</option>
                {data.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                className="h-9 rounded-md border border-border bg-background px-2"
                value={poForm.inventoryItemId}
                onChange={(e) => setPoForm((f) => ({ ...f, inventoryItemId: e.target.value }))}
              >
                <option value="">Inventory item *</option>
                {data.inventory.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.sku} — {i.name}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                min={0}
                step="any"
                placeholder="Qty ordered"
                value={poForm.quantityOrdered}
                onChange={(e) => setPoForm((f) => ({ ...f, quantityOrdered: e.target.value }))}
              />
              <Input
                type="number"
                min={0}
                step="any"
                placeholder="Unit cost"
                value={poForm.unitCost}
                onChange={(e) => setPoForm((f) => ({ ...f, unitCost: e.target.value }))}
              />
              <Button
                size="sm"
                variant="navy"
                disabled={!poForm.supplierId || !poForm.inventoryItemId || poM.isPending}
                onClick={() => {
                  setMsg(null);
                  poM.mutate();
                }}
              >
                Create draft PO
              </Button>
            </div>
          ) : null}
          {!data.purchases.length ? (
            <EmptyState
              title="No purchase orders"
              body="Create a draft PO after suppliers + SKUs."
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.purchases.map((p) => (
                  <tr key={p.id}>
                    <td className="font-mono text-xs">{p.id.slice(0, 8)}…</td>
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="space-x-1">
                      {data.canMutate && p.status === "draft" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            statusM.mutate({ purchaseOrderId: p.id, status: "submitted" })
                          }
                        >
                          Submit
                        </Button>
                      ) : null}
                      {data.canMutate && p.status === "submitted" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            statusM.mutate({ purchaseOrderId: p.id, status: "approved" })
                          }
                        >
                          Approve
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Panel>

        <Panel title="Receive stock">
          {data.canMutate ? (
            <div className="mb-4 grid gap-2 text-sm">
              <select
                className="h-9 rounded-md border border-border bg-background px-2"
                value={receiveForm.purchaseLineId}
                onChange={(e) => setReceiveForm((f) => ({ ...f, purchaseLineId: e.target.value }))}
              >
                <option value="">Receivable line</option>
                {receivableLines.map((l) => {
                  const item = data.inventory.find((i) => i.id === l.inventoryItemId);
                  return (
                    <option key={l.id} value={l.id}>
                      {item?.sku ?? "item"} — {l.quantityReceived}/{l.quantityOrdered}
                    </option>
                  );
                })}
              </select>
              <Input
                type="number"
                min={0}
                step="any"
                value={receiveForm.quantity}
                onChange={(e) => setReceiveForm((f) => ({ ...f, quantity: e.target.value }))}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!receiveForm.purchaseLineId || receiveM.isPending}
                onClick={() => {
                  setMsg(null);
                  receiveM.mutate();
                }}
              >
                Receive quantity
              </Button>
              <p className="text-xs text-muted-foreground">
                On-hand quantity updates only through stock movements on receive.
              </p>
            </div>
          ) : (
            <EmptyState title="View only" body="Receiving requires Office Ops mutate permission." />
          )}
          {!receivableLines.length && data.canMutate ? (
            <EmptyState
              title="Nothing to receive"
              body="Approve a PO first, then receive up to ordered qty."
            />
          ) : null}
        </Panel>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Operational sales">
          {data.canMutate ? (
            <div className="mb-4 grid gap-2 text-sm">
              <Input
                placeholder="Customer name *"
                value={saleForm.customerName}
                onChange={(e) => setSaleForm((f) => ({ ...f, customerName: e.target.value }))}
              />
              <Input
                type="number"
                min={0}
                step="any"
                placeholder="Total amount"
                value={saleForm.totalAmount}
                onChange={(e) => setSaleForm((f) => ({ ...f, totalAmount: e.target.value }))}
              />
              <Input
                placeholder="Notes"
                value={saleForm.notes}
                onChange={(e) => setSaleForm((f) => ({ ...f, notes: e.target.value }))}
              />
              <Button
                size="sm"
                variant="navy"
                disabled={!saleForm.customerName.trim() || saleM.isPending}
                onClick={() => {
                  setMsg(null);
                  saleM.mutate();
                }}
              >
                Record ops sale
              </Button>
            </div>
          ) : null}
          {!data.salesOrders.length ? (
            <EmptyState
              title="No ops sales"
              body="Operational sales only — not tuition invoices."
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {data.salesOrders.map((o) => (
                  <tr key={o.id}>
                    <td className="font-medium text-navy">{o.customerName}</td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                    <td>{o.totalAmount}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Panel>

        <Panel title="Expenses">
          {!data.canSeeExpenses ? (
            <PermissionDenied body="Expense list not available for this role." />
          ) : (
            <>
              {data.canMutate ? (
                <div className="mb-4 grid gap-2 text-sm">
                  <Input
                    placeholder="Category"
                    value={expForm.category}
                    onChange={(e) => setExpForm((f) => ({ ...f, category: e.target.value }))}
                  />
                  <Input
                    placeholder="Description *"
                    value={expForm.description}
                    onChange={(e) => setExpForm((f) => ({ ...f, description: e.target.value }))}
                  />
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={expForm.amount}
                    onChange={(e) => setExpForm((f) => ({ ...f, amount: e.target.value }))}
                  />
                  <select
                    className="h-9 rounded-md border border-border bg-background px-2"
                    value={expForm.status}
                    onChange={(e) =>
                      setExpForm((f) => ({
                        ...f,
                        status: e.target.value as OpsExpenseStatus,
                      }))
                    }
                  >
                    <option value="draft">draft</option>
                    <option value="submitted">submitted</option>
                    <option value="reviewed">reviewed</option>
                    <option value="rejected">rejected</option>
                  </select>
                  <Input
                    type="date"
                    value={expForm.incurredOn}
                    onChange={(e) => setExpForm((f) => ({ ...f, incurredOn: e.target.value }))}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!expForm.description.trim() || expM.isPending}
                    onClick={() => {
                      setMsg(null);
                      expM.mutate();
                    }}
                  >
                    Save expense
                  </Button>
                </div>
              ) : null}
              {!data.expenses.length ? (
                <EmptyState
                  title="No expenses"
                  body="Claimed expenses are not verified payments."
                />
              ) : (
                <TableWrap>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Description</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.expenses.map((e) => (
                      <tr key={e.id}>
                        <td>{e.category}</td>
                        <td>{e.description}</td>
                        <td>{e.amount}</td>
                        <td>
                          <StatusBadge status={e.status} />
                        </td>
                        <td>{fmtDate(e.incurredOn)}</td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              )}
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
