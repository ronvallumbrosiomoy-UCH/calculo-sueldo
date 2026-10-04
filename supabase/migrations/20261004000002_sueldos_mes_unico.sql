-- Un registro por usuario/mes: evita duplicados (ej. doble clic)
alter table public.sueldos
  add constraint sueldos_usuario_mes_unico unique (usuario_id, anio, mes);
