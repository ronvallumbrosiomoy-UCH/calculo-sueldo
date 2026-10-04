-- Separar horas extra: horas al 25% y horas al 35%
alter table public.sueldos
  add column if not exists horas_extra_25 numeric(5,2) default 0,
  add column if not exists horas_extra_35 numeric(5,2) default 0;

-- Reubicar el historial existente: primeras 2h al 25%, el resto al 35%
update public.sueldos
  set horas_extra_25 = least(horas_extra, 2),
      horas_extra_35 = greatest(horas_extra - 2, 0)
where horas_extra > 0;
