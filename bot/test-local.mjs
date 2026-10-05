// Prueba local de la capa de datos contra Supabase local (sin Telegram)
import 'dotenv/config';
import * as db from './db.js';
import { resumen, textoResumen, buscarCategoria, fmt } from './resumen.js';

const UID = '11111111-1111-1111-1111-111111111111';
const { mes, anio } = { mes: new Date().getMonth() + 1, anio: new Date().getFullYear() };

console.log('== 1. Categorías ==');
const cats = await db.categorias(UID);
console.log(cats.map(c => c.nombre).join(', '));

console.log('\n== 2. Ingreso del mes (de la calculadora) ==');
const ingreso = await db.ingresoMes(UID, mes, anio);
console.log(ingreso != null ? fmt(ingreso) : 'SIN SUELDO GUARDADO (bloquearía presupuestos)');

console.log('\n== 3. Definir presupuestos de prueba ==');
const serv = cats.find(c => c.nombre === 'Servicios');
const trans = cats.find(c => c.nombre === 'Transporte');
const comida = cats.find(c => c.nombre === 'Comida');
for (const [c, m] of [[serv, 300], [trans, 200], [comida, 400]]) {
  const { error } = await db.setPresupuesto(UID, c.id, mes, anio, m);
  console.log(`${c.nombre}: ${fmt(m)} ${error ? 'ERROR ' + error.message : 'OK'}`);
}

console.log('\n== 4. Gastos de prueba ==');
const g1 = await db.crearGasto({ uid: UID, categoria_id: serv.id, monto: 95, descripcion: 'Luz', fecha: new Date().toISOString().slice(0, 10), nro_operacion: null, image_hash: 'hash-prueba-1', chatId: 123456789, messageId: 1 });
console.log('Luz S/ 95:', g1.error ? 'ERROR ' + g1.error.message : 'OK');
const g2 = await db.crearGasto({ uid: UID, categoria_id: trans.id, monto: 250, descripcion: 'Combustible', fecha: new Date().toISOString().slice(0, 10), nro_operacion: null, image_hash: 'hash-prueba-2', chatId: 123456789, messageId: 2 });
console.log('Combustible S/ 250 (debe EXCEDER Transporte 200):', g2.error ? 'ERROR ' + g2.error.message : 'OK');
const g3 = await db.crearGasto({ uid: UID, categoria_id: null, monto: 30, descripcion: 'Snack', fecha: new Date().toISOString().slice(0, 10), nro_operacion: null, image_hash: 'hash-prueba-3', chatId: 123456789, messageId: 3 });
console.log('Snack S/ 30 (sin categoría):', g3.error ? 'ERROR ' + g3.error.message : 'OK');

console.log('\n== 5. Anti-duplicados ==');
console.log('hash-prueba-1 existe?', await db.imageHashExists(UID, 'hash-prueba-1'));
console.log('hash-inexistente existe?', await db.imageHashExists(UID, 'hash-inexistente'));

console.log('\n== 6. Resumen completo ==');
const r = await resumen(UID);
console.log('ingreso:', r.ingreso, '| presupuestado:', r.presupuestado, '| saldo:', r.saldo, '| gastos:', r.totalGastos);
console.log(await textoResumen(UID, { conAhorro: true }));

console.log('== 7. Buscar categoría ==');
console.log('servicios ->', buscarCategoria(cats, 'servicios')?.nombre);
console.log('Luz (no existe) ->', buscarCategoria(cats, 'luz')?.nombre ?? 'null (correcto)');
console.log('vivienda ->', buscarCategoria(cats, 'vivienda')?.nombre);
