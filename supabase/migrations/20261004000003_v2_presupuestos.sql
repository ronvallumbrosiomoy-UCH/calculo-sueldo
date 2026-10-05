-- v2.0: presupuestos y gastos personales (finanzas)

-- Categorías de gasto del usuario (editables/agregables)
create table public.categorias (
  id uuid default gen_random_uuid() primary key,
  usuario_id uuid references public.perfiles(id) on delete cascade not null,
  nombre text not null,
  created_at timestamptz default now(),
  unique (usuario_id, nombre)
);

-- Presupuesto por categoría y mes (ingreso viene de sueldos.sueldo_neto)
create table public.presupuestos (
  id uuid default gen_random_uuid() primary key,
  usuario_id uuid references public.perfiles(id) on delete cascade not null,
  categoria_id uuid references public.categorias(id) on delete cascade not null,
  mes integer not null check (mes between 1 and 12),
  anio integer not null check (anio between 2020 and 2100),
  monto numeric(12,2) not null check (monto >= 0),
  created_at timestamptz default now(),
  unique (usuario_id, categoria_id, mes, anio)
);

-- Gastos registrados (Telegram foto/texto, manual)
create table public.gastos (
  id uuid default gen_random_uuid() primary key,
  usuario_id uuid references public.perfiles(id) on delete cascade not null,
  categoria_id uuid references public.categorias(id) on delete set null,
  monto numeric(12,2) not null check (monto > 0),
  descripcion text,
  fecha date not null default now(),
  fuente text not null default 'telegram',
  nro_operacion text,
  image_hash text,
  telegram_chat_id bigint,
  telegram_message_id bigint,
  created_at timestamptz default now()
);
create index gastos_usuario_fecha_idx on public.gastos (usuario_id, fecha desc);

-- Vinculación usuario <-> chat de Telegram
create table public.vinculaciones (
  usuario_id uuid references public.perfiles(id) on delete cascade primary key,
  telegram_chat_id bigint unique not null,
  created_at timestamptz default now()
);

-- RLS: cada usuario solo ve sus datos
alter table public.categorias enable row level security;
alter table public.presupuestos enable row level security;
alter table public.gastos enable row level security;
alter table public.vinculaciones enable row level security;

create policy "Usuarios leen sus categorias" on public.categorias for select using (auth.uid() = usuario_id);
create policy "Usuarios insertan sus categorias" on public.categorias for insert with check (auth.uid() = usuario_id);
create policy "Usuarios actualizan sus categorias" on public.categorias for update using (auth.uid() = usuario_id);
create policy "Usuarios borran sus categorias" on public.categorias for delete using (auth.uid() = usuario_id);

create policy "Usuarios leen sus presupuestos" on public.presupuestos for select using (auth.uid() = usuario_id);
create policy "Usuarios insertan sus presupuestos" on public.presupuestos for insert with check (auth.uid() = usuario_id);
create policy "Usuarios actualizan sus presupuestos" on public.presupuestos for update using (auth.uid() = usuario_id);
create policy "Usuarios borran sus presupuestos" on public.presupuestos for delete using (auth.uid() = usuario_id);

create policy "Usuarios leen sus gastos" on public.gastos for select using (auth.uid() = usuario_id);
create policy "Usuarios insertan sus gastos" on public.gastos for insert with check (auth.uid() = usuario_id);
create policy "Usuarios actualizan sus gastos" on public.gastos for update using (auth.uid() = usuario_id);
create policy "Usuarios borran sus gastos" on public.gastos for delete using (auth.uid() = usuario_id);

create policy "Usuarios leen su vinculacion" on public.vinculaciones for select using (auth.uid() = usuario_id);
