-- Atomic, validated order creation.
-- Called from the storefront as: supabase.rpc('create_order', { p_items: [{ product_id, quantity }] })
-- Prices and stock are resolved from the catalogue inside the function, so a
-- tampered client cannot dictate what an order costs.

create or replace function public.create_order(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id bigint;
  v_order_number text;
  v_subtotal numeric(10,2) := 0;
  v_requested integer;
  v_line jsonb;
  v_product public.products%rowtype;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your bag is empty.' using errcode = '22023';
  end if;

  -- Pass 1: validate every line and lock the rows we are about to decrement.
  for v_line in select * from jsonb_array_elements(p_items) loop
    v_requested := coalesce(nullif(v_line ->> 'quantity', '')::integer, 0);
    if v_requested < 1 then
      raise exception 'Quantity must be at least 1.' using errcode = '22023';
    end if;

    select * into v_product
    from public.products
    where id = nullif(v_line ->> 'product_id', '')::bigint
    for update;

    if not found then
      raise exception 'Unknown product: %', v_line ->> 'product_id' using errcode = 'P0002';
    end if;
    if not v_product.active then
      raise exception '% is no longer available.', v_product.name using errcode = 'P0001';
    end if;
    if v_product.stock < v_requested then
      raise exception 'Only % left of %.', v_product.stock, v_product.name using errcode = 'P0001';
    end if;

    v_subtotal := v_subtotal + (v_product.price * v_requested);
  end loop;

  v_order_number := 'MC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.order_number_seq')::text, 5, '0');

  insert into public.orders (order_number, status, currency, subtotal)
  values (v_order_number, 'pending', 'INR', v_subtotal)
  returning id into v_order_id;

  -- Pass 2: snapshot the unit prices and take the stock down.
  for v_line in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products where id = (v_line ->> 'product_id')::bigint;
    v_requested := (v_line ->> 'quantity')::integer;

    insert into public.order_items (order_id, product_id, quantity, unit_price)
    values (v_order_id, v_product.id, v_requested, v_product.price);

    update public.products set stock = stock - v_requested where id = v_product.id;
  end loop;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal', v_subtotal
  );
end;
$$;

revoke all on function public.create_order(jsonb) from public;
grant execute on function public.create_order(jsonb) to anon, authenticated;
