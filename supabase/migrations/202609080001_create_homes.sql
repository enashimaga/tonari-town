create function public.valid_partner(value jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  line jsonb;
begin
  if jsonb_typeof(value) is distinct from 'object' then return false; end if;
  if value->'version' is distinct from '1'::jsonb then return false; end if;
  if (value - array['version', 'partnerName', 'lines']) <> '{}'::jsonb then return false; end if;
  if jsonb_typeof(value->'partnerName') is distinct from 'string' then return false; end if;
  if char_length(value->>'partnerName') not between 1 and 40
    or (value->>'partnerName') ~ '^[[:space:]]*$' then return false; end if;
  if jsonb_typeof(value->'lines') is distinct from 'array' then return false; end if;
  if jsonb_array_length(value->'lines') not between 1 and 30 then return false; end if;
  if octet_length(value::text) > 16384 then return false; end if;
  for line in select * from jsonb_array_elements(value->'lines') loop
    if jsonb_typeof(line) is distinct from 'object' then return false; end if;
    if (line - array['scene', 'text']) <> '{}'::jsonb then return false; end if;
    if jsonb_typeof(line->'scene') is distinct from 'string' then return false; end if;
    if line->>'scene' not in ('anytime', 'morning', 'day', 'night') then return false; end if;
    if jsonb_typeof(line->'text') is distinct from 'string' then return false; end if;
    if char_length(line->>'text') not between 1 and 160
      or (line->>'text') ~ '^[[:space:]]*$' then return false; end if;
  end loop;
  return true;
end;
$$;

create table public.homes (
  owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  district integer not null default 0 check (district = 0),
  plot integer not null check (plot between 0 and 11),
  partner jsonb not null check (public.valid_partner(partner)),
  published boolean not null default false,
  unique (district, plot)
);

alter table public.homes enable row level security;

revoke all on public.homes from anon, authenticated;
grant select on public.homes to anon;
grant select, insert, update, delete on public.homes to authenticated;

create policy "Read published homes or own home" on public.homes
for select to anon, authenticated
using (published or (select auth.uid()) = owner_id);

create policy "Insert own home" on public.homes
for insert to authenticated
with check ((select auth.uid()) = owner_id);

create policy "Update own home" on public.homes
for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Delete own home" on public.homes
for delete to authenticated
using ((select auth.uid()) = owner_id);
