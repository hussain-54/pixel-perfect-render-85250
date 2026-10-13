-- =============================================================================
-- Milestone 4 — Office Operations (suppliers, purchases, stock, ops orders, expenses)
-- Distinct from student tuition / university_fee_obligations / signup fees.
-- Forward-only. DO NOT apply without owner approval.
-- =============================================================================

do $$ begin
  create type public.ops_supplier_status as enum ('active', 'inactive');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ops_purchase_status as enum (
    'draft',
    'submitted',
    'approved',
    'partially_received',
    'received',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ops_order_status as enum (
    'draft',
    'confirmed',
    'fulfilled',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ops_expense_status as enum (
    'draft',
    'submitted',
    'reviewed',
    'rejected'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ops_stock_movement_kind as enum (
    'receive',
    'adjust',
    'issue'
  );
exception when duplicate_object then null;
end $$;

create or replace function public.can_access_office_ops()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or coalesce(
      public.current_business_role() in ('office_ops', 'manager', 'admin'),
      false
    );
$$;

create or replace function public.can_mutate_office_ops()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or coalesce(
      public.current_business_role() in ('office_ops', 'manager', 'admin'),
      false
    );
$$;

create table if not exists public.ops_suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text not null default '',
  email text not null default '',
  phone text not null default '',
  status public.ops_supplier_status not null default 'active',
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ops_inventory_items (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  unit text not null default 'unit',
  quantity_on_hand numeric(14, 3) not null default 0 check (quantity_on_hand >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ops_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.ops_suppliers (id) on delete restrict,
  status public.ops_purchase_status not null default 'draft',
  currency text not null default 'PKR',
  notes text,
  ordered_at date,
  created_by uuid references public.profiles (id) on delete set null,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ops_purchase_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.ops_purchase_orders (id) on delete cascade,
  inventory_item_id uuid not null references public.ops_inventory_items (id) on delete restrict,
  quantity_ordered numeric(14, 3) not null check (quantity_ordered > 0),
  quantity_received numeric(14, 3) not null default 0 check (quantity_received >= 0),
  unit_cost numeric(14, 2) not null default 0 check (unit_cost >= 0),
  created_at timestamptz not null default now(),
  constraint ops_purchase_received_lte_ordered check (quantity_received <= quantity_ordered)
);

create table if not exists public.ops_stock_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.ops_inventory_items (id) on delete restrict,
  kind public.ops_stock_movement_kind not null,
  quantity numeric(14, 3) not null check (quantity > 0),
  purchase_order_id uuid references public.ops_purchase_orders (id) on delete set null,
  notes text,
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.ops_sales_orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  status public.ops_order_status not null default 'draft',
  currency text not null default 'PKR',
  total_amount numeric(14, 2) not null default 0 check (total_amount >= 0),
  notes text,
  -- Explicitly NOT a student fee obligation.
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ops_expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'general',
  description text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null default 'PKR',
  status public.ops_expense_status not null default 'draft',
  incurred_on date not null default (current_date),
  -- Claimed/submitted ≠ verified payment (Accounts verifies elsewhere).
  created_by uuid references public.profiles (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists ops_suppliers_set_updated_at on public.ops_suppliers;
create trigger ops_suppliers_set_updated_at
  before update on public.ops_suppliers
  for each row execute function public.set_updated_at();

drop trigger if exists ops_inventory_items_set_updated_at on public.ops_inventory_items;
create trigger ops_inventory_items_set_updated_at
  before update on public.ops_inventory_items
  for each row execute function public.set_updated_at();

drop trigger if exists ops_purchase_orders_set_updated_at on public.ops_purchase_orders;
create trigger ops_purchase_orders_set_updated_at
  before update on public.ops_purchase_orders
  for each row execute function public.set_updated_at();

drop trigger if exists ops_sales_orders_set_updated_at on public.ops_sales_orders;
create trigger ops_sales_orders_set_updated_at
  before update on public.ops_sales_orders
  for each row execute function public.set_updated_at();

drop trigger if exists ops_expenses_set_updated_at on public.ops_expenses;
create trigger ops_expenses_set_updated_at
  before update on public.ops_expenses
  for each row execute function public.set_updated_at();

alter table public.ops_suppliers enable row level security;
alter table public.ops_inventory_items enable row level security;
alter table public.ops_purchase_orders enable row level security;
alter table public.ops_purchase_lines enable row level security;
alter table public.ops_stock_movements enable row level security;
alter table public.ops_sales_orders enable row level security;
alter table public.ops_expenses enable row level security;

-- Select: office ops + manager + admin. Accounts may view expenses only (separate policy).
do $$
declare
  t text;
begin
  foreach t in array array[
    'ops_suppliers',
    'ops_inventory_items',
    'ops_purchase_orders',
    'ops_purchase_lines',
    'ops_stock_movements',
    'ops_sales_orders'
  ]
  loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format(
      'create policy %I_select on public.%I for select to authenticated using (public.can_access_office_ops())',
      t, t
    );
    execute format('drop policy if exists %I_mutate on public.%I', t, t);
    execute format(
      'create policy %I_mutate on public.%I for all to authenticated using (public.can_mutate_office_ops()) with check (public.can_mutate_office_ops())',
      t, t
    );
  end loop;
end $$;

drop policy if exists ops_expenses_select on public.ops_expenses;
create policy ops_expenses_select on public.ops_expenses
  for select to authenticated
  using (
    public.can_access_office_ops()
    or coalesce(
      public.current_business_role() in ('accounts_banking_finance', 'manager', 'admin'),
      false
    )
  );

drop policy if exists ops_expenses_mutate on public.ops_expenses;
create policy ops_expenses_mutate on public.ops_expenses
  for all to authenticated
  using (public.can_mutate_office_ops())
  with check (public.can_mutate_office_ops());

grant select, insert, update on public.ops_suppliers to authenticated;
grant select, insert, update on public.ops_inventory_items to authenticated;
grant select, insert, update on public.ops_purchase_orders to authenticated;
grant select, insert, update on public.ops_purchase_lines to authenticated;
grant select, insert on public.ops_stock_movements to authenticated;
grant select, insert, update on public.ops_sales_orders to authenticated;
grant select, insert, update on public.ops_expenses to authenticated;
grant execute on function public.can_access_office_ops() to authenticated;
grant execute on function public.can_mutate_office_ops() to authenticated;
