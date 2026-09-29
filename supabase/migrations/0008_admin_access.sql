-- P1: an admin surface for orders.
--
-- Access is real Supabase Auth rather than a shared passcode: the owner signs in
-- with their own account and Row Level Security decides what they can see. The
-- policies key off app_metadata.role = 'admin', matching the admin policies that
-- already existed on public.products.

create table if not exists public.admin_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.admin_emails enable row level security;
-- Deliberately no policies: the allowlist is server-side only, so the browser
-- can never read or edit it. The service role (and the dashboard) still can.

-- The shop owner. Change this list to add or remove administrators:
--   insert into public.admin_emails (email) values ('someone@example.com');
--   delete from public.admin_emails where email = 'someone@example.com';
insert into public.admin_emails (email)
values ('mahendradalavai7@gmail.com')
on conflict (email) do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- Bootstraps the owner's account: allowed only for an allowlisted address, and
-- only while that account does not exist yet. The password is chosen by the
-- owner in the admin page, so it is never written down anywhere else.
create or replace function public.claim_admin_account(p_email text, p_password text)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_user_id uuid := gen_random_uuid();
begin
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'Choose a password of at least 8 characters.' using errcode = '22023';
  end if;

  if v_email = '' or v_email not like '%@%' then
    raise exception 'Enter the email address this shop is registered to.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.admin_emails where lower(email) = v_email) then
    raise exception 'That email is not a configured administrator for this shop.' using errcode = 'P0001';
  end if;

  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'That account already exists. Sign in instead.' using errcode = 'P0001';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', 'admin'),
    '{}'::jsonb,
    now(),
    now(),
    '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  )
  values (
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    'email',
    v_user_id::text,
    now(),
    now(),
    now()
  );

  return 'created';
end;
$$;

revoke all on function public.claim_admin_account(text, text) from public;
grant execute on function public.claim_admin_account(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin policies.
--
-- Note that the public read policy on products is granted to `anon` only, so a
-- signed-in administrator needs their own policy to see inactive pieces too.
-- ---------------------------------------------------------------------------

drop policy if exists "Admins can read products" on public.products;
create policy "Admins can read products"
  on public.products for select to authenticated
  using (public.is_admin());

drop policy if exists "Admins can read orders" on public.orders;
create policy "Admins can read orders"
  on public.orders for select to authenticated
  using (public.is_admin());

drop policy if exists "Admins can update orders" on public.orders;
create policy "Admins can update orders"
  on public.orders for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can read order items" on public.order_items;
create policy "Admins can read order items"
  on public.order_items for select to authenticated
  using (public.is_admin());
