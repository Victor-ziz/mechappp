create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id integer not null references public.products (id) on delete cascade,
  customer_id uuid not null references auth.users (id) on delete cascade,
  customer_name text not null,
  rating integer not null check (rating between 1 and 5),
  comment text not null check (length(trim(comment)) between 2 and 400),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (product_id, customer_id)
);

create index if not exists reviews_product_status_idx on public.reviews (product_id, status);
create index if not exists reviews_status_created_idx on public.reviews (status, created_at desc);

alter table public.reviews enable row level security;

drop policy if exists "Read published reviews" on public.reviews;
create policy "Read published reviews"
on public.reviews for select
to anon, authenticated
using (status = 'approved' or customer_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "Admins moderate reviews" on public.reviews;
create policy "Admins moderate reviews"
on public.reviews for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create or replace function public.review_access(p_product_id integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_bought boolean := false;
  v_status text;
begin
  if auth.uid() is null then
    return jsonb_build_object('signed_in', false, 'purchased', false, 'review_status', null);
  end if;

  select exists (
    select 1
    from public.orders as store_order
    cross join lateral jsonb_array_elements(store_order.items) as item
    where store_order.customer_id = auth.uid()
      and store_order.status in ('paid', 'processing', 'completed')
      and coalesce(item ->> 'id', '') ~ '^[0-9]+$'
      and (item ->> 'id')::integer = p_product_id
  ) into v_bought;

  select reviews.status into v_status
  from public.reviews as reviews
  where reviews.product_id = p_product_id
    and reviews.customer_id = auth.uid();

  return jsonb_build_object(
    'signed_in', true,
    'purchased', v_bought,
    'review_status', v_status
  );
end;
$$;

create or replace function public.submit_product_review(
  p_product_id integer,
  p_rating integer,
  p_comment text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comment text := trim(coalesce(p_comment, ''));
  v_name text;
  v_status text;
  v_bought boolean;
begin
  if auth.uid() is null then
    raise exception 'Sign in to review a part';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'Choose a rating from 1 to 5';
  end if;
  if length(v_comment) not between 2 and 400 then
    raise exception 'Write a short review';
  end if;
  if not exists (select 1 from public.products where id = p_product_id and active = true) then
    raise exception 'This part is not available';
  end if;

  select exists (
    select 1
    from public.orders as store_order
    cross join lateral jsonb_array_elements(store_order.items) as item
    where store_order.customer_id = auth.uid()
      and store_order.status in ('paid', 'processing', 'completed')
      and coalesce(item ->> 'id', '') ~ '^[0-9]+$'
      and (item ->> 'id')::integer = p_product_id
  ) into v_bought;
  if not v_bought then
    raise exception 'You can review this part after you buy it';
  end if;

  select reviews.status into v_status
  from public.reviews as reviews
  where reviews.product_id = p_product_id
    and reviews.customer_id = auth.uid();
  if v_status in ('pending', 'approved') then
    raise exception 'You already reviewed this part';
  end if;

  select coalesce(
    nullif(trim(profile.full_name), ''),
    nullif(trim(coalesce(auth.jwt() -> 'user_metadata' ->> 'full_name', '')), ''),
    'Customer'
  )
  into v_name
  from public.customer_profiles as profile
  where profile.id = auth.uid();
  v_name := coalesce(v_name, 'Customer');

  if v_status = 'rejected' then
    update public.reviews
    set rating = p_rating,
        comment = v_comment,
        customer_name = v_name,
        status = 'pending',
        created_at = now()
    where product_id = p_product_id
      and customer_id = auth.uid();
  else
    insert into public.reviews (product_id, customer_id, customer_name, rating, comment, status)
    values (p_product_id, auth.uid(), v_name, p_rating, v_comment, 'pending');
  end if;

  return 'pending';
end;
$$;

revoke all on function public.review_access(integer) from public;
grant execute on function public.review_access(integer) to anon, authenticated;
revoke all on function public.submit_product_review(integer, integer, text) from public;
grant execute on function public.submit_product_review(integer, integer, text) to authenticated;
grant select on public.reviews to anon, authenticated;
grant update (status) on public.reviews to authenticated;
