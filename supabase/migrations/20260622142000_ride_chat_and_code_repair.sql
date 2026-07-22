-- Daily ride flow hardening: robust private codes, map demand signals support, and ride chat.
-- Additive migration only; no tables or rows are deleted.

create table if not exists public.ride_chat_messages (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.ride_requests(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamp with time zone not null default now()
);

create index if not exists ride_chat_messages_ride_created_idx
on public.ride_chat_messages(ride_id, created_at);

alter table public.ride_chat_messages enable row level security;

drop policy if exists "ride participants view chat" on public.ride_chat_messages;
drop policy if exists "ride participants send chat" on public.ride_chat_messages;
drop policy if exists "users view own ride codes" on public.ride_confirmation_codes;
drop policy if exists "ride participants insert ride codes" on public.ride_confirmation_codes;
drop policy if exists "ride participants update ride codes" on public.ride_confirmation_codes;

create policy "ride participants view chat"
on public.ride_chat_messages for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.ride_requests rr
    where rr.id = ride_chat_messages.ride_id
      and (
        rr.user_id = auth.uid()
        or rr.assigned_rider_id = auth.uid()
      )
  )
);

create policy "ride participants send chat"
on public.ride_chat_messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.ride_requests rr
    where rr.id = ride_chat_messages.ride_id
      and rr.status in ('assigned', 'started')
      and (
        rr.user_id = auth.uid()
        or rr.assigned_rider_id = auth.uid()
      )
  )
);

create policy "users view own ride codes"
on public.ride_confirmation_codes for select to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "ride participants insert ride codes"
on public.ride_confirmation_codes for insert to authenticated
with check (user_id = auth.uid() or public.is_admin());

create policy "ride participants update ride codes"
on public.ride_confirmation_codes for update to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

grant select, insert, update on public.ride_chat_messages to authenticated;
grant select, insert, update on public.ride_confirmation_codes to authenticated;

create or replace function public.get_or_create_ride_confirmation_code(p_ride_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.ride_requests;
  v_code text;
begin
  select * into v_ride
  from public.ride_requests
  where id = p_ride_id
  for update;

  if v_ride.id is null then
    raise exception 'Ride not found';
  end if;

  if auth.uid() <> v_ride.user_id and not public.is_admin() then
    raise exception 'Only the booking user can view this ride code';
  end if;

  insert into public.ride_confirmation_codes (ride_id, user_id, code)
  values (
    v_ride.id,
    v_ride.user_id,
    lpad(floor(random() * 10000)::integer::text, 4, '0')
  )
  on conflict (ride_id) do nothing;

  select code into v_code
  from public.ride_confirmation_codes
  where ride_id = v_ride.id;

  if v_code is null then
    raise exception 'Could not prepare ride confirmation code';
  end if;

  return v_code;
end;
$$;

revoke execute on function public.get_or_create_ride_confirmation_code(uuid) from anon;
grant execute on function public.get_or_create_ride_confirmation_code(uuid) to authenticated;

revoke execute on function public.mark_ride_ready_and_assign(uuid, integer) from anon;
revoke execute on function public.mark_ride_ready_and_assign(uuid) from anon;
grant execute on function public.mark_ride_ready_and_assign(uuid, integer) to authenticated;
grant execute on function public.mark_ride_ready_and_assign(uuid) to authenticated;

revoke execute on function public.get_or_create_ride_confirmation_code(uuid) from anon;
grant execute on function public.get_or_create_ride_confirmation_code(uuid) to authenticated;

notify pgrst, 'reload schema';
