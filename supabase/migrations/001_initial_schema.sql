-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ==========================================
-- PROFILES (extends auth.users)
-- ==========================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Admin can view all profiles" on public.profiles
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'staff')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ==========================================
-- PRODUCTS
-- ==========================================
create table public.products (
  id uuid primary key default uuid_generate_v4(),
  sku text not null unique,
  name text not null,
  description text,
  image_url text,
  cost_price numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;

create policy "Authenticated users can read products" on public.products
  for select using (auth.role() = 'authenticated');

create policy "Admin can insert products" on public.products
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admin can update products" on public.products
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admin can delete products" on public.products
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ==========================================
-- PRODUCT PLATFORMS (pricing per channel)
-- ==========================================
create table public.product_platforms (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references public.products(id) on delete cascade not null,
  platform text not null check (platform in ('lazada', 'shopee', 'store')),
  selling_price numeric(12,2) not null default 0,
  discount_percent numeric(5,2) not null default 0 check (discount_percent >= 0 and discount_percent <= 100),
  platform_product_id text,
  active boolean not null default true,
  unique(product_id, platform)
);

alter table public.product_platforms enable row level security;

create policy "Authenticated users can read product_platforms" on public.product_platforms
  for select using (auth.role() = 'authenticated');

create policy "Admin can manage product_platforms" on public.product_platforms
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ==========================================
-- STOCK MOVEMENTS
-- ==========================================
create table public.stock_movements (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references public.products(id) on delete cascade not null,
  type text not null check (type in ('in', 'out', 'adjustment')),
  quantity integer not null,
  note text,
  created_by uuid references public.profiles(id) not null,
  created_at timestamptz not null default now()
);

alter table public.stock_movements enable row level security;

create policy "Authenticated users can read stock_movements" on public.stock_movements
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert stock_movements" on public.stock_movements
  for insert with check (auth.role() = 'authenticated');

create policy "Admin can update/delete stock_movements" on public.stock_movements
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- View: current stock per product
create or replace view public.product_stock as
select
  p.id,
  p.sku,
  p.name,
  p.image_url,
  p.cost_price,
  coalesce(sum(
    case
      when sm.type = 'in' then sm.quantity
      when sm.type = 'out' then -sm.quantity
      when sm.type = 'adjustment' then sm.quantity
    end
  ), 0) as current_stock
from public.products p
left join public.stock_movements sm on sm.product_id = p.id
group by p.id, p.sku, p.name, p.image_url, p.cost_price;

-- ==========================================
-- ORDERS
-- ==========================================
create table public.orders (
  id uuid primary key default uuid_generate_v4(),
  platform text not null check (platform in ('lazada', 'shopee', 'store')),
  platform_order_id text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  total_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;

create policy "Authenticated users can read orders" on public.orders
  for select using (auth.role() = 'authenticated');

create policy "Admin can manage orders" on public.orders
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Staff can insert store orders" on public.orders
  for insert with check (
    platform = 'store' and auth.role() = 'authenticated'
  );

-- ==========================================
-- ORDER ITEMS
-- ==========================================
create table public.order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references public.orders(id) on delete cascade not null,
  product_id uuid references public.products(id) not null,
  quantity integer not null,
  unit_price numeric(12,2) not null,
  cost_price_at_sale numeric(12,2) not null default 0
);

alter table public.order_items enable row level security;

create policy "Authenticated users can read order_items" on public.order_items
  for select using (auth.role() = 'authenticated');

create policy "Admin can manage order_items" on public.order_items
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Staff can insert order_items" on public.order_items
  for insert with check (auth.role() = 'authenticated');

-- ==========================================
-- PLATFORM CREDENTIALS (admin only)
-- ==========================================
create table public.platform_credentials (
  id uuid primary key default uuid_generate_v4(),
  platform text not null unique check (platform in ('lazada', 'shopee')),
  app_key text not null,
  app_secret text not null,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  shop_id text,
  updated_at timestamptz not null default now()
);

alter table public.platform_credentials enable row level security;

create policy "Admin only access platform_credentials" on public.platform_credentials
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ==========================================
-- INDEXES
-- ==========================================
create index idx_stock_movements_product_id on public.stock_movements(product_id);
create index idx_order_items_order_id on public.order_items(order_id);
create index idx_order_items_product_id on public.order_items(product_id);
create index idx_orders_platform on public.orders(platform);
create index idx_orders_created_at on public.orders(created_at desc);
