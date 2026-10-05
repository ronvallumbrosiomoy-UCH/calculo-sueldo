import * as db from './db.js';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export const fmt = n => 'S/ ' + Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const hoy = () => { const d = new Date(); return { mes: d.getMonth() + 1, anio: d.getFullYear() }; };

export function barra(part, todo) {
  if (!todo || todo <= 0) return '▱▱▱▱▱';
  const n = Math.round(Math.min(1, part / todo) * 5);
  return '▰'.repeat(n) + '▱'.repeat(5 - n);
}

export async function resumen(uid) {
  const { mes, anio } = hoy();
  const ingreso = await db.ingresoMes(uid, mes, anio);
  const cats = await db.categorias(uid);
  const pres = await db.presupuestosMes(uid, mes, anio);
  const gastos = await db.gastosMes(uid, mes, anio);
  const gastadoPorCat = {};
  for (const g of gastos) {
    const k = g.categoria_id || 'none';
    gastadoPorCat[k] = (gastadoPorCat[k] || 0) + Number(g.monto);
  }
  const totalGastos = gastos.reduce((a, g) => a + Number(g.monto), 0);
  const presupuestado = pres.reduce((a, p) => a + Number(p.monto), 0);
  const saldo = ingreso != null ? Number(ingreso) - presupuestado : null;
  return { mes, anio, ingreso, cats, pres, gastos, gastadoPorCat, totalGastos, presupuestado, saldo };
}

export async function textoResumen(uid, { conAhorro = false } = {}) {
  const r = await resumen(uid);
  if (r.ingreso == null) return null;
  let s = `📅 ${MESES[r.mes - 1]} ${r.anio}\n`;
  s += `Ingreso (sueldo neto): ${fmt(r.ingreso)}\n`;
  s += `Presupuestado: ${fmt(r.presupuestado)}\n`;
  s += `Saldo total (sin presupuestar): ${fmt(r.saldo)}\n`;
  s += `Gastos del mes: ${fmt(r.totalGastos)}\n\n`;
  s += 'Presupuestos:\n';
  const mapPres = new Map(r.pres.map(p => [p.categoria_id, Number(p.monto)]));
  for (const c of r.cats) {
    const monto = mapPres.get(c.id);
    const gastado = r.gastadoPorCat[c.id] || 0;
    if (monto == null && gastado === 0) continue;
    const restante = (monto ?? 0) - gastado;
    const warn = restante < 0 ? '  ⚠️ EXCEDIDO' : '';
    s += `${barra(gastado, monto ?? 0)} ${c.nombre}: ${monto != null ? fmt(monto) : 'sin monto'} | gastado ${fmt(gastado)} | restante ${fmt(restante)}${warn}\n`;
  }
  const gastadoNone = r.gastadoPorCat['none'] || 0;
  if (gastadoNone > 0) s += `▱▱▱▱▱ Sin presupuesto (del saldo): ${fmt(gastadoNone)}\n`;
  if (conAhorro) {
    const ahorro = Number(r.ingreso) - r.totalGastos;
    s += `\n💰 Lo que queda para ahorrar: ${fmt(ahorro)}\n`;
  }
  return s;
}

export function buscarCategoria(cats, consulta) {
  const q = norm(consulta);
  if (!q) return null;
  return cats.find(c => norm(c.nombre) === q)
      || cats.find(c => norm(c.nombre).includes(q))
      || cats.find(c => q.includes(norm(c.nombre)) && norm(c.nombre).length > 3)
      || null;
}
