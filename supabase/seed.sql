-- Seed de desarrollo local (solo para probar en la BD local)
-- Usuario de prueba: el trigger on_auth_user_created crea el perfil automáticamente
insert into auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, aud, role
) values (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'test@local.dev',
  crypt('Password123!', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', ARRAY[]::text[]),
  jsonb_build_object('nombre', 'Tester Local'),
  now(), now(), '', '', 'authenticated', 'authenticated'
) on conflict (id) do nothing;

-- GoTrue espera estas columnas no-nulas; el insert directo las deja en NULL
update auth.users set
  confirmation_token = '',
  email_change_token_new = '',
  email_change_token_current = '',
  recovery_token = ''
where id = '11111111-1111-1111-1111-111111111111';

do $$
declare
  v_uid uuid := '11111111-1111-1111-1111-111111111111';
begin
  -- Categorías por defecto
  insert into public.categorias (usuario_id, nombre)
  select v_uid, c.n from (values ('Vivienda/Alquiler'),('Servicios'),('Transporte'),('Comida'),('Salud'),('Ocio'),('Otros'),('Ahorro')) as c(n)
  where not exists (select 1 from public.categorias where usuario_id = v_uid and nombre = c.n);

  -- Vinculación de prueba (chat de Telegram 123456789)
  insert into public.vinculaciones (usuario_id, telegram_chat_id)
  values (v_uid, 123456789)
  on conflict (usuario_id) do update set telegram_chat_id = 123456789;

  -- Mes de prueba guardado (habilita presupuestos: ingreso = sueldo_neto)
  -- bruto 2500, dias 30, bono 437.50 (15 noches al 35%), AFP Integra 12.75%
  insert into public.sueldos (
    usuario_id, mes, anio, sueldo_bruto, dias_trabajados, horas_extra,
    tipo_turno, dias_noche, tasa_bono, sistema_prev, afp,
    bono_nocturno, remuneracion_bruta, descuento_prev, renta_5ta, sueldo_neto
  ) values (v_uid, 10, 2026, 2500, 30, 0, 'NOCHE', 15, 35, 'AFP', 'Integra',
    437.50, 2937.50, 374.53, 0, 2562.97)
  on conflict (usuario_id, anio, mes) do nothing;
end $$;
