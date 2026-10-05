import 'dotenv/config';
import crypto from 'node:crypto';
import * as db from './db.js';
import { leerComprobante } from './ocr.js';
import { fmt, norm, hoy, resumen, textoResumen, buscarCategoria } from './resumen.js';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN || BOT_TOKEN.includes('pega_aqui')) {
  console.error('Falta BOT_TOKEN en bot/.env (crea el bot con @BotFather en Telegram)');
  process.exit(1);
}
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Estado en memoria: chats esperando elegir categoría (MVP; en prod mover a BD)
const pendientes = new Map();

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(method, params = {}) {
  const r = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`${method} ${r.status}: ${t.slice(0, 200)}`);
  }
  return r.json();
}

const send = (chatId, text, extra = {}) =>
  api('sendMessage', { chat_id: chatId, text, ...extra });

function tecladoCategorias(categorias) {
  const rows = categorias.map(c => [{ text: c.nombre, callback_data: `cat:${c.id}` }]);
  rows.push([{ text: 'Sin presupuesto (saldo total)', callback_data: 'cat:none' }]);
  rows.push([{ text: 'Cancelar', callback_data: 'cat:cancel' }]);
  return { inline_keyboard: rows };
}

async function requiereUsuario(chatId) {
  const u = await db.usuarioPorChat(chatId);
  if (!u) {
    await send(chatId,
      'Este chat no está vinculado a ninguna cuenta.\n\n' +
      'Vincula tu cuenta desde la página (Vincular Telegram) o envía /vincular <codigo>.');
    return null;
  }
  return u;
}

async function requiereMes(chatId, uid) {
  const { mes, anio } = hoy();
  const ingreso = await db.ingresoMes(uid, mes, anio);
  if (ingreso == null) {
    await send(chatId,
      `Aún no tienes sueldo guardado de ${MESES[mes - 1]} ${anio}.\n` +
      'Primero calcula y guarda tu mes en la calculadora ("Guardar este mes").\n' +
      'Recién ahí puedes armar presupuestos y registrar gastos.');
    return null;
  }
  return ingreso;
}

// ---------- Flujo de foto -> OCR -> categoría ----------
async function flujoFoto(msg) {
  const chatId = msg.chat.id;
  const u = await requiereUsuario(chatId);
  if (!u) return;
  if (!await requiereMes(chatId, u.uid)) return;

  const fileId = msg.photo[msg.photo.length - 1].file_id;
  await send(chatId, '⏳ Descargando comprobante...');
  const file = await api('getFile', { file_id: fileId });
  const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.result.file_path}`;
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());

  const hash = crypto.createHash('sha256').update(buf).digest('hex');
  if (await db.imageHashExists(u.uid, hash)) {
    await send(chatId, '⚠️ Esta imagen ya fue registrada antes. No la voy a duplicar.');
    return;
  }

  await send(chatId, '⏳ Leyendo el comprobante con OCR...');
  let ocr;
  try {
    ocr = await leerComprobante(buf.toString('base64'));
  } catch (e) {
    console.error('OCR error', e);
    await send(chatId, 'No pude procesar la imagen. Escríbeme manualmente:\n`gasto <monto> <categoría>`');
    return;
  }
  if (ocr.error) {
    await send(chatId, 'No pude leer el monto de la imagen con confianza.\nEscríbeme manualmente:\n`gasto <monto> <categoría>`\nEj: `gasto 25 transporte`');
    return;
  }

  pendientes.set(chatId, {
    monto: Number(ocr.monto),
    descripcion: msg.caption || ocr.descripcion || null,
    fecha: ocr.fecha || new Date().toISOString().slice(0, 10),
    nro_operacion: ocr.nro_operacion || null,
    image_hash: hash
  });
  const cats = await db.categorias(u.uid);
  await send(chatId,
    `Monto detectado: ${fmt(ocr.monto)}\n` +
    (ocr.descripcion ? `Detalle: ${ocr.descripcion}\n` : '') +
    '¿De qué presupuesto sale?',
    { reply_markup: tecladoCategorias(cats) });
}

async function confirmarCategoria(cb) {
  const chatId = cb.message.chat.id;
  await api('answerCallbackQuery', { callback_query_id: cb.id });
  const data = cb.data;
  if (data === 'cat:cancel') {
    pendientes.delete(chatId);
    await send(chatId, '❌ Cancelado. No se registró nada.');
    return;
  }
  const p = pendientes.get(chatId);
  if (!p) {
    await send(chatId, 'No hay un comprobante pendiente. Envía una foto o usa `gasto <monto> <categoría>`.');
    return;
  }
  const u = await db.usuarioPorChat(chatId);
  if (!u) { pendientes.delete(chatId); return; }

  let categoria_id = null;
  let catNombre = 'Sin presupuesto (saldo total)';
  if (data !== 'cat:none') {
    const cats = await db.categorias(u.uid);
    const cat = cats.find(c => c.id === data.slice(4));
    if (cat) { categoria_id = cat.id; catNombre = cat.nombre; }
  }

  const { data: gasto, error } = await db.crearGasto({
    uid: u.uid, categoria_id, monto: p.monto, descripcion: p.descripcion,
    fecha: p.fecha, nro_operacion: p.nro_operacion, image_hash: p.image_hash,
    chatId, messageId: cb.message.message_id
  });
  pendientes.delete(chatId);
  if (error) {
    await send(chatId, 'Error al guardar el gasto: ' + error.message);
    return;
  }

  // Impacto en el presupuesto
  const { mes, anio } = hoy();
  let s = `✅ Gasto registrado: ${fmt(p.monto)} en ${catNombre}`;
  if (p.descripcion) s += `\nDetalle: ${p.descripcion}`;
  if (categoria_id) {
    const pres = await db.presupuestosMes(u.uid, mes, anio);
    const gastos = await db.gastosMes(u.uid, mes, anio);
    const montoPres = pres.find(x => x.categoria_id === categoria_id);
    const gastado = gastos.filter(g => g.categoria_id === categoria_id).reduce((a, g) => a + Number(g.monto), 0);
    if (montoPres) {
      const restante = Number(montoPres.monto) - gastado;
      if (restante < 0) s += `\n⚠️ ¡Presupuesto de ${catNombre} EXCEDIDO! Resta ${fmt(restante)} (negativo).`;
      else s += `\nRestante en ${catNombre}: ${fmt(restante)}`;
    } else {
      s += `\nNota: ${catNombre} no tiene presupuesto este mes. Usa /set para asignarle uno.`;
    }
  } else {
    s += `\n(Se descontó del saldo total sin presupuestar)`;
  }
  await send(chatId, s);
}

// ---------- Comandos ----------
async function cmdStart(chatId) {
  const u = await db.usuarioPorChat(chatId);
  if (!u) {
    await send(chatId,
      '👋 Calculadora de Sueldo — Bot de presupuestos\n\n' +
      'Este chat no está vinculado a ninguna cuenta.\n' +
      '1. Abre la página y usa "Vincular Telegram", o\n' +
      '2. Envía /vincular <codigo> si tienes un código.\n\n' +
      `(Tu chat_id es: ${chatId} — úsalo para vincular en local)`);
    return;
  }
  const ingreso = await db.ingresoMes(u.uid, hoy().mes, hoy().anio);
  let s = `👋 Hola${u.nombre ? ', ' + u.nombre : ''} (${u.email})\n\n`;
  if (ingreso != null) {
    s += await textoResumen(u.uid, { conAhorro: true });
    s += '\n';
  } else {
    s += `No tienes sueldo guardado de este mes. Guárdalo en la calculadora primero.\n\n`;
  }
  s += 'Comandos:\n/presupuestos — ver estado\n/ahorro — resumen de ahorro\n/set <categoría> <monto> — definir presupuesto\n/gasto <monto> <categoría> — gasto rápido\n/deshacer — borra tu último gasto\n/mes — estado del mes\n/vincular <codigo> — vincular otra cuenta\n/ayuda — ayuda';
  await send(chatId, s);
}

async function cmdSet(chatId, uid, args) {
  const m = args.match(/^(.+?)\s+([\d.,]+)$/);
  if (!m) {
    await send(chatId, 'Uso: /set <categoría> <monto>\nEj: /set servicios 300');
    return;
  }
  if (!await requiereMes(chatId, uid)) return;
  const cats = await db.categorias(uid);
  const cat = buscarCategoria(cats, m[1]);
  if (!cat) {
    await send(chatId, 'Categoría no encontrada. Disponibles: ' + cats.map(c => c.nombre).join(', '));
    return;
  }
  const monto = parseFloat(m[2].replace(',', '.'));
  const { mes, anio } = hoy();
  const { error } = await db.setPresupuesto(uid, cat.id, mes, anio, monto);
  if (error) { await send(chatId, 'Error: ' + error.message); return; }
  await send(chatId, `✅ Presupuesto de ${cat.nombre} para ${MESES[mes - 1]} ${anio}: ${fmt(monto)}`);
}

async function cmdGasto(chatId, uid, args) {
  const m = args.match(/^([\d.,]+)(?:\s+(.+))?$/);
  if (!m) {
    await send(chatId, 'Uso: /gasto <monto> [categoría]\nEj: /gasto 25 transporte');
    return;
  }
  if (!await requiereMes(chatId, uid)) return;
  const monto = parseFloat(m[1].replace(',', '.'));
  if (!(monto > 0)) { await send(chatId, 'Monto inválido.'); return; }
  const cats = await db.categorias(uid);
  const cat = m[2] ? buscarCategoria(cats, m[2]) : null;
  if (m[2] && !cat) {
    await send(chatId, 'Categoría no encontrada. Disponibles: ' + cats.map(c => c.nombre).join(', '));
    return;
  }
  const { data: gasto, error } = await db.crearGasto({
    uid, categoria_id: cat ? cat.id : null, monto,
    descripcion: null, fecha: new Date().toISOString().slice(0, 10),
    nro_operacion: null, image_hash: null, chatId, messageId: null
  });
  if (error) { await send(chatId, 'Error: ' + error.message); return; }
  const { mes, anio } = hoy();
  let s = `✅ Gasto registrado: ${fmt(monto)}${cat ? ' en ' + cat.nombre : ' (sin presupuesto)'}`;
  if (cat) {
    const pres = await db.presupuestosMes(uid, mes, anio);
    const gastos = await db.gastosMes(uid, mes, anio);
    const montoPres = pres.find(x => x.categoria_id === cat.id);
    const gastado = gastos.filter(g => g.categoria_id === cat.id).reduce((a, g) => a + Number(g.monto), 0);
    if (montoPres) {
      const restante = Number(montoPres.monto) - gastado;
      s += restante < 0 ? `\n⚠️ ¡Presupuesto de ${cat.nombre} EXCEDIDO! Resta ${fmt(restante)}.` : `\nRestante en ${cat.nombre}: ${fmt(restante)}`;
    }
  }
  await send(chatId, s);
}

async function cmdDeshacer(chatId, uid) {
  const last = await db.ultimoGasto(uid);
  if (!last) { await send(chatId, 'No hay gastos para deshacer.'); return; }
  const error = await db.borrarGasto(last.id);
  if (error) { await send(chatId, 'Error al borrar: ' + error.message); return; }
  await send(chatId, `↩️ Deshecho el último gasto (${fmt(last.monto)}${last.descripcion ? ' — ' + last.descripcion : ''}).`);
}

async function cmdVincular(chatId, codigo) {
  if (!codigo) {
    await send(chatId, 'Uso: /vincular <codigo>\nGenera tu código en la página (Vincular Telegram).');
    return;
  }
  const uid = await db.usuarioPorCodigo(codigo.trim().toUpperCase());
  if (!uid) { await send(chatId, '❌ Código inválido o expirado.'); return; }
  const error = await db.vincular(uid, chatId);
  if (error) { await send(chatId, 'Error al vincular: ' + error.message); return; }
  const u = await db.usuarioPorChat(chatId);
  await send(chatId, `✅ Cuenta vinculada: ${u.email}\nAhora puedes enviar fotos de Yape/comprobantes y usar los comandos.`);
}

// ---------- Bucle principal ----------
async function manejarMensaje(msg) {
  const chatId = msg.chat.id;
  if (msg.photo) { await flujoFoto(msg); return; }
  const texto = (msg.text || '').trim();
  if (!texto) return;

  const u = await db.usuarioPorChat(chatId);

  if (/^\/start\b/i.test(texto)) return cmdStart(chatId);
  if (/^\/ayuda\b/i.test(texto)) {
    await send(chatId, 'Comandos:\n/presupuestos — ver estado\n/ahorro — resumen de ahorro\n/set <categoría> <monto> — definir presupuesto\n/gasto <monto> [categoría] — gasto rápido\n/deshacer — borra tu último gasto\n/mes — estado del mes\n/vincular <codigo> — vincular cuenta\n\nO envía una foto de tu comprobante (Yape, banco) y el bot lee el monto y pregunta la categoría.');
    return;
  }
  if (/^\/presupuestos\b/i.test(texto)) {
    if (!u) return requiereUsuario(chatId);
    const s = await textoResumen(u.uid);
    await send(chatId, s || 'No tienes sueldo guardado este mes. Primero "Guardar este mes" en la calculadora.');
    return;
  }
  if (/^\/ahorro\b/i.test(texto)) {
    if (!u) return requiereUsuario(chatId);
    const s = await textoResumen(u.uid, { conAhorro: true });
    await send(chatId, s || 'No hay datos del mes.');
    return;
  }
  if (/^\/mes\b/i.test(texto)) {
    if (!u) return requiereUsuario(chatId);
    const ingreso = await db.ingresoMes(u.uid, hoy().mes, hoy().anio);
    await send(chatId, ingreso != null
      ? `📅 ${MESES[hoy().mes - 1]} ${hoy().anio}\nSueldo neto guardado: ${fmt(ingreso)}`
      : 'No tienes sueldo guardado este mes.');
    return;
  }
  if (/^\/set\b/i.test(texto)) {
    if (!u) return requiereUsuario(chatId);
    return cmdSet(chatId, u.uid, texto.replace(/^\/set\b\s*/i, ''));
  }
  if (/^\/gasto\b/i.test(texto)) {
    if (!u) return requiereUsuario(chatId);
    return cmdGasto(chatId, u.uid, texto.replace(/^\/gasto\b\s*/i, ''));
  }
  if (/^\/deshacer\b/i.test(texto)) {
    if (!u) return requiereUsuario(chatId);
    return cmdDeshacer(chatId, u.uid);
  }
  if (/^\/vincular\b/i.test(texto)) {
    return cmdVincular(chatId, texto.replace(/^\/vincular\b\s*/i, ''));
  }
  // Atajo de texto: "gasto 25 transporte"
  const mGasto = texto.match(/^gasto\s+([\d.,]+)(?:\s+(.+))?$/i);
  if (mGasto) {
    if (!u) return requiereUsuario(chatId);
    return cmdGasto(chatId, u.uid, mGasto[1] + (mGasto[2] ? ' ' + mGasto[2] : ''));
  }
}

async function manejarCallback(cb) {
  if (cb.data && cb.data.startsWith('cat:')) await confirmarCategoria(cb);
}

let offset = 0;
console.log('🤖 Bot de presupuestos iniciado (long-polling). Ctrl+C para salir.');
while (true) {
  try {
    const r = await api('getUpdates', { offset, timeout: 30 });
    for (const upd of r.result) {
      offset = upd.update_id + 1;
      if (upd.message) manejarMensaje(upd.message).catch(e => console.error('msg error', e));
      else if (upd.callback_query) manejarCallback(upd.callback_query).catch(e => console.error('cb error', e));
    }
  } catch (e) {
    console.error('poll error', e.message);
    await sleep(3000);
  }
}
