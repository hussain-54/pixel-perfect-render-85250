export const FINANCE_DESK_TABS = [
  { id: "statements", label: "Statements" },
  { id: "clients", label: "Student balances" },
  { id: "receipts", label: "Receipts" },
  { id: "installments", label: "Installments" },
  { id: "petty-cash", label: "Petty cash" },
  { id: "pay-orders", label: "Pay orders" },
  { id: "loans", label: "Loans" },
  { id: "investments", label: "Investments" },
  { id: "assets", label: "Fixed assets" },
  { id: "budgets", label: "Budgets" },
  { id: "tax", label: "Tax payments" },
  { id: "tax-returns", label: "Tax papers" },
  { id: "fbr-integration", label: "FBR / provincial" },
  { id: "approvals", label: "Drafts to post" },
  { id: "audit", label: "Finance audit" },
] as const;

export type FinanceDeskTabId = (typeof FINANCE_DESK_TABS)[number]["id"];

export const FINANCE_DESK_TITLES: Record<FinanceDeskTabId, string> = {
  statements: "Financial statements",
  clients: "Student balances",
  receipts: "Receipts and advances",
  installments: "Installments",
  "petty-cash": "Petty cash",
  "pay-orders": "Pay orders",
  loans: "Loans",
  investments: "Investments",
  assets: "Fixed assets",
  budgets: "Budgets",
  tax: "Tax payments",
  "tax-returns": "Tax working papers",
  "fbr-integration": "FBR and provincial filing",
  approvals: "Drafts to post",
  audit: "Finance audit",
};

export type FinanceDeskEntryKind =
  | "invoice"
  | "receipt"
  | "installment"
  | "petty-spend"
  | "petty-replenish"
  | "payorder-issue"
  | "payorder-clear"
  | "payorder-cancel"
  | "loan-draw"
  | "loan-repay"
  | "invest-buy"
  | "invest-sell"
  | "asset-buy"
  | "depreciation"
  | "budget"
  | "tax-challan"
  | "withholding"
  | "tax-return"
  | "capital"
  | "reversal";

export type FinanceDeskEntryStatus = "draft" | "posted" | "reversed";

export type FinanceDeskBill = {
  id: string;
  studentId: string;
  studentName: string;
  title: string;
  amount: number;
  paid: number;
  outstanding: number;
  source: "signup" | "university";
  status: string;
};

/** JSON `detail` on finance_desk_entries — known keys only (no index signature). */
export type FinanceDeskEntryDetail = {
  billId?: string;
  fund?: string;
  number?: string;
  reference?: string;
  department?: string;
  count?: number;
  principal?: number;
  interest?: number;
  carrying?: number;
  proceeds?: number;
  withheld?: number;
  net?: number;
  external?: boolean;
  state?: string;
  parentTitle?: string;
  reverses?: string;
  reason?: string;
};

export function parseFinanceDeskEntryDetail(raw: unknown): FinanceDeskEntryDetail {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const src = raw as Record<string, unknown>;
  const detail: FinanceDeskEntryDetail = {};
  if (typeof src["billId"] === "string") detail.billId = src["billId"];
  if (typeof src["fund"] === "string") detail.fund = src["fund"];
  if (typeof src["number"] === "string") detail.number = src["number"];
  if (typeof src["reference"] === "string") detail.reference = src["reference"];
  if (typeof src["department"] === "string") detail.department = src["department"];
  if (typeof src["count"] === "number") detail.count = src["count"];
  if (typeof src["principal"] === "number") detail.principal = src["principal"];
  if (typeof src["interest"] === "number") detail.interest = src["interest"];
  if (typeof src["carrying"] === "number") detail.carrying = src["carrying"];
  if (typeof src["proceeds"] === "number") detail.proceeds = src["proceeds"];
  if (typeof src["withheld"] === "number") detail.withheld = src["withheld"];
  if (typeof src["net"] === "number") detail.net = src["net"];
  if (typeof src["external"] === "boolean") detail.external = src["external"];
  if (typeof src["state"] === "string") detail.state = src["state"];
  if (typeof src["parentTitle"] === "string") detail.parentTitle = src["parentTitle"];
  if (typeof src["reverses"] === "string") detail.reverses = src["reverses"];
  if (typeof src["reason"] === "string") detail.reason = src["reason"];
  return detail;
}

export type FinanceDeskEntry = {
  id: string;
  kind: string;
  title: string;
  amount: number;
  currency: string;
  status: FinanceDeskEntryStatus;
  entryDate: string;
  detail: FinanceDeskEntryDetail;
  studentId: string | null;
  parentId: string | null;
  createdAt: string;
};

export type FinanceDeskAudit = {
  id: string;
  action: string;
  target: string;
  detail: string;
  createdAt: string;
};

export type FinanceDeskBooks = {
  assets: number;
  liabilities: number;
  equity: number;
  income: number;
  expenses: number;
  profit: number;
  equation: boolean;
  debit: number;
  credit: number;
};

export type FinanceDeskSnapshot = {
  schemaReady: boolean;
  note: string;
  lock: string;
  connections: Record<string, boolean>;
  books: FinanceDeskBooks;
  cash: number;
  petty: number;
  receivable: number;
  payable: number;
  salaryPayable: number;
  loanPayable: number;
  taxPayable: number;
  clientFunds: number;
  investments: number;
  clearing: number;
  pendingOpsExpenses: number;
  pendingUniversityFees: number;
  pendingSignupFees: number;
  bills: FinanceDeskBill[];
  entries: FinanceDeskEntry[];
  audits: FinanceDeskAudit[];
  feesHref: string;
  operationsHref: string;
};

export const FINANCE_DESK_KIND_OPTIONS: Record<string, FinanceDeskEntryKind[]> = {
  receipts: ["invoice", "receipt"],
  installments: ["installment"],
  "petty-cash": ["petty-spend", "petty-replenish"],
  "pay-orders": ["payorder-issue", "payorder-clear", "payorder-cancel"],
  loans: ["loan-draw", "loan-repay"],
  investments: ["invest-buy", "invest-sell"],
  assets: ["asset-buy", "depreciation"],
  budgets: ["budget"],
  tax: ["tax-challan", "withholding"],
  "tax-returns": ["tax-return"],
};

export const NON_POSTABLE_KINDS = new Set(["budget", "installment", "tax-return"]);

export function parseFinanceDeskTab(raw: unknown): FinanceDeskTabId {
  const value = typeof raw === "string" ? raw : "";
  return FINANCE_DESK_TABS.find((t) => t.id === value)?.id ?? "statements";
}

export function formatPkr(amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function isMissingFinanceDeskRelation(message: string): boolean {
  const m = message.toLowerCase();
  return (
    (m.includes("finance_desk_entries") || m.includes("finance_desk_audits")) &&
    (m.includes("does not exist") || m.includes("could not find") || m.includes("schema cache"))
  );
}

export function kindsForTab(tab: FinanceDeskTabId): string[] | null {
  if (tab === "approvals") return null;
  if (tab === "receipts") return ["receipt", "invoice"];
  if (tab === "petty-cash") return ["petty-spend", "petty-replenish"];
  if (tab === "pay-orders") return ["payorder-issue", "payorder-clear", "payorder-cancel"];
  if (tab === "loans") return ["loan-draw", "loan-repay"];
  if (tab === "investments") return ["invest-buy", "invest-sell"];
  if (tab === "assets") return ["asset-buy", "depreciation"];
  if (tab === "budgets") return ["budget"];
  if (tab === "tax") return ["tax-challan", "withholding"];
  if (tab === "tax-returns") return ["tax-return"];
  if (tab === "installments") return ["installment"];
  return [];
}

export function filterEntriesForTab(
  entries: FinanceDeskEntry[],
  tab: FinanceDeskTabId,
): FinanceDeskEntry[] {
  if (tab === "approvals") return entries.filter((e) => e.status === "draft");
  const kinds = kindsForTab(tab);
  if (!kinds || kinds.length === 0) return [];
  return entries.filter((e) => kinds.includes(e.kind));
}

export function validateFinanceDeskWrite(input: {
  kind: string;
  title: string;
  amount: number;
  entryDate?: string;
  status?: FinanceDeskEntryStatus;
}): { ok: true } | { ok: false; message: string } {
  const kind = (input.kind ?? "").trim();
  const title = (input.title ?? "").trim();
  if (kind.length < 2) return { ok: false, message: "Choose an entry kind." };
  if (title.length < 2) return { ok: false, message: "Title is required." };
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    return { ok: false, message: "Amount must be zero or greater." };
  }
  if (input.entryDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.entryDate)) {
    return { ok: false, message: "Use a valid date." };
  }
  return { ok: true };
}

export function computeBooks(entries: FinanceDeskEntry[]): FinanceDeskBooks {
  const posted = entries.filter((e) => e.status === "posted");
  const sum = (kinds: string[]) =>
    posted.filter((e) => kinds.includes(e.kind)).reduce((n, e) => n + e.amount, 0);

  const assets =
    sum(["asset-buy", "invest-buy", "petty-replenish", "receipt", "loan-draw", "payorder-issue"]) -
    sum(["depreciation", "invest-sell", "petty-spend", "payorder-clear", "payorder-cancel"]);
  const liabilities = sum(["loan-draw", "tax-challan", "withholding"]) - sum(["loan-repay"]);
  const equity = sum(["capital"]);
  const income = sum(["receipt", "invoice", "invest-sell"]);
  const expenses = sum(["petty-spend", "depreciation", "tax-challan", "withholding", "loan-repay"]);
  const profit = income - expenses;
  const debit = assets + expenses;
  const credit = liabilities + equity + income;
  return {
    assets: Math.max(0, assets),
    liabilities: Math.max(0, liabilities),
    equity: Math.max(0, equity),
    income: Math.max(0, income),
    expenses: Math.max(0, expenses),
    profit,
    equation: Math.abs(debit - credit) < 0.5,
    debit: Math.max(0, debit),
    credit: Math.max(0, credit),
  };
}
