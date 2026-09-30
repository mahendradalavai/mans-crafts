-- MAN's Crafts — production hardening.
--
-- Reconciles live permissions with the repository, restores the stock-release
-- trigger, adds the missing product foreign-key index, and avoids per-row auth
-- re-evaluation in admin RLS policies.

create or replace function public.release_order_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('cancelled', 'expired')
     and old.status in ('pending', 'confirmed') then
    update public.products p
       set stock = p.stock + i.quantity
      from public.order_items i
     where i.order_id = new.id
       and p.id = i.product_id;
  end if;
  return new;
end;
$$;

revoke all on function public.release_order_stock() from public;

drop trigger if exists orders_release_stock on public.orders;
create trigger orders_release_stock
  after update of status on public.orders
  for each row
  execute function public.release_order_stock();

revoke all on function public.expire_stale_reservations() from public;
grant execute on function public.expire_stale_reservations() to authenticated;

revoke all on function public.create_order(jsonb, uuid, text) from public;
grant execute on function public.create_order(jsonb, uuid, text) to anon, authenticated;

revoke all on function public.log_order_failure(text, text, jsonb, uuid, text) from public;
grant execute on function public.log_order_failure(text, text, jsonb, uuid, text) to anon, authenticated;

revoke all on function public.claim_admin_account(text, text) from public;
grant execute on function public.claim_admin_account(text, text) to anon, authenticated;

create index if not exists order_items_product_id_idx
  on public.order_items (product_id);

drop policy if exists "Admins can read products" on public.products;
create policy "Admins can read products"
  on public.products for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admins can insert products" on public.products;
create policy "Admins can insert products"
  on public.products for insert to authenticated
  with check ((select public.is_admin()));

drop policy if exists "Admins can update products" on public.products;
create policy "Admins can update products"
  on public.products for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Admins can delete products" on public.products;
create policy "Admins can delete products"
  on public.products for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admins can read orders" on public.orders;
create policy "Admins can read orders"
  on public.orders for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admins can update orders" on public.orders;
create policy "Admins can update orders"
  on public.orders for update to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admins can read order items" on public.order_items;
create policy "Admins can read order items"
  on public.order_items for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admins can read order failures" on public.order_failures;
create policy "Admins can read order failures"
  on public.order_failures for select to authenticated
  using ((select public.is_admin()));
