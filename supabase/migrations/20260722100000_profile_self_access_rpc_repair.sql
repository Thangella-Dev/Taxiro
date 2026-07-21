create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.is_rider()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'rider'
  );
$$;

create or replace function public.get_own_profile()
returns public.profiles
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select *
  into result
  from public.profiles
  where id = auth.uid();

  return result;
end;
$$;

create or replace function public.upsert_own_profile(
  p_role text default 'user',
  p_full_name text default 'Taxiro user',
  p_phone text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := lower(trim(coalesce(p_role, 'user')));
  safe_role text;
  existing_role text;
  result public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select role into existing_role
  from public.profiles
  where id = auth.uid();

  safe_role := case
    when existing_role = 'admin' then 'admin'
    when requested_role = 'rider' then 'rider'
    else 'user'
  end;

  insert into public.profiles (id, role, full_name, phone)
  values (
    auth.uid(),
    safe_role,
    nullif(trim(coalesce(p_full_name, 'Taxiro user')), ''),
    nullif(trim(coalesce(p_phone, '')), '')
  )
  on conflict (id) do update
    set role = case
          when public.profiles.role = 'admin' then 'admin'
          else excluded.role
        end,
        full_name = coalesce(excluded.full_name, public.profiles.full_name, 'Taxiro user'),
        phone = coalesce(excluded.phone, public.profiles.phone)
  returning * into result;

  return result;
end;
$$;

drop policy if exists "profiles select own or admin" on public.profiles;
drop policy if exists "profiles insert own" on public.profiles;
drop policy if exists "profiles update own or admin" on public.profiles;

create policy "profiles select own or admin"
on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());

create policy "profiles insert own"
on public.profiles for insert to authenticated
with check (id = auth.uid());

create policy "profiles update own or admin"
on public.profiles for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

grant execute on function public.get_own_profile() to authenticated;
grant execute on function public.upsert_own_profile(text, text, text) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_rider() to authenticated;

notify pgrst, 'reload schema';
