# Tracking: Evolución del módulo "Notas de Gastos"

## 📊 Comparativa de Versiones

### Versión 1 (ORIGINAL - NotasGastos.jsx) ✅ FUNCIONAL
**Flujo:** NotasGastos → CrearNotaGastos + ListaNotasGastos (componentes separados)

#### Características:
- ✅ OCR automático con LLM (extrae datos de tickets/facturas)
- ✅ Upload de archivos múltiples
- ✅ Validación completa del formulario
- ✅ Gestión de archivos integrada
- ✅ Estados de nota: pendiente, aprobado, rechazado
- ✅ Vista previa de archivos
- ✅ Descarga de documentos
- ✅ Botones claros: "Guardar nota", "Limpiar"

#### Estructura de datos (NotaGastos):
```json
{
  "titulo": "string",
  "fecha": "date",
  "concepto": "gasolina|parking|material|peaje|otro",
  "importe": "number",
  "cif": "string",
  "proveedor": "string",
  "direccion": "string",
  "codigo_postal": "string",
  "descripcion": "string",
  "notas": "string",
  "estado": "pendiente|aprobado|rechazado",
  "archivos": [
    {
      "nombre": "string",
      "url": "string",
      "tipo": "foto|documento",
      "fecha_subida": "datetime"
    }
  ]
}
```

---

### Versión 2 (ACTUAL - GastosOperarios.jsx) ❌ INCOMPLETA

**Flujo:** GastosOperarios → NotaGastosCard (componente monolítico)

#### Características Faltantes:
- ❌ Sin OCR (no extrae datos de tickets)
- ❌ Sin upload de archivos en creación
- ❌ Sin validación completa
- ❌ Sin gestión de archivos
- ❌ Sin botón "Guardar Nota"
- ❌ Formulario muy básico (solo 5 campos)

#### Estructura de datos (NotaGastos - INCORRECTA):
```json
{
  "operario_id": "string",
  "operario_name": "string",
  "titulo": "string",
  "fecha_inicio": "date",        // ⚠️ Campo adicional
  "fecha_cierre": "date",        // ⚠️ Campo adicional
  "notas": "string",
  "estado": "abierta|cerrada",   // ⚠️ Estados incorrectos
  "total": "number"              // ⚠️ Calculado, no en form
}
```

---

## 🐛 BUGS ENCONTRADOS

### Bug #1: Estructura de datos incompatible
**Descripción:** La versión actual usa campos que no coinciden con el schema de NotaGastos
- ❌ Usa `fecha_inicio` y `fecha_cierre` (deberían ser individuales)
- ❌ Estados `abierta|cerrada` en vez de `pendiente|aprobado|rechazado`
- ❌ Falta la mayoría de campos (concepto, importe, cif, proveedor, etc.)

**Solución:** Alinear con estructura original o crear nueva entidad GastoNota separada

### Bug #2: Sin formulario de creación funcional
**Descripción:** Dialog de creación muy básico, falta:
- No hay upload de archivos
- No hay OCR
- No hay botón "Guardar Nota"
- Solo permite crear "nota", no gastos individuales

**Solución:** Mantener structure del NotasGastos.jsx o extender GastosOperarios

### Bug #3: Confusión de responsabilidades
**Descripción:** 
- `GastosOperarios.jsx` maneja notas de gastos
- `NotasGastos.jsx` también maneja notas de gastos
- Dos rutas, dos flujos, diferentes estructuras de datos

**Solución:** Unificar en UN único módulo coherente

### Bug #4: Sin gestión de gastos individuales
**Descripción:** NotaGastosCard intenta mostrar gastos (GastoOperario), pero:
- La creación de nota NO crea gastos
- Los gastos se crean por separado en AddGastoDialog
- Flujo confuso para el usuario

**Solución:** Clarificar: ¿nota con múltiples gastos o gasto individual?

### Bug #5: Operario no se pre-carga correctamente
**Descripción:** En usuarios no-admin, el operario muestra "Seleccionar operario..." pero no se pre-carga
**Estado:** ✅ PARCIALMENTE ARREGLADO (falta testear)

---

## 📋 RECOMENDACIONES

### Opción A: Volver a Versión 1 (Recomendado)
- Usar `NotasGastos.jsx` como principal
- Mantener `CrearNotaGastos.jsx` + `ListaNotasGastos.jsx`
- Agregar tab o sección para gastos individuales
- Eliminar `GastosOperarios.jsx`

### Opción B: Refactorizar Versión 2
- Cambiar estructura de datos de NotaGastos a original
- Agregar OCR a GastosOperarios
- Agregar upload de archivos
- Separar claramente: Nota vs Gasto Individual

### Opción C: Sistema Dual (Versión 3)
- **NotasGastos.jsx**: Para notas con múltiples gastos (con OCR, archivos)
- **GastosOperarios.jsx**: Para seguimiento de gastos individuales (sin OCR)
- Completamente separados, diferentes estructuras

---

## 🔄 MAPA DE CAMBIOS REQUERIDOS

```
VERSIÓN 1 (Original)          VERSIÓN 2 (Actual)           SOLUCIÓN
├─ NotasGastos.jsx            ├─ GastosOperarios.jsx       ➜ Mantener V1 o
├─ CrearNotaGastos.jsx        └─ NotaGastosCard.jsx           refactorizar V2
├─ ListaNotasGastos.jsx          (+ AddGastoDialog)        
└─ (completa, funcional)       (incompleta, sin OCR)
```

---

## ✅ CHECKLIST DE ARREGLOS

- [ ] Decidir: ¿Versión 1 o refactorizar Versión 2?
- [ ] Alinear estructura de datos NotaGastos
- [ ] Implementar OCR en creación
- [ ] Agregar upload/gestión de archivos
- [ ] Clarificar flujo: Nota vs Gasto
- [ ] Unificar rutas: /notas-gastos o /gastos-operarios (no ambas)
- [ ] Testear en todos los roles (admin, operario, jefe_obra)
- [ ] Validar estados y campos requeridos