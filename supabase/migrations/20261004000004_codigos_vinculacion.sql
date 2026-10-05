-- Códigos de vinculación Telegram <-> cuenta (generados desde la página)
create table public.codigos_vinculacion (
  codigo text primary key,
  usuario_id uuid references public.perfiles(id) on delete cascade not null,
  expira timestamptz not null,
  created_at timestamptz default now()
);
alter table public.codigos_vinculacion enable row level security;
-- El usuario genera su propio código desde la página; el bot lo consume con service_role
create policy "Usuarios generan su codigo" on public.codigos_vinculacion for insert with check (auth.uid() = usuario_id);
