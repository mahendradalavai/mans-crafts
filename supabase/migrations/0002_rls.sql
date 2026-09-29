-- Row Level Security: the browser's anon key can read active products and
-- nothing else. Orders are written only through public.create_order()
-- (SECURITY DEFINER), never from the client.

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- An earlier hand-made table shipped two duplicate SELECT policies with
-- `using (true)`, which would expose inactive products to the storefront.
-- They are replaced by the single active-only policy below.
drop policy if exists "Anyone can view products" on public.products;
drop policy if exists "Public can view products" on public.products;

drop policy if exists "active products are public" on public.products;
create policy "active products are public"
  on public.products
  for select
  to anon
  using (active = true);

-- The pre-existing "Admins can insert/update/delete products" policies are left
-- alone: they only apply to signed-in users carrying app_metadata.role = 'admin',
-- so they grant the anon key nothing.

-- Deliberately no policies on orders or order_items: anon INSERT/UPDATE/DELETE
-- attempts are refused. The service role bypasses RLS, so the shop owner can
-- still manage orders from the dashboard or an admin tool.
