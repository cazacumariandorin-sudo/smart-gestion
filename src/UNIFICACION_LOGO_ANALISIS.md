# Unificación de identidad corporativa SIMANTEC — Análisis previo

> Documento de referencia generado el 2026-09-19.
> Captura el diagnóstico del estado actual, las discrepancias con el prompt original
> y los puntos abiertos a confirmar antes de ejecutar la unificación de marca.

---

## 1. Estado actual verificado

### 1.1 Favicon / PWA
- **`index.html`** (línea 5): favicon genérico de Base44
  `<link rel="icon" type="image/svg+xml" href="https://base44.com/logo_v2.svg" />`
- **`public/manifest.json`**: **NO existe** (404 al leerlo), aunque `index.html`
  ya lo referencia en la línea 7. La app hoy no tiene icono PWA ni `theme_color`.
  → La Fase 2 del prompt no es "editar" el manifest, sino **crearlo desde cero**.

### 1.2 Logo cliente (React)
- **`src/components/SimantecLogo.jsx`**: componente SVG del logo (marcador + wordmark).
  Paleta del gradiente: `#0A1F44` → `#1565D8`, módulos verdes `#34D399`/`#16A34A`,
  "S" cianúrea `#3D86FF`.
- **`src/lib/simantecLogoPdf.js`**: helper jsPDF que dibuja el logo sobre un doc PDF.
  Usado actualmente solo por `src/lib/exportarPedidoPdf.js` (pedidos).

### 1.3 PDFs cliente sin logo (pendientes)
| Archivo | Generador | Cabecera actual |
|---|---|---|
| `src/components/horario/InformesTab.jsx` | `jsPDF` (líneas 343-369) | `doc.text('Control Horario', 14, 18)` sin logo |
| `src/components/horario/ApuntesTab.jsx` | `jsPDF` (líneas 198-233) | `doc.text('Apuntes de Cantidades', 14, 18)` sin logo |
| `src/pages/presupuestos/BudgetSimulator.jsx` | `downloadPDF()` (líneas 144-162) | **Placeholder**: solo `console.log`, no genera PDF real |

### 1.4 PDFs backend con cabecera de texto (fuera del prompt actual)
| Función | Librería | Cabecera actual |
|---|---|---|
| `base44/functions/exportarCicloContabilidad/entry.ts` | jsPDF (Deno) | Banda naranja `#EA580C` + texto "SIMANTEC - Nota Mensual de Gastos" |
| `base44/functions/exportarNotasGastosPDF/entry.ts` | jsPDF (Deno) | Banda naranja `#EA580C` + texto "SIMANTEC - Notas de Gastos" |
| `base44/functions/procesarNominas/entry.ts` | pdf-lib (Deno) | Resumen GEFISCAL (sin logo gráfico) |

> Estas funciones corren en Deno y **no pueden importar** `simantecLogoPdf.js`
> (helper jsPDF cliente). Además `procesarNominas` usa `pdf-lib`, librería distinta.
> Unificar estos PDFs requiere reescribir sus 3 cabeceras server-side → trabajo aparte.

---

## 2. Paleta de marca conviviendo

| Origen | Color | Uso |
|---|---|---|
| **Primario UI** (`--primary: 237 95% 53%`) | `#1521F9` (índigo eléctrico) | Botones, acentos, barra PWA si se aplica |
| **Logo** (gradiente) | `#0A1F44` → `#1565D8` (azul) | Marca gráfica |
| **PDFs backend** | `#EA580C` (naranja = `--chart-1`) | Cabeceras de export contabilidad |

El prompt original manda usar el primario `#1521F9` como `theme_color` sin tocar la paleta.
**Riesgo visual**: en instalación PWA Android, la barra de estado saldría índigo `#1521F9`,
que no cuadra con el azul del logo.

---

## 3. Discrepancias con el prompt original

1. **`public/manifest.json`** — el prompt asume que existe y apunta a
   `base44.com/logo_v2.svg` con `theme_color: #1B4F72`. La realidad es que **no existe**:
   hay que crearlo desde cero.
2. **PDFs backend** — el prompt (Fase 1 = `grep jsPDF src/`) cubre solo el cliente.
   Las 3 funciones backend que generan PDF quedan fuera de alcance por diseño.
3. **`theme_color`** — el prompt defiende el primario `#1521F9`; visualmente el logo
   es azul `#1565D8`. Decisión pendiente.

---

## 4. Puntos abiertos a confirmar

### 4.1 Alcance
- [ ] **Opción A**: Ejecutar el prompt tal cual (solo cliente: favicon + manifest +
      InformesTab + ApuntesTab + BudgetSimulator) y dejar los 3 PDFs backend para
      un seguimiento aparte.
- [ ] **Opción B**: Ampliar el alcance para unificar también las 3 cabeceras de
      PDF backend (reescritura en Deno, jsPDF para 2 y pdf-lib para 1).

### 4.2 `theme_color`
- [ ] **Opción A**: `#1521F9` (primario UI, lo que dice el prompt).
- [ ] **Opción B**: `#1565D8` (azul del logo, más coherente visualmente con la marca).

---

## 5. Plan de ejecución propuesto (una vez confirmados los puntos)

1. **Auditoría**: `grep` de `base44.com/logo`, `<img>` de marca y `jsPDF` en `src/`;
   confirmar el hex del primario; listar archivos afectados.
2. **Favicon + manifest**: generar SVG/PNG del icono en `public/icons/`, crear
   `manifest.json`, actualizar `index.html`.
3. **PDFs cliente**: añadir `drawSimantecLogoPdf` a `InformesTab.jsx` y `ApuntesTab.jsx`;
   implementar PDF real en `BudgetSimulator.jsx` con logo desde el inicio.
4. **Verificación visual** en el preview.

---

## 6. Veredicto

El prompt está **bien estructurado, es de bajo riesgo y procede**. Es un refactor de
branding puramente visual sin tocar lógica de negocio. El enfoque de reutilizar
`simantecLogoPdf.js` como único punto de inserción de logo en PDFs cliente es correcto
y evita duplicar mantenimiento. Faltan únicamente las dos decisiones de la sección 4.