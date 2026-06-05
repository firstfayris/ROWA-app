-- ============================================================
-- AUTO STOCK DEDUCTION TRIGGER
-- ตัดสต็อกอัตโนมัติเมื่อมี order item เข้าระบบ (Lazada/Shopee/หน้าร้าน)
-- ============================================================

-- Function: ตัดสต็อกเมื่อ order_item ถูก insert
create or replace function public.auto_deduct_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_platform text;
  v_order_status text;
begin
  -- ดึง platform และ status ของ order
  select platform, status
  into v_platform, v_order_status
  from public.orders
  where id = NEW.order_id;

  -- ตัดสต็อกเมื่อ order ไม่ใช่สถานะยกเลิก
  if v_order_status != 'cancelled' then
    insert into public.stock_movements (
      product_id,
      type,
      quantity,
      note,
      created_by
    ) values (
      NEW.product_id,
      'out',
      NEW.quantity,
      case v_platform
        when 'lazada' then 'ขาย Lazada #' || (select coalesce(platform_order_id, left(order_id::text, 8)) from public.orders where id = NEW.order_id)
        when 'shopee' then 'ขาย Shopee #' || (select coalesce(platform_order_id, left(order_id::text, 8)) from public.orders where id = NEW.order_id)
        else 'ขายหน้าร้าน #' || left(NEW.order_id::text, 8)
      end,
      -- ใช้ system user (service role) สำหรับ auto-deduction
      (select id from public.profiles where role = 'admin' order by created_at limit 1)
    );
  end if;

  return NEW;
end;
$$;

-- Trigger: ยิงหลัง insert order_item
create trigger trg_auto_deduct_stock
  after insert on public.order_items
  for each row
  execute function public.auto_deduct_stock();

-- ============================================================
-- RESTORE STOCK TRIGGER
-- คืนสต็อกอัตโนมัติเมื่อ order ถูกยกเลิก
-- ============================================================

create or replace function public.auto_restore_stock_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- ถ้าสถานะเปลี่ยนเป็น 'cancelled' ให้คืนสต็อก
  if NEW.status = 'cancelled' and OLD.status != 'cancelled' then
    insert into public.stock_movements (
      product_id,
      type,
      quantity,
      note,
      created_by
    )
    select
      oi.product_id,
      'in',
      oi.quantity,
      'คืนสต็อกจากการยกเลิก #' || coalesce(NEW.platform_order_id, left(NEW.id::text, 8)),
      (select id from public.profiles where role = 'admin' order by created_at limit 1)
    from public.order_items oi
    where oi.order_id = NEW.id;
  end if;

  return NEW;
end;
$$;

-- Trigger: ยิงเมื่อ order status เปลี่ยน
create trigger trg_restore_stock_on_cancel
  after update of status on public.orders
  for each row
  execute function public.auto_restore_stock_on_cancel();

-- ============================================================
-- PREVENT OVERSELLING
-- ป้องกันขายเกินสต็อก (optional - comment out ถ้าไม่ต้องการ)
-- ============================================================

create or replace function public.check_stock_before_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_stock integer;
  v_platform text;
begin
  -- ดึง platform ของ order
  select platform into v_platform
  from public.orders where id = NEW.order_id;

  -- ดึงสต็อกปัจจุบัน
  select current_stock into v_current_stock
  from public.product_stock
  where id = NEW.product_id;

  -- ถ้าสต็อกไม่พอ (สำหรับหน้าร้านเท่านั้น - Lazada/Shopee จัดการเองได้)
  if v_platform = 'store' and v_current_stock < NEW.quantity then
    raise exception 'สต็อกไม่เพียงพอ: มี % ชิ้น แต่ต้องการ % ชิ้น', v_current_stock, NEW.quantity;
  end if;

  return NEW;
end;
$$;

create trigger trg_check_stock_before_order
  before insert on public.order_items
  for each row
  execute function public.check_stock_before_order();
