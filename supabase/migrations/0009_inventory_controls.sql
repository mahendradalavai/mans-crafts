-- P1: inventory controls.
--
-- Orders take stock down the moment they are placed, but an order is only real
-- once the shop confirms it over WhatsApp. Without an expiry, a cart that is
-- never confirmed holds that stock forever. A pending order now holds its stock
-- for 24 hours; after that expire_stale_reservations() cancels it and puts the
-- stock back.

alter table public.products
  add column if not exists low_stock_threshold integer not null default 3;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.products'::regclass and conname = 'products_low_stock_threshold_check'
  ) then
    alter table public.products
      add constraint products_low_stock_threshold_check check (low_stock_threshold >= 0);
  end if;
end
$$;

alter table public.orders
  add column if not exists reserved_until timestamptz;

-- New orders default to a 24 hour hold. This sits as a column default so the
-- reservation window is visible in one place.
alter table public.orders
  alter column reserved_until set default (now() + interval '24 hours');

create index if not exists orders_pending_reserved_idx
  on public.orders (reserved_until)
  where status = 'pending';

-- "Expired" is different from "cancelled": one means nobody confirmed in time,
-- the other means the shop said no.
alter type public.order_status add value if not exists 'expired';

create or replace function public.expire_stale_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id bigint;
  v_expired integer := 0;
begin
  for v_order_id in
    select id
      from public.orders
     where status = 'pending'
       and reserved_until is not null
       and reserved_until < now()
     order by id
     for update skip locked
  loop
    -- Hand the held stock back...
    update public.products p
       set stock = p.stock + i.quantity
      from public.order_items i
     where i.order_id = v_order_id
       and p.id = i.product_id;

    -- ...and close the order. Only stock still held by a pending order is
    -- returned, so a confirmed or fulfilled order is never touched.
    update public.orders
       set status = 'expired'
     where id = v_order_id
       and status = 'pending';

    v_expired := v_expired + 1;
  end loop;

  return v_expired;
end;
$$;

revoke all on function public.expire_stale_reservations() from public;
grant execute on function public.expire_stale_reservations() to authenticated;

-- Run it hourly. If pg_cron is not available on this project the migration still
-- succeeds, and the admin page exposes a manual "release expired holds" button.
do $$
begin
  create extension if not exists pg_cron;

  perform cron.schedule(
    'expire-stale-reservations',
    '17 * * * *',
    'select public.expire_stale_reservations();'
  );
exception when others then
  raise notice 'pg_cron unavailable (%), so reservation expiry must be triggered manually.', sqlerrm;
end
$$;
