-- Dias de descanso trabajados y su recargo
alter table public.sueldos
  add column if not exists dias_descanso integer default 0,
  add column if not exists recargo_descanso numeric(12,2) default 0;
