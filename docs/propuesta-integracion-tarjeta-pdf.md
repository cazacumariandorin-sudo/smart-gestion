# Propuesta de implementación: patrón de tarjeta y vista previa de PDF

## Resumen

Esta propuesta recoge dos mejoras técnicas y de UX para el módulo de gastos y justificantes:

1. Añadir aprendizaje de patrones para tarjetas (`PatronTarjeta`) con extracción solo de los últimos 4 dígitos visibles.
2. Mejorar la vista previa de justificantes PDF en la galería de `Fotos Contabilidad` mediante renderizado cliente con PDF.js.

---

## A. Patrón de tarjeta

### 1. Alcance funcional

La estrategia recomendada es capturar únicamente los últimos 4 dígitos visibles en el documento o en el ticket, porque es el dato sensible que suele aparecer enmascarado en las facturas y tickets de tarjeta.

Ejemplo:

- Se guarda: `4417`
- No se guarda: `**** **** **** 4417`
- No se debe intentar guardar el número completo aunque aparezca visible en la imagen

Esto reduce riesgo y cumple mejor con la política de minimización de datos.

### 2. Modelo sugerido: `PatronTarjeta`

```jsonc
{
  "name": "PatronTarjeta",
  "type": "object",
  "properties": {
    "tarjeta_ultimos_digitos": {
      "type": "string",
      "description": "Últimos 4 dígitos visibles del medio de pago. Ejemplo: '4417'"
    },
    "titular_tipo": {
      "type": "string",
      "enum": ["empresa", "tecnico"],
      "description": "Tipo de titular del medio de pago"
    },
    "operario_id": {
      "type": "string",
      "description": "ID del operario si el titular es técnico"
    },
    "operario_email": {
      "type": "string",
      "description": "Email del usuario asociado para filtros y RLS"
    },
    "veces_visto": {
      "type": "integer",
      "default": 1,
      "description": "Número de veces que se ha detectado este patrón"
    },
    "veces_confirmado": {
      "type": "integer",
      "default": 0,
      "description": "Veces confirmadas por un usuario autorizado"
    },
    "veces_corregido": {
      "type": "integer",
      "default": 0,
      "description": "Veces que se ha reorientado el patrón"
    },
    "confianza": {
      "type": "number",
      "default": 0,
      "description": "Confianza 0-1 del patrón"
    },
    "ultima_vez_visto": {
      "type": "string",
      "format": "date-time",
      "description": "Última vez que se detectó este patrón"
    },
    "confirmado": {
      "type": "boolean",
      "default": false,
      "description": "Si el patrón ha sido validado por gerencia/admin"
    },
    "confirmado_por": {
      "type": "string",
      "description": "Email del usuario que confirmó el patrón"
    },
    "fecha_confirmacion": {
      "type": "string",
      "format": "date-time",
      "description": "Fecha de confirmación del patrón"
    },
    "activo": {
      "type": "boolean",
      "default": true,
      "description": "Si sigue siendo válido"
    }
  },
  "required": [
    "tarjeta_ultimos_digitos",
    "titular_tipo"
  ],
  "rls": {
    "create": {
      "$or": [
        { "user_condition": { "role": "admin" } },
        { "user_condition": { "role": "gerencia" } },
        { "user_condition": { "role": "administracion" } }
      ]
    },
    "read": {
      "$or": [
        { "user_condition": { "role": "admin" } },
        { "user_condition": { "role": "gerencia" } },
        { "user_condition": { "role": "administracion" } },
        { "user_condition": { "role": "director_comercial" } }
      ]
    },
    "update": {
      "$or": [
        { "user_condition": { "role": "admin" } },
        { "user_condition": { "role": "gerencia" } },
        { "user_condition": { "role": "administracion" } }
      ]
    },
    "delete": {
      "$or": [
        { "user_condition": { "role": "admin" } },
        { "user_condition": { "role": "gerencia" } }
      ]
    }
  }
}
```

### 3. OCR

En el esquema OCR del gasto, se recomienda añadir este campo:

```javascript
card_digits: {
  type: 'string',
  pattern: '^\\d{4}$',
  description: 'Últimos 4 dígitos visibles de la tarjeta si aparecen en el documento'
}
```

Y actualizar el prompt para pedir explícitamente:

> Si el documento muestra una tarjeta (normalmente enmascarada con ****), extrae los últimos 4 dígitos visibles. Nunca intentes extraer el número completo, aunque aparezca visible. Si no se ven dígitos, devuelve vacío.

### 4. Aprendizaje

La lógica recomendada es:

- Si `tarjeta_ultimos_digitos` es válido, buscar un patrón previo con exactamente ese valor.
- Si existe:
  - incrementar `veces_visto`
  - si el dato de titular/tipo coincide, incrementar `veces_confirmado`
  - en caso contrario, incrementar `veces_corregido`
  - recalcular `confianza`
  - actualizar `ultima_vez_visto`
- Si no existe:
  - crear el patrón con `veces_visto=1`, `confirmado=false`, `confianza=0.5` o inicial más conservador

### 5. Propuesta automática en el formulario

Cuando el sistema detecte un patrón confirmado:

- mostrar sugerencia de `titular_tipo` o de `origen_pago`
- dejarla editable antes de guardar
- no auto-guardar automáticamente sin consentimiento del usuario

### 6. Panel de gestión

Se recomienda un panel en la sección de contabilidad para:

- ver patrón por últimos 4 dígitos
- estado confirmado / pendiente / rechazado
- número de observaciones
- acción de confirmar o archivar

---

## B. Vista previa de PDF en `Fotos Contabilidad`

### 1. Observación actual

El componente `FotoGastoCard.jsx` ya detecta PDF y abre la URL en nueva pestaña, pero no ofrece una miniatura real del primer folio.

La lógica actual es:

- si es imagen: mostrar la imagen
- si es PDF: mostrar un icono 📄
- si es otro tipo: mostrar un icono genérico de recibo

### 2. Recomendación técnica

Se recomienda utilizar `pdfjs-dist` en cliente para generar una vista previa de la primera página del PDF, sin ampliar el backend ni el flujo de subida.

#### Instalación

```bash
npm install pdfjs-dist
```

#### Componente sugerido: `PdfThumbnail.jsx`

```jsx
import { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function PdfThumbnail({ url, width = 200, height = 250 }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const pdf = await pdfjsLib.getDocument(url).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1 });
        const scale = Math.min(width / viewport.width, height / viewport.height);
        const scaledViewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        const context = canvas.getContext('2d');
        await page.render({
          canvasContext: context,
          viewport: scaledViewport,
        }).promise;

        if (mounted) setImageSrc(canvas.toDataURL('image/png'));
      } catch (err) {
        console.error('Error renderizando PDF:', err);
        if (mounted) setError(true);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [url, width, height]);

  if (loading) return <div className="bg-muted animate-pulse" style={{ width, height }} />;
  if (error) return <div className="bg-red-100 text-red-600 text-xs p-2 text-center">Error PDF</div>;

  return (
    <img
      src={imageSrc}
      alt="Vista previa PDF"
      className="w-full h-full object-cover"
      loading="lazy"
    />
  );
}
```

### 3. Integración propuesta en `FotoGastoCard.jsx`

```jsx
import PdfThumbnail from '@/components/ui/PdfThumbnail';

{esPdf(foto.archivo) ? (
  <PdfThumbnail url={foto.archivo.url} width={200} height={250} />
) : esImagen(foto.archivo) ? (
  <img ... />
) : (
  <div className="flex items-center justify-center h-full">
    <Receipt className="w-8 h-8 text-muted-foreground" />
  </div>
)}
```

### 4. Mejora de UX

Recomendado también:

- renombrar `Fotos Contabilidad` por `Justificantes Contabilidad`
- mantener el botón de abrir archivo en una nueva pestaña y la miniatura de primera página al mismo tiempo
- si el PDF está corrupto o no renderiza, mantener el fallback al icono 📄

---

## Prioridad recomendada

### Alta prioridad

- añadir campo `tarjeta_ultimos_digitos` al OCR
- definir `PatronTarjeta`
- proteger RLS y permisos
- renderizar preview de PDF en la galería

### Media prioridad

- panel de gestión de patrones de tarjeta
- renombrar la vista `Fotos Contabilidad`

### Baja prioridad

- automatismos complejos de aprendizaje en tiempo real
- acciones de auditoría adicionales en campos sensibles

---

## Conclusión

La propuesta combina dos mejoras coherentes y de bajo riesgo:

1. un aprendizaje controlado y seguro para tarjetas basado en los últimos 4 dígitos, y
2. una mejora visible de UX para justificar gastos y documentos sin introducir complejidad en el backend.

El enfoque recomendado es prudente, mínimo en datos sensibles y compatible con el flujo actual del proyecto.

---

## Nota de implementación

La idea principal es no guardar más datos de una tarjeta que los estrictamente necesarios y mantener el sistema siempre controlado por permisos de administración y gerencia para este tipo de información.

