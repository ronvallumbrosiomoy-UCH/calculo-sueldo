# Calculadora de Sueldo Neto — Perú

Página web (estática) para calcular el **sueldo neto** en Perú y guardar el **historial mes a mes** con gráficas. Diseñada con la estética y los principios de interacción de **Apple (Human Interface Guidelines)**.

## Características

- **Cálculo en vivo**: el sueldo neto se actualiza mientras escribes (animación de conteo).
- **Sistema previsional**: ONP (13%) o AFP con desplegable (Integra, Prima, Profuturo, Habitat). Las tasas AFP son editables en el código.
- **Horas extra**: +25% (primeras 2 h) y +35% (desde la 3ª hora).
- **Bono nocturno**: +35% según turno (Día / Noche / Rotativo).
- **Renta de 5ª categoría**: tramos progresivos con UIT editable.
- **Historial**: guarda cada mes en tu navegador (localStorage).
- **Gráficas**: sueldo neto mes a mes y composición bruto/bono/descuentos (Chart.js).
- **Modo claro/oscuro** automático y manual.
- **Accesible**: respeta `prefers-reduced-motion` y el tamaño de texto del sistema.

## Cómo usarla

1. Abre `index.html` en tu navegador (doble clic). No necesita servidor ni internet excepto para las gráficas (Chart.js se carga desde CDN).
2. Ingresa tus datos (sueldo bruto, días, horas extra, turno, ONP/AFP, etc.).
3. Presiona **"Guardar este mes"** para registrar el mes y verlo en las gráficas.

## Cómo publicarla en GitHub Pages (gratis)

1. Crea un repositorio en [GitHub](https://github.com) (por ejemplo `calculo-sueldo`).
2. Sube este `index.html` (y opcionalmente el `README.md`) a la rama `main`:
   ```bash
   git init
   git add index.html README.md
   git commit -m "Calculadora de sueldo neto"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/calculo-sueldo.git
   git push -u origin main
   ```
3. Activa GitHub Pages: **Settings → Pages → Source: "Deploy from a branch" → Branch: `main` → Guardar**.
4. Tu sitio quedará en línea: `https://TU_USUARIO.github.io/calculo-sueldo/`

## Personalizar tasas

Las tasas AFP y la UIT cambian periódicamente. En `index.html` busca la constante:

```js
const tasasAFP = { Integra: 0.1275, Prima: 0.1280, Profuturo: 0.1280, Habitat: 0.1230 };
```

Ajusta los valores según tu boleta de pago. La UIT se edita en el campo de la página.

## Nota

Los valores son **referenciales**. Verifica siempre con tu boleta de pago y la normativa vigente de SUNAT/SBS/MTPE.