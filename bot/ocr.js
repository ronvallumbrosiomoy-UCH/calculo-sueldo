import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const PROMPT = `Eres un extractor de datos de comprobantes de pago peruanos (Yape, Plin, transferencias bancarias, pagos de servicios).
Extrae únicamente un JSON con estos campos:
- monto: número en soles (sin símbolos ni texto)
- fecha: formato YYYY-MM-DD (si no aparece, usa la fecha actual)
- descripcion: nombre del comercio, persona o servicio (máximo 40 caracteres)
- nro_operacion: número de operación si aparece, si no, null
Si no puedes leer un monto con confianza, responde exactamente: {"error":"sin monto"}
Responde solo con el JSON, sin explicaciones ni bloques de código.`;

function extraerJSON(texto) {
  const m = texto.match(/\{[\s\S]*\}/);
  if (!m) return { error: 'sin json' };
  try { return JSON.parse(m[0]); } catch { return { error: 'json invalido' }; }
}

export async function leerComprobante(base64, mimeType = 'image/jpeg') {
  const model = genAI.getGenerativeModel({ model: MODEL });
  const res = await model.generateContent([
    { inlineData: { data: base64, mimeType } },
    { text: PROMPT }
  ]);
  return extraerJSON(res.response.text());
}
