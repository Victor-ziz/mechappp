alter table public.customer_profiles
  add column if not exists phone text not null default '';

alter table public.orders
  add column if not exists customer_phone text not null default '';

create or replace function public.sync_customer_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.customer_profiles (id, email, full_name, phone)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = excluded.full_name,
      phone = excluded.phone,
      updated_at = now();
  return new;
end;
$$;

update public.customer_profiles as profile
set phone = coalesce(users.raw_user_meta_data ->> 'phone', ''),
    updated_at = now()
from auth.users as users
where users.id = profile.id
  and profile.phone = '';

drop function if exists public.create_store_order(text, text, text, jsonb);

create or replace function public.create_store_order(
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_channel text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_total integer := 0;
  v_items jsonb := '[]'::jsonb;
  v_reference text := 'FRAN6-' || upper(replace(gen_random_uuid()::text, '-', ''));
  v_phone text := trim(coalesce(p_customer_phone, ''));
  v_digits text := regexp_replace(v_phone, '[^0-9]', '', 'g');
begin
  if p_channel is null or p_channel not in ('paystack', 'whatsapp') then
    raise exception 'Unsupported order channel';
  end if;
  if p_channel = 'paystack' and length(trim(coalesce(p_customer_name, ''))) not between 1 and 160 then
    raise exception 'Enter a valid customer name';
  end if;
  if p_channel = 'paystack' and (
    length(trim(coalesce(p_customer_email, ''))) not between 3 and 254
    or p_customer_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ) then
    raise exception 'Enter a valid customer email';
  end if;
  if p_channel = 'paystack' and length(v_digits) not between 10 and 15 then
    raise exception 'Enter a valid phone number';
  end if;
  if v_phone <> '' and length(v_digits) not between 10 and 15 then
    raise exception 'Enter a valid phone number';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'An order must contain a list of items';
  end if;
  if jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'An order must contain at least one item';
  end if;
  if p_channel = 'paystack' and (
    auth.uid() is null
    or lower(coalesce(auth.jwt() ->> 'email', '')) <> lower(p_customer_email)
  ) then
    raise exception 'Sign in with the checkout email to pay by card';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if coalesce(v_item ->> 'id', '') !~ '^[0-9]+$'
      or coalesce(v_item ->> 'quantity', '') !~ '^[0-9]+$' then
      raise exception 'Invalid product or quantity';
    end if;

    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity not between 1 and 50 then
      raise exception 'Quantity must be between 1 and 50';
    end if;

    select * into v_product
    from public.products
    where id = (v_item ->> 'id')::integer
      and active = true
    for share;

    if not found then
      raise exception 'A selected product is no longer available';
    end if;
    if v_product.stock < v_quantity then
      raise exception 'There is not enough stock for %', v_product.name;
    end if;

    v_total := v_total + v_product.price * v_quantity;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'id', v_product.id,
      'name', v_product.name,
      'quantity', v_quantity,
      'price', v_product.price
    ));
  end loop;

  insert into public.orders (
    reference, customer_id, customer_name, customer_email, customer_phone, channel, status, total, items
  )
  values (
    v_reference,
    auth.uid(),
    coalesce(nullif(trim(p_customer_name), ''), 'WhatsApp customer'),
    lower(trim(coalesce(p_customer_email, ''))),
    v_phone,
    p_channel,
    case when p_channel = 'paystack' then 'awaiting_payment' else 'whatsapp_requested' end,
    v_total,
    v_items
  );

  return jsonb_build_object('reference', v_reference, 'total', v_total);
end;
$$;

revoke all on function public.create_store_order(text, text, text, text, jsonb) from public;
grant execute on function public.create_store_order(text, text, text, text, jsonb) to anon, authenticated;
grant update (full_name, phone) on public.customer_profiles to authenticated;
