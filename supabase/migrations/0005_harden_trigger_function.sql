-- Supabase's security advisor flagged public.set_updated_at() as having a
-- mutable search_path (lint 0011). The body only touches pg_catalog, so pinning
-- the path to empty closes the hijack window without changing behaviour.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
