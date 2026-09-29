-- P1 follow-up: put held stock back when an order is cancelled.
--
-- Placing an order takes stock down straight away. The 24 hour expiry returned
-- that stock for orders nobody confirmed, but the shop's own "Cancel" button did
-- not — cancelling a pending order quietly lost those units from the catalogue
-- for good.
--
-- Both paths now go through one trigger, so there is a single place that decides
-- when stock comes back, and it can only happen once per order:
--   * pending or confirmed → cancelled  (the shop said no)
--   * pending → expired                 (nobody confirmed in time)
-- A fulfilled order has physically shipped, so cancelling after that must not
-- restock it.

create or replace function public.release_order_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('cancelled', 'expired') and old.status in ('pending', 'confirmed') then
    update public.products p
       set stock = p.stock + i.quantity
      from public.order_items i
     where i.order_id = new.id
       and p.id = i.product_id;
  end if;
  return new;
end;
$$;

-- Trigger functions are invoked by the trigger machinery, not called directly,
-- so nothing needs EXECUTE on this one.
revoke all on function public.release_order_stock() from public;

drop trigger if exists orders_release_stock on public.orders;
create trigger orders_release_stock
  after update of status on public.orders
  for each row
  execute function public.release_order_stock();

-- Expiry now just closes the order; the trigger hands the stock back. The
-- manual stock update is removed so the same units cannot be returned twice.
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
    update public.orders
       set status = 'expired'
     where id = v_order_id
       and status = 'pending';

    if found then
      v_expired := v_expired + 1;
    end if;
  end loop;

  return v_expired;
end;
$$;

revoke all on function public.expire_stale_reservations() from public;
grant execute on function public.expire_stale_reservations() to authenticated;
