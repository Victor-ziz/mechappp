create table if not exists public.store_contact (
  id integer primary key check (id = 1),
  whatsapp_number text not null default '2349069245835',
  instagram_url text not null default '',
  facebook_url text not null default '',
  tiktok_url text not null default '',
  x_url text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.store_contact (id)
values (1)
on conflict (id) do nothing;

alter table public.store_contact enable row level security;

drop policy if exists "Anyone can view store contact" on public.store_contact;
create policy "Anyone can view store contact"
on public.store_contact for select
to anon, authenticated
using (true);

grant select on public.store_contact to anon, authenticated;
