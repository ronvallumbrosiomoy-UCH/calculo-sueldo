-- Perfiles de usuario (vinculados a auth.users)
create table public.perfiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  nombre text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Registros de sueldo por mes (cada usuario solo ve los suyos)
create table public.sueldos (
  id uuid default gen_random_uuid() primary key,
  usuario_id uuid references public.perfiles(id) on delete cascade not null,
  mes text not null,
  anio integer not null,
  sueldo_bruto numeric(12,2) not null,
  dias_trabajados integer not null,
  horas_extra numeric(5,2) default 0,
  tipo_turno text default 'NOCHE',
  dias_noche integer default 0,
  tasa_bono numeric(4,2) default 35,
  sistema_prev text default 'AFP',
  afp text default 'Integra',
  bono_nocturno numeric(12,2) default 0,
  remuneracion_bruta numeric(12,2) not null,
  descuento_prev numeric(12,2) not null,
  renta_5ta numeric(12,2) default 0,
  sueldo_neto numeric(12,2) not null,
  created_at timestamptz default now()
);

-- Habilitar RLS
create extension if not exists pgcrypto;
alter table public.perfiles enable row level security;
alter table public.sueldos enable row level security;

-- Políticas: cada usuario solo puede ver/modificar sus propios datos
create policy "Usuarios pueden leer su perfil"
  on public.perfiles for select
  using (auth.uid() = id);

create policy "Usuarios pueden actualizar su perfil"
  on public.perfiles for update
  using (auth.uid() = id);

create policy "Usuarios pueden insertar su perfil"
  on public.perfiles for insert
  with check (auth.uid() = id);

create policy "Usuarios leen sus sueldos"
  on public.sueldos for select
  using (auth.uid() = usuario_id);

create policy "Usuarios insertan sus sueldos"
  on public.sueldos for insert
  with check (auth.uid() = usuario_id);

create policy "Usuarios actualizan sus sueldos"
  on public.sueldos for update
  using (auth.uid() = usuario_id);

create policy "Usuarios borran sus sueldos"
  on public.sueldos for delete
  using (auth.uid() = usuario_id);

-- Función para obtener el perfil al crear usuario (trigger)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.perfiles (id, email, nombre)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email,'@',1))
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger: crea perfil automáticamente al registrarse
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
