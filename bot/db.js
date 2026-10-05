import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SB_URL, process.env.SB_SERVICE_KEY);

export async function usuarioPorChat(chatId) {
  const { data, error } = await sb
    .from('vinculaciones')
    .select('usuario_id, perfiles:perfiles(email, nombre)')
    .eq('telegram_chat_id', chatId)
    .maybeSingle();
  if (error || !data) return null;
  return { uid: data.usuario_id, email: data.perfiles?.email, nombre: data.perfiles?.nombre };
}

export async function usuarioPorCodigo(codigo) {
  const { data, error } = await sb
    .from('codigos_vinculacion')
    .select('usuario_id')
    .eq('codigo', codigo)
    .gt('expira', new Date().toISOString())
    .maybeSingle();
  if (error || !data) return null;
  return data.usuario_id;
}

export async function vincular(uid, chatId) {
  const { error } = await sb
    .from('vinculaciones')
    .upsert({ usuario_id: uid, telegram_chat_id: chatId }, { onConflict: 'telegram_chat_id' });
  return error;
}

export async function categorias(uid) {
  const { data } = await sb.from('categorias').select('id, nombre').eq('usuario_id', uid).order('nombre');
  return data || [];
}

export async function ingresoMes(uid, mes, anio) {
  const { data } = await sb
    .from('sueldos')
    .select('sueldo_neto')
    .eq('usuario_id', uid)
    .eq('mes', mes)
    .eq('anio', anio)
    .maybeSingle();
  return data?.sueldo_neto ?? null;
}

export async function presupuestosMes(uid, mes, anio) {
  const { data } = await sb
    .from('presupuestos')
    .select('categoria_id, monto')
    .eq('usuario_id', uid)
    .eq('mes', mes)
    .eq('anio', anio);
  return data || [];
}

export async function gastosMes(uid, mes, anio) {
  const desde = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const hasta = `${anio}-${String(mes).padStart(2, '0')}-31`;
  const { data } = await sb
    .from('gastos')
    .select('monto, categoria_id')
    .eq('usuario_id', uid)
    .gte('fecha', desde)
    .lte('fecha', hasta);
  return data || [];
}

export async function imageHashExists(uid, hash) {
  const { data } = await sb
    .from('gastos')
    .select('id')
    .eq('usuario_id', uid)
    .eq('image_hash', hash)
    .limit(1)
    .maybeSingle();
  return !!data;
}

export async function crearGasto({ uid, categoria_id, monto, descripcion, fecha, nro_operacion, image_hash, chatId, messageId }) {
  const { data, error } = await sb
    .from('gastos')
    .insert({
      usuario_id: uid, categoria_id, monto, descripcion, fecha,
      nro_operacion, image_hash, telegram_chat_id: chatId, telegram_message_id: messageId
    })
    .select()
    .maybeSingle();
  return { data, error };
}

export async function ultimoGasto(uid) {
  const { data } = await sb
    .from('gastos')
    .select('id, monto, descripcion, created_at')
    .eq('usuario_id', uid)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function borrarGasto(id) {
  const { error } = await sb.from('gastos').delete().eq('id', id);
  return error;
}

export async function setPresupuesto(uid, categoria_id, mes, anio, monto) {
  const { data, error } = await sb
    .from('presupuestos')
    .upsert({ usuario_id: uid, categoria_id, mes, anio, monto }, { onConflict: 'usuario_id,categoria_id,mes,anio' })
    .select()
    .maybeSingle();
  return { data, error };
}
