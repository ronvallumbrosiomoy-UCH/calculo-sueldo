# Calculadora de Sueldo Neto — Perú

Página web (estática, GitHub Pages) para calcular el **sueldo neto** en Perú con **login seguro y datos en la nube**. Diseñada con los principios de interacción de **Apple (Human Interface Guidelines)**.

## Características

- **Cálculo en vivo**: el sueldo neto se actualiza mientras escribes (animación de conteo).
- **Sistema previsional**: ONP (13%) o AFP con desplegable (Integra, Prima, Profuturo, Habitat). Tasas editables.
- **Horas extra**: +25% (primeras 2 h) y +35% (desde la 3ª hora).
- **Bono nocturno**: +35% según turno (Día / Noche / Rotativo).
- **Renta de 5ª categoría**: tramos progresivos con UIT editable.
- **Login seguro** (Firebase Auth) y **datos en la nube** (Firestore): no se borran al limpiar el navegador, solo tú accedes a los tuyos.
- **Modo demo**: sin Firebase, funciona igual con localStorage local.
- **Gráficas**: sueldo neto mes a mes y composición bruto/bono/descuentos (Chart.js).
- **Modo claro/oscuro** automático y manual.
- **Accesible**: respeta `prefers-reduced-motion` y el tamaño de texto del sistema.

## Estructura del proyecto

```
calculo-sueldo/
├── index.html          ← página completa (cálculos, login, gráficas)
├── firestore.rules     ← reglas de seguridad para Firestore (pegar en consola)
├── README.md           ← este archivo
└── .gitignore          ← opcional (ignora node_modules si usas Firebase CLI)
```

## Cómo usarla

1. Abre `index.html` en tu navegador. Si tienes Firebase configurado → login requerido. Sin configurar → modo demo local.
2. Ingresa tus datos (sueldo bruto, días, horas extra, turno, ONP/AFP, etc.).
3. Presiona **"Guardar este mes"** para registrar el mes y verlo en las gráficas.

## Configurar Firebase (para login y datos en la nube) — 3 minutos

1. Ve a [Firebase Console](https://console.firebase.google.com/) e **ingresa con tu cuenta de Google**.
2. Crea un proyecto nuevo (ej. `calculo-sueldo`).
3. En **Project settings → General → Tus apps → Web** (icono </>). Registra la app y copia el **objeto de configuración** (apiKey, authDomain, projectId, etc.).
4. En `index.html`, busca la línea:
   ```js
   const FIREBASE_CONFIG = null;
   ```
   Reemplázala con tu config, por ejemplo:
   ```js
   const FIREBASE_CONFIG = {
     apiKey: "TU_API_KEY",
     authDomain: "tu-proyecto.firebaseapp.com",
     projectId: "tu-proyecto",
     // ... (todos los campos que te dio Firebase)
   };
   ```
5. En la consola de Firebase, ve a **Firestore Database → Reglas** y pega el contenido de `firestore.rules`.
6. Sube `index.html` y `firestore.rules` a tu repo, haz push.
7. **Listo**. Al abrir la página te pedirá iniciar sesión o crear cuenta. Tus datos mensuales viven en la nube.

> **Nota de seguridad**: las claves de Firebase son públicas por diseño (el secreto están en las reglas de Firestore, no en el código). No expongas credenciales de servidor.

## Migración de datos locales → nube

Cuando inicies sesión por primera vez con Firebase, la app ofrece **importar** tus datos guardados en localStorage a Firestore (una sola vez). Después usas la nube.

## Publicar en GitHub Pages (gratis)

1. Crea un repositorio en [GitHub](https://github.com) (ej. `calculo-sueldo`).
2. Sube los archivos (`index.html`, `firestore.rules`, `README.md`):
   ```bash
   git init
   git add index.html firestore.rules README.md
   git commit -m "Calculadora de sueldo con Firebase"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/calculo-sueldo.git
   git push -u origin main
   ```
3. Activa GitHub Pages: **Settings → Pages → Source: "Deploy from a branch" → Branch: `main` → Guardar**.
4. Tu sitio: `https://TU_USUARIO.github.io/calculo-sueldo/`

## Personalizar tasas

Las tasas AFP y la UIT cambian periódicamente. En `index.html`:
```js
const tasasAFP = { Integra: 0.1275, Prima: 0.1280, Profuturo: 0.1280, Habitat: 0.1230 };
```
La UIT se edita en el campo de la página.

## Nota

Los valores son **referenciales**. Verifica siempre con tu boleta de pago y la normativa vigente de SUNAT/SBS/MTPE.