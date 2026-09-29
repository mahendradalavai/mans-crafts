-- P0: duplicate-order protection and rate limiting.
--
-- Duplicate submissions happen for real — a double click, a retry after a flaky
-- connection, or a browser re-sending the request. Each one used to create a
-- second order and take stock down twice. The storefront now sends a
-- client_order_id (one UUID per checkout attempt) and this function returns the
-- order it already created instead of making another one.
--
-- The rate limits live here because this function is the only way an order can
-- exist. They are deliberately generous: 5 orders per caller per 10 minutes and
-- 60 orders an hour across the whole shop. They are a flood guard, not a
-- security boundary — a determined caller can spoof both keys.

alter table public.orders add column if not exists client_order_id uuid;
alter table public.orders add column if not exists client_ip text;
alter table public.orders add column if not exists client_session_id text;

create unique index if not exists orders_client_order_id_key
  on public.orders (client_order_id)
  where client_order_id is not null;

create index if not exists orders_client_ip_created_at_idx
  on public.orders (client_ip, created_at desc);

create index if not exists orders_client_session_created_at_idx
  on public.orders (client_session_id, created_at desc);

-- The one-argument version is dropped rather than left alongside: keeping it
-- would leave a way to create an order that skips the idempotency key.
drop function if exists public.create_order(jsonb);

create or replace function public.create_order(
  p_items jsonb,
  p_client_order_id uuid default null,
  p_client_session_id text default null
)
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
  v_headers text;
  v_client_ip text;
  v_session text;
  v_recent integer;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your bag is empty.' using errcode = '22023';
  end if;

  -- PostgREST exposes the original request headers, so the first x-forwarded-for
  -- entry identifies the caller. Anything missing or unparseable just skips the
  -- per-IP rule instead of failing the order.
  v_headers := nullif(current_setting('request.headers', true), '');
  if v_headers is not null then
    begin
      v_client_ip := nullif(trim(split_part(coalesce(v_headers::jsonb ->> 'x-forwarded-for', ''), ',', 1)), '');
    exception when others then
      v_client_ip := null;
    end;
  end if;
  if v_client_ip is not null and length(v_client_ip) > 64 then
    v_client_ip := null;
  end if;

  v_session := nullif(trim(coalesce(p_client_session_id, '')), '');
  if v_session is not null and length(v_session) > 64 then
    v_session := null;
  end if;

  -- Already ordered? Return the original order, so a retry is harmless.
  if p_client_order_id is not null then
    select id, order_number, subtotal
      into v_order_id, v_order_number, v_subtotal
      from public.orders
     where client_order_id = p_client_order_id;
    if found then
      return jsonb_build_object(
        'order_id', v_order_id,
        'order_number', v_order_number,
        'subtotal', v_subtotal,
        'duplicate', true
      );
    end if;
  end if;

  if v_client_ip is not null then
    select count(*) into v_recent
      from public.orders
     where client_ip = v_client_ip and created_at > now() - interval '10 minutes';
    if v_recent >= 5 then
      raise exception 'Too many orders from this connection. Please try again in a few minutes.'
        using errcode = 'P0001';
    end if;
  end if;

  if v_session is not null then
    select count(*) into v_recent
      from public.orders
     where client_session_id = v_session and created_at > now() - interval '10 minutes';
    if v_recent >= 5 then
      raise exception 'Too many orders from this browser. Please try again in a few minutes.'
        using errcode = 'P0001';
    end if;
  end if;

  select count(*) into v_recent from public.orders where created_at > now() - interval '1 hour';
  if v_recent >= 60 then
    raise exception 'The shop is receiving a lot of orders right now. Please try again shortly, or message us on WhatsApp.'
      using errcode = 'P0001';
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

  begin
    insert into public.orders (order_number, status, currency, subtotal, client_order_id, client_ip, client_session_id)
    values (v_order_number, 'pending', 'INR', v_subtotal, p_client_order_id, v_client_ip, v_session)
    returning id into v_order_id;
  exception when unique_violation then
    -- A concurrent submission with the same key committed first. This savepoint
    -- rolls our insert back, so return theirs rather than a second order.
    select id, order_number, subtotal
      into v_order_id, v_order_number, v_subtotal
      from public.orders
     where client_order_id = p_client_order_id;
    if found then
      return jsonb_build_object(
        'order_id', v_order_id,
        'order_number', v_order_number,
        'subtotal', v_subtotal,
        'duplicate', true
      );
    end if;
    raise;
  end;

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
    'subtotal', v_subtotal,
    'duplicate', false
  );
end;
$$;

revoke all on function public.create_order(jsonb, uuid, text) from public;
grant execute on function public.create_order(jsonb, uuid, text) to anon, authenticated;
