import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';
/* ============ SUPABASE ============ */
const _qp = new URLSearchParams(location.search);
const supabaseUrl = _qp.get('sburl') || 'https://qnxudmepbmxdqgrivnhr.supabase.co';
const supabaseAnon = _qp.get('sbkey') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFueHVkbWVwYm14ZHFncml2bmhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MTAyMjAsImV4cCI6MjEwNTQ4NjIyMH0.9r1bhAFvkHN3efZk2I3tJmBWfekKjV0XeqorcvChDDY';
const sb = createClient(supabaseUrl, supabaseAnon);

/* ============ ESTADO ============ */
const tasasAFP = { Integra: 0.1275, Prima: 0.1280, Profuturo: 0.1280, Habitat: 0.1230 };
const TASA_ONP = 0.13;
let turno = "NOCHE";
let hist = [];
let guestMode = false;
let chartNeto = null, chartComp = null;

/* ============ CÁLCULO ============ */
function calcular() {
  const bruto = num("bruto");
  const dias = clamp(num("dias"), 1, 30);
  const hextra25 = num("hextra25");
  const hextra35 = num("hextra35");
  const jornada = clamp(num("jornada"), 1, 12);
  const sistema = val("sistema");
  const afp = val("afp");
  const diasNoche = clamp(num("diasNoche"), 0, 30);
  const diasDescanso = clamp(num("diasDescanso"), 0, 30);
  const uit = num("uit");
  const rDias = bruto * (dias / 30);
  const vHora = (bruto / 30) / jornada;
  const p25 = hextra25 * vHora * 1.25;
  const p35 = hextra35 * vHora * 1.35;
  const hextra = hextra25 + hextra35;
  const bonoNoches = turno === "DIA" ? 0 : (turno === "NOCHE" ? dias : diasNoche);
  const rBono = (bruto / 30) * 0.35 * bonoNoches;
  const rDescanso = diasDescanso * (bruto / 30);
  const rBruta = rDias + p25 + p35 + rBono + rDescanso;
  const tasa = sistema === "ONP" ? TASA_ONP : (tasasAFP[afp] ?? 0.125);
  const rDesc = rBruta * tasa;
  const rRenta = rentaMensual(rBruta, uit);
  return { bruto, dias, hextra, hextra25, hextra35, jornada, sistema, afp, turno, diasNoche,
    diasDescanso, rDias, vHora, p25, p35, rBono, rDescanso, rBruta, rDesc, rRenta,
    neto: rBruta - rDesc - rRenta };
}
function rentaMensual(bruta, uit) {
  const exonerado = 7 * uit;
  const base = Math.max(0, bruta * 12 - exonerado);
  const anual = Math.max(0,
    base * 0.08 - Math.max(0, base - 5*uit)*0.06 - Math.max(0, base-20*uit)*0.03
    - Math.max(0, base-35*uit)*0.03 - Math.max(0, base-45*uit)*0.10);
  return anual / 12;
}
const fmt = n => "S/ " + n.toLocaleString("es-PE", {minimumFractionDigits:2, maximumFractionDigits:2});
const num = id => { const v=parseFloat(document.getElementById(id).value); return isNaN(v)?0:v; };
const val = id => document.getElementById(id).value;
const clamp = (v,a,b) => Math.min(b, Math.max(a, v));
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

/* ============ ANIMACIÓN DE NÚMEROS ============ */
let animId = null;
function animateValue(el, target) {
  const start = parseFloat((el.dataset.v||"0").replace(/[^0-9.-]/g,""))||0;
  el.dataset.v = target; cancelAnimationFrame(animId);
  const t0=performance.now(), dur=350;
  function step(t){ const p=Math.min(1,(t-t0)/dur); const e=1-Math.pow(1-p,3);
    el.textContent=fmt(start+(target-start)*e); if(p<1) animId=requestAnimationFrame(step); }
  animId=requestAnimationFrame(step);
}

/* ============ RENDER EN VIVO ============ */
function render() {
  const c = calcular();
  animateValue(document.getElementById("netoVal"), c.neto);
  setText("rDias", fmt(c.rDias));
  setText("rExtras25", fmt(c.p25));
  setText("rExtras35", fmt(c.p35));
  setText("rBono", fmt(c.rBono));
  setText("rDescanso", fmt(c.rDescanso));
  setText("rBruta", fmt(c.rBruta));
  setText("rDesc", fmt(c.rDesc));
  setText("rRenta", fmt(c.rRenta));
  return c;
}
function setText(id,t) { document.getElementById(id).textContent = t; }

/* ============ INPUTS ============ */
document.querySelectorAll("input, select").forEach(el=>{ el.addEventListener("input",render); el.addEventListener("change",render); });
document.querySelectorAll("#turnoChips .chip").forEach(chip=>{
  chip.addEventListener("click", ()=>{
    document.querySelectorAll("#turnoChips .chip").forEach(c=>c.classList.remove("selected"));
    chip.classList.add("selected"); turno=chip.dataset.turno; render();
  });
});
document.getElementById("sistema").addEventListener("change", e=>{
  document.getElementById("afpField").style.opacity = e.target.value==="AFP"?"1":"0.4";
});

/* ============ GUARDAR / BORRAR ============ */
async function guardarMes() {
  if (guestMode) { toast("Modo invitado: inicia sesión con GitHub para guardar"); return; }
  const c = render();
  const now = new Date();
  const anio = now.getFullYear(), mes = now.getMonth()+1;
  const clave = `${anio}-${String(mes).padStart(2,"0")}`;
  const { data: existing } = await sb.from("sueldos").select("id").eq("mes", mes).eq("anio", anio).single();
  if (existing) { toast("Este mes ya está guardado."); return; }
  const { data: profile } = await sb.from("perfiles").select("id").single();
  if (!profile) { toast("Sesión inválida. Vuelve a iniciar."); return; }
  const { error } = await sb.from("sueldos").insert({
    usuario_id: profile.id, mes, anio,
    sueldo_bruto: c.bruto, dias_trabajados: c.dias, horas_extra: c.hextra,
    horas_extra_25: c.hextra25, horas_extra_35: c.hextra35,
    tipo_turno: c.turno, dias_noche: c.diasNoche, tasa_bono: 35,
    dias_descanso: c.diasDescanso, recargo_descanso: c.rDescanso,
    sistema_prev: c.sistema, afp: c.afp, bono_nocturno: c.rBono,
    remuneracion_bruta: c.rBruta, descuento_prev: c.rDesc,
    renta_5ta: c.rRenta, sueldo_neto: c.neto
  });
  if (error) { if (error.code === "23505") { toast("Este mes ya está guardado."); return; } toast("Error al guardar: "+error.message); return; }
  await cargarHistorial();
  toast("Mes guardado ✓");
}
document.getElementById("saveBtn").addEventListener("click", guardarMes);
document.getElementById("exportBtn").addEventListener("click", ()=>exportarPDF(calcular()));

/* ============ EXPORTAR PDF ============ */
async function exportarPDF(c) {
  const details = document.getElementById("pdfDetails");
  if (!details) { toast("PDF no disponible"); return; }
  const fecha = new Date().toLocaleDateString("es-PE");
  details.innerHTML = `
    <table style="width:100%; border-collapse:collapse; margin-top:12px; font-size:0.9rem;">
      <tr style="background:#f5f5f7;"><th style="text-align:left; padding:8px; border-bottom:1px solid #ddd;">Concepto</th><th style="text-align:right; padding:8px; border-bottom:1px solid #ddd;">Monto (S/)</th></tr>
      <tr><td style="padding:6px 8px;">Sueldo bruto mensual</td><td style="text-align:right; padding:6px 8px;">${fmt(c.bruto)}</td></tr>
      <tr style="background:#fafafa;"><td style="padding:6px 8px;">Días trabajados</td><td style="text-align:right; padding:6px 8px;">${c.dias}</td></tr>
      <tr><td style="padding:6px 8px;">Horas extra al 25%</td><td style="text-align:right; padding:6px 8px;">${c.hextra25}h</td></tr>
      <tr style="background:#fafafa;"><td style="padding:6px 8px;">Horas extra al 35%</td><td style="text-align:right; padding:6px 8px;">${c.hextra35}h</td></tr>
      <tr><td style="padding:6px 8px;">Turno</td><td style="text-align:right; padding:6px 8px;">${c.turno}</td></tr>
      <tr style="background:#fafafa;"><td style="padding:6px 8px;">Sistema previsional</td><td style="text-align:right; padding:6px 8px;">${c.sistema}</td></tr>
      <tr><td style="padding:6px 8px;">Bono nocturno</td><td style="text-align:right; padding:6px 8px;">${fmt(c.rBono)}</td></tr>
      <tr style="background:#fafafa;"><td style="padding:6px 8px;">Días de descanso trabajados</td><td style="text-align:right; padding:6px 8px;">${c.diasDescanso}</td></tr>
      <tr><td style="padding:6px 8px;">Recargo por descanso (100%)</td><td style="text-align:right; padding:6px 8px;">${fmt(c.rDescanso)}</td></tr>
      <tr style="background:#fafafa;"><td style="padding:6px 8px;">Remuneración bruta</td><td style="text-align:right; padding:6px 8px;">${fmt(c.rBruta)}</td></tr>
      <tr><td style="padding:6px 8px;">Descuento ONP/AFP</td><td style="text-align:right; padding:6px 8px;">${fmt(c.rDesc)}</td></tr>
      <tr style="background:#fafafa;"><td style="padding:6px 8px;">Renta 5ta categoría</td><td style="text-align:right; padding:6px 8px;">${fmt(c.rRenta)}</td></tr>
      <tr style="background:#e8f0fe; font-weight:700;"><td style="padding:10px 8px; border-top:2px solid #0a84ff;">SUELDO NETO</td><td style="text-align:right; padding:10px 8px; border-top:2px solid #0a84ff; color:#0a84ff;">${fmt(c.neto)}</td></tr>
    </table>
    <p style="color:#6e6e73; font-size:0.75rem; margin-top:16px;">Generado el ${fecha} · Calculadora de Sueldo Neto — Perú</p>`;
  const opt = {
    margin: 10, filename: `sueldo_${c.anio||new Date().getFullYear()}_${String(c.mes||new Date().getMonth()+1).padStart(2,"0")}.pdf`,
    image: { type: "jpeg", quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
  };
  try {
    toast("Generando PDF...");
    await html2pdf().set(opt).from(document.getElementById("pdfContent")).save();
    toast("PDF descargado ✓");
  } catch(e) { toast("Error al generar PDF: "+e.message); }
}

async function borrarMes(id) {
  const { error } = await sb.from("sueldos").delete().eq("id", id);
  if (error) { toast("Error al borrar"); return; }
  await cargarHistorial();
  toast("Mes eliminado");
}

/* ============ CARGAR HISTORIAL ============ */
async function cargarHistorial() {
  const wrap = document.getElementById("tableWrap");
  const { data, error } = await sb.from("sueldos").select("*").order("anio", {ascending:true}).order("mes", {ascending:true});
  if (error || !data) { wrap.innerHTML='<div class="empty">Sin datos guardados.</div>'; drawCharts(); return; }
  hist = data;
  const meses=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  let html=`<table class="table"><thead><tr><th>Mes</th><th>Bruto</th><th>Bono</th><th>HE 25%</th><th>HE 35%</th><th>Descuento</th><th>Neto</th><th></th></tr></thead><tbody>`;
  [...data].reverse().forEach(h=>{
    html+=`<tr><td><strong>${meses[h.mes-1]||""} ${esc(h.anio)}</strong></td><td>${fmt(h.sueldo_bruto)}</td><td>${fmt(h.bono_nocturno)}</td><td>${(h.horas_extra_25 ?? 0)}h</td><td>${(h.horas_extra_35 ?? 0)}h</td><td>${fmt(h.descuento_prev+h.renta_5ta)}</td><td><strong>${fmt(h.sueldo_neto)}</strong></td><td><button class="del" data-id="${esc(h.id)}">Borrar</button></td></tr>`;
  });
  html+="</tbody></table>";
  wrap.innerHTML=html;
  wrap.querySelectorAll(".del").forEach(b=>b.addEventListener("click",()=>borrarMes(b.dataset.id)));
  drawCharts();
}

/* ============ GRÁFICAS ============ */
const meses=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
function chartColors(){ const d=document.body.dataset.theme==="dark"; return {text:d?"#a1a1a6":"#6e6e73", grid:d?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.06)"}; }
function drawCharts(){
  const cc=chartColors();
  const labels=hist.map(h=>`${meses[h.mes-1]} ${h.anio}`);
  const netos=hist.map(h=>h.sueldo_neto); const brutos=hist.map(h=>h.sueldo_bruto);
  const desc=hist.map(h=>h.descuento_prev+h.renta_5ta); const bonos=hist.map(h=>h.bono_nocturno);
  const common={labels, responsive:true, maintainAspectRatio:false};
  if(chartNeto) chartNeto.destroy(); if(chartComp) chartComp.destroy();
  chartNeto=new Chart(document.getElementById("chartNeto"),{type:"line",data:{labels,datasets:[{label:"Sueldo neto",data:netos,borderColor:"#0a84ff",backgroundColor:"rgba(10,132,255,0.12)",fill:true,tension:0.4,pointBackgroundColor:"#0a84ff",borderWidth:3}]},options:{...common,animation:{duration:500},plugins:{legend:{display:false}},scales:{y:{ticks:{color:cc.text},grid:{color:cc.grid}},x:{ticks:{color:cc.text}}}}});
  chartComp=new Chart(document.getElementById("chartComp"),{type:"bar",data:{labels,datasets:[{label:"Bruto",data:brutos,backgroundColor:"#0a84ff",borderRadius:6},{label:"Bono nocturno",data:bonos,backgroundColor:"#5e5ce6",borderRadius:6},{label:"Descuentos",data:desc,backgroundColor:"#ff453a",borderRadius:6}]},options:{...common,animation:{duration:500},plugins:{legend:{labels:{color:cc.text,usePointStyle:true}}},scales:{y:{stacked:false,ticks:{color:cc.text},grid:{color:cc.grid}},x:{stacked:false,ticks:{color:cc.text}}}}});
}

/* ============ AUTH ============ */
async function checkSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) { guestMode = false; showApp(session.user); await cargarHistorial(); }
  else { showLogin(); }
}
async function showApp(user) {
  document.getElementById("loginScreen").style.display="none";
  document.getElementById("appSection").style.display="block";
  document.getElementById("userArea").style.display="flex";
  if (guestMode) {
    document.getElementById("userBadge").textContent = "Invitado";
    document.getElementById("logoutBtn").textContent = "Salir";
    document.getElementById("histSub").textContent = "Modo invitado: los datos no se guardan.";
  } else {
    const meta = user?.user_metadata || {};
    document.getElementById("userBadge").textContent = meta.name || meta.user_name || user?.email || "Usuario";
    document.getElementById("logoutBtn").textContent = "Cerrar sesión";
    document.getElementById("histSub").textContent = "Los datos se guardan en tu base de datos personal.";
  }
  render();
}
function showLogin() {
  document.getElementById("loginScreen").style.display="flex";
  document.getElementById("appSection").style.display="none";
  document.getElementById("userArea").style.display="none";
}
const btn = document.getElementById("btnGitHubLogin");
if (btn) btn.addEventListener("click", async ()=>{
  if (!sb) { toast("Sesión inválida. Recarga."); return; }
  try {
    toast("Redirigiendo a GitHub...");
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await sb.auth.signInWithOAuth({ provider:"github", options:{ redirectTo } });
    if (error) toast("Error: "+error.message);
  } catch(e) {
    toast("Error: "+e.message);
  }
});
// Modo invitado: probar la página sin cuenta ni historial
const btnGuest = document.getElementById("btnGuest");
if (btnGuest) btnGuest.addEventListener("click", ()=>{
  guestMode = true;
  hist = [];
  showApp(null);
  document.getElementById("tableWrap").innerHTML =
    '<div class="empty">Modo invitado: la calculadora funciona al instante.<br>Tus cálculos no se guardan. Inicia sesión con GitHub para guardar tu historial mes a mes.</div>';
  drawCharts();
  toast("Modo invitado activo");
});

// Login de desarrollo: solo visible en modo local (?sburl=...)
if (_qp.get("sburl")) {
  document.getElementById("devLogin").style.display = "block";
  document.getElementById("btnDevLogin").addEventListener("click", async () => {
    const { error } = await sb.auth.signInWithPassword({
      email: document.getElementById("devEmail").value,
      password: document.getElementById("devPass").value
    });
    if (error) { toast("Error: " + error.message); return; }
    const { data: { session } } = await sb.auth.getSession();
    if (session) { guestMode = false; showApp(session.user); await cargarHistorial(); }
  });
}

// Cerrar sesión / salir del modo invitado
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) logoutBtn.addEventListener("click", async ()=>{
  if (guestMode) { guestMode = false; hist = []; showLogin(); toast("Sesión de invitado cerrada"); return; }
  const { error } = await sb.auth.signOut();
  guestMode = false; hist = [];
  showLogin();
  toast(error ? "Error al cerrar sesión" : "Sesión cerrada ✓");
});
// Detectar si viene del login OAuth
if (sb) sb.auth.getSession().then(({ data: { session } })=>{ if (session) { guestMode = false; showApp(session.user); cargarHistorial(); } });

/* ============ TOAST ============ */
let toastTimer=null;
function toast(msg){ const t=document.getElementById("toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove("show"),2200); }

/* ============ TEMA ============ */
const themeBtn=document.getElementById("themeBtn");
function applyTheme(t){ document.body.dataset.theme=t; themeBtn.textContent=t==="dark"?"☀":"☾"; if(chartNeto||chartComp) drawCharts(); }
themeBtn.addEventListener("click",()=>{ const n=document.body.dataset.theme==="dark"?"light":"dark"; localStorage.setItem("sueldoTheme",n); applyTheme(n); });
(function(){ const s=localStorage.getItem("sueldoTheme"); const sys=window.matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light"; applyTheme(s||sys); })();

/* ============ INIT ============ */
if (sb && document.getElementById("refreshBtn")) document.getElementById("refreshBtn").addEventListener("click", ()=>{ if (guestMode) { toast("Modo invitado: no hay datos que recargar"); return; } cargarHistorial(); });
if (sb) checkSession();