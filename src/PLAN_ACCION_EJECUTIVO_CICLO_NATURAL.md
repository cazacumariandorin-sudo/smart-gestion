# 🚀 PLAN DE ACCIÓN EJECUTIVO: Implementación Ciclo Natural + Mejora Módulo Económico

**Proyecto:** Smart Gestión  
**Objetivo:** Transición ciclo 26→25 a 1→31 (Mes Natural) + Mejoras de Calidad de Gastos  
**Periodo:** Semana 1 (11-17 sept 2026) | Fase 1 = A+B  
**Estado:** Listo para Inicio Inmediato  
**Aprobado:** Decisiones 1, 2, 3 confirmadas  

---

## 📋 DECISIONES CONFIRMADAS

✅ **Decisión 1:** Septiembre 2026 aún está **ABIERTO** (no cerrado)  
✅ **Decisión 2:** Fase 1 = A+B solamente (ciclo natural + alertas) | Fase 2 = C  
✅ **Decisión 3:** Feature Flag 3 días + Rollback 24/7 (híbrido)  

---

## 🎯 ALCANCE FASE 1: A+B (Ciclo Natural + Alertas)

### A. Ciclo Natural (1→31)
- Cambiar lógica de cálculo de ciclo (de 26→25 a 1→último día del mes)
- Actualizar función `calcularCiclo()` en BannerCicloActivo.jsx
- Eliminar distorsión de mes siguiente en adelantos

### B. Alertas Pre-Cierre
- Cambiar dias de alerta (22,23,24 → 27,28,29)
- Actualizar mensajes de aviso
- Ajustar cron de avisos

**NO incluimos en Fase 1:**
- ❌ Renombramiento de entidades (NotaMensualGasto → NotaMensualLiquidacion)
- ❌ Cambios de esquema Base44
- ❌ Exportación canónica para auditoría

---

## 📊 ESTIMACIÓN DE TRABAJO

| Tarea | Duración | Owner |
|-------|----------|-------|
| Dev: Implementación código | 4-5h | Dev Lead |
| Testing: Unit + Integration | 2-3h | QA |
| Staging: Validación E2E | 1-2h | QA + Gerencia |
| Deployment: Prod + Monitoreo | 2-3h | DevOps |
| **TOTAL** | **10-13h** | Team |

**Capacidad realista:** 1 dev full-time = completable en 2 días

---

## 🔧 ARQUITECTURA TÉCNICA: Feature Flag + Rollback

### Fase 1A: Feature Flag (Días 11-14)

```
Semana 1:
  ├─ Lunes 11 sept:   Deploy a staging
  ├─ Martes 12 sept:  Gerencia valida en staging
  ├─ Miércoles 13 sept: Deploy a prod CON FLAG OFF (default: false)
  └─ Jueves 14 sept:  Activar FLAG = true (si validación OK)
```

**Feature Flag `USE_NATURAL_CICLO_LOGIC`:**

```javascript
// src/lib/config.js
export const FEATURE_FLAGS = {
  USE_NATURAL_CICLO_LOGIC: process.env.REACT_APP_USE_NATURAL_CICLO === 'true',
  // default: false (compatibilidad con lógica antigua)
};

// En componentes
if (FEATURE_FLAGS.USE_NATURAL_CICLO_LOGIC) {
  // Nueva lógica (1→31)
  cicloMes = calcularCicloNatural(fecha);
} else {
  // Lógica antigua (26→25) - fallback automático
  cicloMes = calcularCicloActual(fecha);
}
```

**Variables de entorno:**

```bash
# .env.staging
REACT_APP_USE_NATURAL_CICLO=true

# .env.production (inicialmente)
REACT_APP_USE_NATURAL_CICLO=false

# Después de 3 días (si OK):
REACT_APP_USE_NATURAL_CICLO=true
```

**Rollback inmediato:** Si algo falla en prod, basta con:
```bash
# Volver a false en .env.production
REACT_APP_USE_NATURAL_CICLO=false

# Redeploy (5 minutos)
npm run deploy:prod
```

---

### Fase 1B: Rollback + Monitoreo 24/7 (Días 14-17)

Una vez FLAG = true, activamos monitoreo exhaustivo:

#### Telemetría en Tiempo Real

```javascript
// src/lib/telemetry.js
export const logCicloAsignado = (registro, ciclo) => {
  const evento = {
    timestamp: new Date().toISOString(),
    evento: 'ciclo_asignado',
    registro_id: registro.id,
    ciclo_calculado: ciclo,
    flag_enabled: FEATURE_FLAGS.USE_NATURAL_CICLO_LOGIC,
    fecha_documento: registro.fecha_documento,
    fecha_sistema: new Date().toISOString(),
  };
  
  // Enviar a CloudLogging / Sentry / ELK
  console.log('[TELEMETRY]', evento);
  sendToMonitoringService(evento);
};
```

#### Dashboard de Monitoreo

```sql
-- Query: Registros creados por ciclo (últimas 24h)
SELECT 
  ciclo_mes,
  COUNT(*) as registros_nuevos,
  DATE(MAX(created_date)) as último_registro,
  MAX(created_date) as timestamp_máximo
FROM RegistroGasto
WHERE created_date > now() - INTERVAL '24 hours'
GROUP BY ciclo_mes
ORDER BY ciclo_mes DESC;

-- Resultado esperado:
-- 2026-09 | 23 | 2026-09-14 | 2026-09-14 14:23:15
-- 2026-08 | 0  | (null)    | (null)
-- (Históricos no deben cambiar)
```

#### Alertas Automáticas (Sentry / PagerDuty)

```yaml
alerts:
  - name: "Ciclo null detectado"
    condition: "RegistroGasto.ciclo_mes IS NULL"
    action: "Rollback inmediato"
    severity: "critical"
  
  - name: "Discrepancia ciclo"
    condition: "ciclo_mes != calcularCicloNatural(fecha_documento)"
    action: "Notificar dev + log"
    severity: "high"
  
  - name: "Históricos alterados"
    condition: "RegistroGasto.ciclo_mes MODIFICADO where fecha_documento < 2026-09-01"
    action: "Rollback automático"
    severity: "critical"
```

#### Equipo de Guardia (24/7)

```
Viernes 14 sept:   Dev Lead (14:00 - 22:00)
Viernes 14 sept:   DevOps (22:00 - 06:00)
Sábado 15 sept:    Dev Lead (06:00 - 14:00)
Sábado 15 sept:    DevOps (14:00 - 22:00)
Domingo 16 sept:   Dev Lead (06:00 - 18:00)
Lunes 17 sept:     Dev Lead (09:00 - 17:00) - Fin de guardia
```

**Escalación:**
- Si alerta CRITICAL → Llamar a Dev Lead en 5 minutos
- Si no responde → Ejecutar rollback automático (script)
- Notificar a Gerencia en Slack

---

## 📝 ARCHIVO DETALLADO DE CAMBIOS

### 1. Frontend: Cambios Localizados

#### Archivo 1: `src/components/gastos/BannerCicloActivo.jsx`

**Líneas a cambiar:** ~40-60 (función `calcularCiclo`)

**Antes:**
```javascript
export function calcularCiclo(fecha) {
  const dia = fecha.getDate();
  const mes = fecha.getMonth() + 1;
  const año = fecha.getFullYear();
  
  // Lógica antigua: 26 → 25
  if (dia >= 26) {
    // Si es día 26 o más, pertenece al ciclo del mes siguiente
    return {
      cicloMes: `${año}-${String(mes + 1).padStart(2, '0')}`,
      apertura: `${día 26} del mes actual`,
      cierre: `${día 25} del mes siguiente`,
    };
  } else {
    return {
      cicloMes: `${año}-${String(mes).padStart(2, '0')}`,
      apertura: `${día 26} del mes anterior`,
      cierre: `${día 25} del mes actual`,
    };
  }
}
```

**Después:**
```javascript
export function calcularCiclo(fecha) {
  const dia = fecha.getDate();
  const mes = fecha.getMonth() + 1;
  const año = fecha.getFullYear();
  
  // Nueva lógica: ciclo natural (1 → 31)
  // Siempre usa el mes calendar natural
  return {
    cicloMes: `${año}-${String(mes).padStart(2, '0')}`,
    apertura: `01 de ${getNombreMes(mes)}`,
    cierre: `${getÚltimoDíaMes(año, mes)} de ${getNombreMes(mes)}`,
    diasRestantes: Math.max(0, getÚltimoDíaMes(año, mes) - dia),
    esÚltimoDía: dia === getÚltimoDíaMes(año, mes),
    esPrimerDía: dia === 1,
  };
}

function getÚltimoDíaMes(año, mes) {
  return new Date(Date.UTC(año, mes, 0)).getUTCDate();
}

function getNombreMes(mes) {
  const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 
                 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 
                 'Noviembre', 'Diciembre'];
  return meses[mes];
}
```

**Feature Flag:**
```javascript
import { FEATURE_FLAGS } from '@/lib/config';

export function calcularCiclo(fecha) {
  if (FEATURE_FLAGS.USE_NATURAL_CICLO_LOGIC) {
    return calcularCicloNatural(fecha);
  } else {
    return calcularCicloActual(fecha);  // Fallback a lógica antigua
  }
}

function calcularCicloNatural(fecha) {
  // ... nueva lógica arriba
}

function calcularCicloActual(fecha) {
  // ... lógica antigua (copiada de la versión actual)
}
```

**Componente cambios:**
```jsx
// En el JSX del banner
const ciclo = calcularCiclo(new Date());
const diasRestantes = ciclo.diasRestantes;

// Avisos condicionales
if (diasRestantes <= 3 && diasRestantes > 0) {
  return <AdvertenciaÚltimosOíasMes dias={diasRestantes} />;
} else if (ciclo.esPrimerDía) {
  return <ComunicaciónNuevoCiclo mes={ciclo.apertura} />;
}
```

**Tests a agregar:**
```javascript
describe('calcularCiclo (feature flag enabled)', () => {
  beforeEach(() => {
    FEATURE_FLAGS.USE_NATURAL_CICLO_LOGIC = true;
  });

  test('01 sept → ciclo 2026-09', () => {
    const fecha = new Date(2026, 8, 1); // sept 1
    const ciclo = calcularCiclo(fecha);
    expect(ciclo.cicloMes).toBe('2026-09');
    expect(ciclo.diasRestantes).toBe(29);
  });

  test('15 sept → ciclo 2026-09', () => {
    const fecha = new Date(2026, 8, 15);
    const ciclo = calcularCiclo(fecha);
    expect(ciclo.cicloMes).toBe('2026-09');
    expect(ciclo.diasRestantes).toBe(15);
  });

  test('30 sept → ciclo 2026-09, últimoía', () => {
    const fecha = new Date(2026, 8, 30);
    const ciclo = calcularCiclo(fecha);
    expect(ciclo.cicloMes).toBe('2026-09');
    expect(ciclo.diasRestantes).toBe(0);
    expect(ciclo.esÚltimoDía).toBe(true);
  });

  test('01 oct → ciclo 2026-10', () => {
    const fecha = new Date(2026, 9, 1); // oct 1
    const ciclo = calcularCiclo(fecha);
    expect(ciclo.cicloMes).toBe('2026-10');
  });
});
```

---

#### Archivo 2: `src/lib/adelantosConciliacion.js`

**Líneas a cambiar:** ~20-40 (función `calcularCicloMesAdelanto`)

**Antes:**
```javascript
export function calcularCicloMesAdelanto(fechaEntrega) {
  const dia = fechaEntrega.getDate();
  const mes = fechaEntrega.getMonth() + 1;
  const año = fechaEntrega.getFullYear();
  
  // Lógica antigua: si >= 26, pasa al mes siguiente
  if (dia >= 26) {
    return `${año}-${String(mes + 1).padStart(2, '0')}`;
  } else {
    return `${año}-${String(mes).padStart(2, '0')}`;
  }
}
```

**Después:**
```javascript
import { FEATURE_FLAGS } from '@/lib/config';

export function calcularCicloMesAdelanto(fechaEntrega) {
  if (FEATURE_FLAGS.USE_NATURAL_CICLO_LOGIC) {
    // Nueva lógica: siempre el mes natural
    const mes = fechaEntrega.getMonth() + 1;
    const año = fechaEntrega.getFullYear();
    return `${año}-${String(mes).padStart(2, '0')}`;
  } else {
    // Fallback a lógica antigua
    const dia = fechaEntrega.getDate();
    const mes = fechaEntrega.getMonth() + 1;
    const año = fechaEntrega.getFullYear();
    if (dia >= 26) {
      return `${año}-${String(mes + 1).padStart(2, '0')}`;
    } else {
      return `${año}-${String(mes).padStart(2, '0')}`;
    }
  }
}
```

**Tests:**
```javascript
describe('calcularCicloMesAdelanto (feature flag enabled)', () => {
  beforeEach(() => {
    FEATURE_FLAGS.USE_NATURAL_CICLO_LOGIC = true;
  });

  test('Adelanto 26 sept → ciclo 2026-09 (no adelanta a octubre)', () => {
    const fecha = new Date(2026, 8, 26);
    const ciclo = calcularCicloMesAdelanto(fecha);
    expect(ciclo).toBe('2026-09');
  });

  test('Adelanto 15 sept → ciclo 2026-09', () => {
    const fecha = new Date(2026, 8, 15);
    const ciclo = calcularCicloMesAdelanto(fecha);
    expect(ciclo).toBe('2026-09');
  });

  test('Adelanto 01 oct → ciclo 2026-10', () => {
    const fecha = new Date(2026, 9, 1);
    const ciclo = calcularCicloMesAdelanto(fecha);
    expect(ciclo).toBe('2026-10');
  });
});
```

---

#### Archivo 3: `src/components/gastos/InformeGastos.jsx`

**Líneas a cambiar:** ~100-150 (filtros de período)

**Antes:**
```javascript
// Filtrar por rango 26 mes ant → 25 mes actual
const registrosFiltrados = registros.filter(r => {
  if (!r.fecha_documento) return false;
  const fecha = new Date(r.fecha_documento);
  const dia = fecha.getDate();
  const mes = fecha.getMonth() + 1;
  const año = fecha.getFullYear();
  
  if (periodo === 'ciclo' && filtroCiclo) {
    const [cicloAño, cicloMes] = filtroCiclo.split('-');
    // Lógica antigua: si <= 25, pertenece a ese ciclo
    // si >= 26, pertenece al ciclo siguiente
    const cMesAct = parseInt(cicloMes);
    const cMesAnt = cMesAct === 1 ? 12 : cMesAct - 1;
    const cicloDia26 = new Date(cicloAño, cMesAnt - 1, 26);
    const cicloDia25Sig = new Date(cicloAño, cMesAct, 25);
    
    return fecha >= cicloDia26 && fecha <= cicloDia25Sig;
  }
  return true;
});
```

**Después:**
```javascript
import { FEATURE_FLAGS } from '@/lib/config';

const registrosFiltrados = registros.filter(r => {
  if (!r.fecha_documento) return false;
  const fecha = new Date(r.fecha_documento);
  
  if (periodo === 'ciclo' && filtroCiclo) {
    const [cicloAño, cicloMes] = filtroCiclo.split('-');
    
    if (FEATURE_FLAGS.USE_NATURAL_CICLO_LOGIC) {
      // Nueva lógica: ciclo = mes natural (1-31)
      const cMes = parseInt(cicloMes);
      const cAño = parseInt(cicloAño);
      const primerDía = new Date(Date.UTC(cAño, cMes - 1, 1));
      const últimoDía = new Date(Date.UTC(cAño, cMes, 0));
      
      return fecha >= primerDía && fecha <= últimoDía;
    } else {
      // Fallback: lógica antigua (26→25)
      const cMesAct = parseInt(cicloMes);
      const cMesAnt = cMesAct === 1 ? 12 : cMesAct - 1;
      const cicloDia26 = new Date(cicloAño, cMesAnt - 1, 26);
      const cicloDia25Sig = new Date(cicloAño, cMesAct, 25);
      
      return fecha >= cicloDia26 && fecha <= cicloDia25Sig;
    }
  }
  return true;
});
```

---

### 2. Backend: Cambios en Funciones Cloud

#### Función 1: `base44/functions/cerrarCicloGastosMensual/entry.ts`

**Líneas a cambiar:** ~50-100

**Antes:**
```typescript
export default async function cerrarCicloGastosMensual(req) {
  const { ciclo_mes, operario_id } = await req.json();
  const sr = base44.asServiceRole;
  
  // Cálculo antiguo: fin de período = día 25
  const [año, mes] = ciclo_mes.split('-');
  const finPeriodo = `${año}-${mes}-25`;
  
  // Contar registros hasta el día 25
  const registros = await sr.entities.RegistroGasto.filter({
    ciclo_mes: ciclo_mes,
    fecha_documento: { $lte: finPeriodo },
    estado: { $in: ['aprobado_gerencia', 'en_administracion', 'pagada'] }
  });
  
  // Generar nota mensual
  const notaMensual = await sr.entities.NotaMensualGasto.create({
    ciclo_mes,
    operario_id,
    registros_ids: registros.map(r => r.id),
    total_importe: registros.reduce((sum, r) => sum + r.importe, 0),
    // ...
  });
  
  return { ok: true, notaMensual };
}
```

**Después:**
```typescript
import { FEATURE_FLAGS } from '@/config'; // Inyectar flag

export default async function cerrarCicloGastosMensual(req) {
  const { ciclo_mes, operario_id } = await req.json();
  const sr = base44.asServiceRole;
  
  let finPeriodo;
  
  if (process.env.USE_NATURAL_CICLO_LOGIC === 'true') {
    // Nueva lógica: fin de período = último día del mes
    const [año, mes] = ciclo_mes.split('-');
    const mesInt = parseInt(mes);
    const últimoDía = new Date(Date.UTC(parseInt(año), mesInt, 0)).getUTCDate();
    finPeriodo = `${año}-${mes}-${String(últimoDía).padStart(2, '0')}`;
    
    console.log(`[CICLO NATURAL] Cierre ${ciclo_mes} = ${finPeriodo}`);
  } else {
    // Fallback: lógica antigua
    const [año, mes] = ciclo_mes.split('-');
    finPeriodo = `${año}-${mes}-25`;
    
    console.log(`[CICLO ANTIGUO] Cierre ${ciclo_mes} = ${finPeriodo}`);
  }
  
  // Contar registros hasta finPeriodo
  const registros = await sr.entities.RegistroGasto.filter({
    ciclo_mes: ciclo_mes,
    fecha_documento: { $lte: finPeriodo },
    estado: { $in: ['aprobado_gerencia', 'en_administracion', 'pagada'] }
  });
  
  // Log de auditoría
  const evento = {
    timestamp: new Date().toISOString(),
    evento: 'ciclo_cerrado',
    ciclo_mes,
    operario_id,
    registros_contados: registros.length,
    fin_periodo: finPeriodo,
    flag_enabled: process.env.USE_NATURAL_CICLO_LOGIC === 'true',
  };
  console.log('[AUDIT]', JSON.stringify(evento));
  
  // Generar nota mensual
  const notaMensual = await sr.entities.NotaMensualGasto.create({
    ciclo_mes,
    operario_id,
    registros_ids: registros.map(r => r.id),
    total_registros: registros.length,
    total_importe: registros.reduce((sum, r) => sum + (r.importe || 0), 0),
    fecha_cierre: finPeriodo,
    // ...
  });
  
  return { ok: true, notaMensual, registros_procesados: registros.length };
}
```

---

#### Función 2: `base44/functions/avisoPreCierreGastos/entry.ts`

**Líneas a cambiar:** ~30-60

**Antes:**
```typescript
// Cron cada día a las 09:00 UTC
export default async function avisoPreCierreGastos(req) {
  const sr = base44.asServiceRole;
  const hoy = new Date();
  const día = hoy.getDate();
  
  // Alertar los días 22, 23, 24
  if (![22, 23, 24].includes(día)) {
    return { skipped: 'no es día de alerta' };
  }
  
  const notificación = `
    ⚠️ AVISO PRE-CIERRE DE CICLO
    Faltan ${25 - día} días para el cierre del ciclo.
    Asegurate de que todos tus gastos están justificados.
  `;
  
  // Enviar a gerencia y técnicos
  await notificarGerencia(notificación);
  
  return { ok: true, notificación };
}
```

**Después:**
```typescript
export default async function avisoPreCierreGastos(req) {
  const sr = base44.asServiceRole;
  const hoy = new Date();
  const día = hoy.getDate();
  
  let debeAlertarHoy = false;
  let diasRestantes = 0;
  let últimoDíaMes = 0;
  
  if (process.env.USE_NATURAL_CICLO_LOGIC === 'true') {
    // Nueva lógica: alertar los últimos 3 días del mes (27, 28, 29, 30, 31)
    const mesInt = hoy.getMonth() + 1;
    const añoInt = hoy.getFullYear();
    últimoDíaMes = new Date(Date.UTC(añoInt, mesInt, 0)).getUTCDate();
    
    // Alertar si faltan 3 días o menos para fin de mes
    diasRestantes = Math.max(0, últimoDíaMes - día);
    debeAlertarHoy = diasRestantes <= 3 && diasRestantes > 0;
    
    console.log(`[CICLO NATURAL] Día ${día}/${mesInt}, últimoía: ${últimoDíaMes}, diasRestantes: ${diasRestantes}`);
  } else {
    // Fallback: lógica antigua
    if (![22, 23, 24].includes(día)) {
      return { skipped: 'no es día de alerta (lógica antigua)' };
    }
    debeAlertarHoy = true;
    últimoDíaMes = 25;
    diasRestantes = Math.max(0, 25 - día);
  }
  
  if (!debeAlertarHoy) {
    return { skipped: `no es día de alerta (diasRestantes: ${diasRestantes})` };
  }
  
  const notificación = `
    ⚠️ AVISO PRE-CIERRE DE CICLO
    🗓️ Ciclo actual: ${hoy.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
    📅 Cierre: ${hoy.toLocaleString('es-ES', { month: 'long', day: 'numeric', year: 'numeric' })}
    ⏰ Faltan ${diasRestantes} día${diasRestantes !== 1 ? 's' : ''} para el cierre del ciclo.
    
    ✅ Asegúrate de que todos tus gastos estén:
      - Subidos con foto/documento
      - Justificados con número de factura/albarán
      - Aprobados por Gerencia
    
    📞 Contacta a Gerencia si hay dudas.
  `;
  
  const evento = {
    timestamp: new Date().toISOString(),
    evento: 'aviso_pre_cierre',
    día_actual: día,
    último_día_mes: últimoDíaMes,
    días_restantes: diasRestantes,
    flag_enabled: process.env.USE_NATURAL_CICLO_LOGIC === 'true',
  };
  console.log('[AUDIT]', JSON.stringify(evento));
  
  // Enviar a gerencia y técnicos
  await notificarGerencia(notificación);
  await notificarTécnicos(notificación);
  
  return { ok: true, notificación, diasRestantes };
}
```

---

#### Función 3: `base44/functions/migrarGastosACiclo/entry.ts`

**Líneas a cambiar:** ~80-120 (función auxiliar de soporte)

**Antes:**
```typescript
function calcularCicloMesDesdeDoc(fechaDocumento) {
  const día = fechaDocumento.getDate();
  const mes = fechaDocumento.getMonth() + 1;
  const año = fechaDocumento.getFullYear();
  
  // Lógica antigua: si >= 26, pasa al mes siguiente
  if (día >= 26) {
    return `${año}-${String(mes + 1).padStart(2, '0')}`;
  } else {
    return `${año}-${String(mes).padStart(2, '0')}`;
  }
}
```

**Después:**
```typescript
function calcularCicloMesDesdeDoc(fechaDocumento) {
  const día = fechaDocumento.getDate();
  const mes = fechaDocumento.getMonth() + 1;
  const año = fechaDocumento.getFullYear();
  
  if (process.env.USE_NATURAL_CICLO_LOGIC === 'true') {
    // Nueva lógica: siempre el mes natural
    return `${año}-${String(mes).padStart(2, '0')}`;
  } else {
    // Fallback: lógica antigua
    if (día >= 26) {
      return `${año}-${String(mes + 1).padStart(2, '0')}`;
    } else {
      return `${año}-${String(mes).padStart(2, '0')}`;
    }
  }
}
```

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

### Fase Preparación (Hoy, 11 sept)

- [ ] Crear rama `feat/ciclo-natural` desde `main`
- [ ] Crear archivo de config: `src/lib/config.js` con feature flags
- [ ] Crear archivo `.env.example` con nuevas variables
- [ ] Crear rama `feature-flag-ciclo-natural` en BD (si aplica)
- [ ] Comunicar a Gerencia: "Cambio planificado para el 13 sept"
- [ ] Backup completo de BD (24h antes del cambio)

### Fase Desarrollo (11-13 sept)

- [ ] Dev implementa cambios en BannerCicloActivo.jsx
  - [ ] Código listo
  - [ ] Tests unitarios: 100% cobertura
  - [ ] PR creado, listo para review

- [ ] Dev implementa cambios en adelantosConciliacion.js
  - [ ] Código listo
  - [ ] Tests unitarios
  - [ ] PR creado

- [ ] Dev implementa cambios en InformeGastos.jsx
  - [ ] Código listo
  - [ ] Tests unitarios
  - [ ] PR creado

- [ ] Dev implementa cambios en funciones backend
  - [ ] cerrarCicloGastosMensual/entry.ts
    - [ ] Código listo
    - [ ] Tests unitarios
    - [ ] Rollback script creado
    - [ ] PR creado

  - [ ] avisoPreCierreGastos/entry.ts
    - [ ] Código listo
    - [ ] Tests
    - [ ] PR creado

  - [ ] migrarGastosACiclo/entry.ts
    - [ ] Código listo
    - [ ] PR creado

- [ ] Code Review
  - [ ] Lead aprueba todos los cambios
  - [ ] Merge a rama `staging`

### Fase Testing Staging (12-13 sept)

- [ ] Deploy a staging: `npm run deploy:staging`
  - [ ] Build completo sin errores
  - [ ] Linting pass 100%

- [ ] QA: Tests E2E en staging
  - [ ] [ ] Test 1: Técnico crea gasto día 1 sept → ciclo 2026-09
  - [ ] [ ] Test 2: Técnico crea gasto día 15 sept → ciclo 2026-09
  - [ ] [ ] Test 3: Técnico crea gasto día 30 sept → ciclo 2026-09
  - [ ] [ ] Test 4: Técnico crea gasto día 1 oct → ciclo 2026-10
  - [ ] [ ] Test 5: Adelanto entregado día 26 sept → ciclo 2026-09 (no adelanta a oct)
  - [ ] [ ] Test 6: Banner de ciclo muestra "1-30 sept" correctamente
  - [ ] [ ] Test 7: Avisos pre-cierre activados días 27, 28, 29
  - [ ] [ ] Test 8: Históricos (agosto) intactos

- [ ] Gerencia: Validación funcional en staging
  - [ ] Lee banner ciclo (debe decir "1-30 sept")
  - [ ] Crea un gasto de prueba
  - [ ] Verifica que aparece en ciclo correcto
  - [ ] Simula cierre de ciclo
  - [ ] Confirma que nota mensual tiene los registros correctos

- [ ] Regresión: Verificar nada más roto
  - [ ] Pedidos funciona
  - [ ] Nóminas funciona
  - [ ] Adelantos funciona
  - [ ] Dashboard funciona

### Fase Deployment Prod (13 sept, tarde)

- [ ] Actualizar `.env.production`
  - [ ] `REACT_APP_USE_NATURAL_CICLO=false` (default, fallback)
  - [ ] Commit a rama `main`

- [ ] Deploy a producción
  - [ ] `npm run deploy:prod`
  - [ ] Verificar build sin errores
  - [ ] Verificar feature flag desactivado (false)

- [ ] Smoke tests en prod (10 minutos)
  - [ ] [ ] Acceder a `/notas-gastos`
  - [ ] [ ] Ver banner ciclo (aún muestra lógica antigua, es normal)
  - [ ] [ ] Crear gasto de prueba
  - [ ] [ ] Verificar en BD que ciclo_mes es con lógica antigua

- [ ] Notificar a Gerencia: "Deploy OK, feature flag OFF, ready para activar mañana"

### Fase Activación Feature Flag (14 sept, mañana)

- [ ] Actualizar `.env.production`
  - [ ] `REACT_APP_USE_NATURAL_CICLO=true` ← **ACTIVAR**

- [ ] Redeploy a producción
  - [ ] `npm run deploy:prod`

- [ ] Verificar activación (5 minutos post-deploy)
  - [ ] Banner ciclo muestra "1-30 sept" ✓
  - [ ] Crear gasto de prueba, verificar ciclo_mes con nueva lógica

- [ ] **INICIAR GUARDIA 24/7**
  - [ ] Dev Lead + DevOps en standby
  - [ ] Dashboard de monitoreo activo
  - [ ] Alertas automáticas habilitadas

- [ ] Comunicar a Gerencia: "Ciclo natural ACTIVADO, monitoreo en curso"

### Fase Monitoreo 24/7 (14-17 sept)

**Viernes 14 sept, 14:00-22:00: Dev Lead**
- [ ] Monitorear cada hora:
  ```sql
  SELECT COUNT(*), COUNT(DISTINCT ciclo_mes) FROM RegistroGasto
  WHERE created_date > now() - INTERVAL '1 hour';
  ```
- [ ] Verificar no hay ciclos NULL
- [ ] Alertas automáticas deshabilitadas

**Viernes 14 sept, 22:00 - Sábado 15 sept, 06:00: DevOps**
- [ ] Turnos de guardia
- [ ] Monitoreo cada 2 horas
- [ ] Escalación si hay alerta

**Sábado 15 sept, 06:00-22:00: Dev Lead**
- [ ] Análisis de datos overnight
- [ ] Verificar históricos (pre-Sept 2026) no fueron tocados
- [ ] Dashboard: gráfica de registros por ciclo (debe mostrar spike en 2026-09)

**Domingo 16 sept: Reducción de guardia**
- [ ] Monitoreo cada 4 horas
- [ ] Alertas aún activas

**Lunes 17 sept, 09:00-17:00: Dev Lead**
- [ ] Análisis final de 72 horas
- [ ] Verificar:
  - [ ] 0 errores de ciclo NULL
  - [ ] 0 discrepancias en históricos
  - [ ] Todos los registros sept tienen ciclo 2026-09
  - [ ] Feature flag estable (sin rollbacks)

- [ ] **SI TODO OK:** Lock feature flag = true (permanente)
  - [ ] Remover fallback a lógica antigua
  - [ ] Commit: "Lock ciclo natural, remover fallback"
  - [ ] Documentar cambio en CHANGELOG

- [ ] **SI HAY PROBLEMA:** Ejecutar rollback inmediato
  ```bash
  git checkout main
  # En .env.production
  REACT_APP_USE_NATURAL_CICLO=false
  git commit -am "Rollback: ciclo natural desactivado"
  npm run deploy:prod
  # RTO: 5-15 minutos
  ```

### Fin de Fase 1 (17 sept)

- [ ] Escribir post-mortem (aunque sea OK):
  - [ ] Qué fue bien
  - [ ] Qué fue difícil
  - [ ] Métricas:  registros migrados, tiempo, incidentes

- [ ] Comunicar a asesoría externa:
  - [ ] Email: "Cambio de ciclo a mes natural completado"
  - [ ] Adjuntar documentación técnica

- [ ] Planificar Fase 2 (renombramiento de entidades para próxima semana)

---

## 🎯 ROLLBACK: Procedimiento de Emergencia

**Si algo explota, en 5 minutos:**

```bash
# 1. Detener cambios (revert .env.production)
echo "REACT_APP_USE_NATURAL_CICLO=false" > .env.production

# 2. Redeploy rápido
npm run deploy:prod

# 3. Verificar rollback
curl https://app.smartgestion.com/api/ciclo-test

# 4. Notificar a Gerencia en Slack
# "⚠️ Rollback ejecutado. Ciclo vuelto a lógica antigua."

# 5. Investigar qué falló (post-mortem)
# Revisar logs, telemetría, etc.

# 6. Re-planificar para el siguiente intento (próximo mes)
```

**RTO (Recovery Time Objective):** Máximo 15 minutos  
**RPO (Recovery Point Objective):** Última BD backup (pre-cambio)

---

## 📊 MÉTRICAS DE ÉXITO (Semana 1)

| Métrica | Baseline | Target |
|---------|----------|--------|
| Registros creados (sept 2026) | 0 | ≥ 50 |
| Ciclos sin NULL | 100% | 100% |
| Históricos alterados (pre-sept) | 0 | 0 |
| Incidentes críticos | N/A | 0 |
| Rollbacks necesarios | N/A | 0 |
| Avisos pre-cierre activados (días 27-29) | N/A | ✓ (sí) |
| Tiempo de resolución de bugs | N/A | < 30 min |

---

## 📞 COMUNICACIÓN

### Email a Gerencia (Hoy, 11 sept)

```
Asunto: [CAMBIO PLANIFICADO] Ciclo de Gastos → Mes Natural (13 sept)

Estimada Gerencia,

Implementaremos MAÑANA un cambio técnico importante en el módulo de Gastos:

📅 CAMBIO: El ciclo pasa de día 26→25 a día 1→30/31 (mes natural)

✅ BENEFICIOS:
  - Alineación 1:1 con meses fiscales (AEAT, IVA)
  - Menos confusión para técnicos ("¿Este gasto es de este mes o el próximo?")
  - Simplificación de lógica operativa

⏰ TIMELINE:
  - Hoy (11 sept): Validación en staging
  - Mañana (12 sept): QA/gerencia valida
  - Mañana tarde (13 sept): Deploy a prod (flag desactivado)
  - Jueves (14 sept): Activar flag + Monitoreo 24/7

🔔 IMPACTO:
  - NO afecta a gastos de agosto/julio (históricos intactos)
  - Todos los gastos de SEPTIEMBRE usan nueva lógica
  - Avisos pre-cierre cambian: ahora días 27, 28, 29 (en lugar de 22, 23, 24)

📞 En caso de dudas o problemas durante el monitoreo:
  - Dev Lead: [numero]
  - DevOps: [numero]

Gracias por la flexibilidad.

Equipo Dev
```

### Email a Asesoría Externa (Hoy, 11 sept)

```
Asunto: [INFORMACIÓN] Cambio de Ciclo Contable (Septiembre 2026)

Estimada Asesoría,

Informamos de un cambio técnico en Smart Gestión a partir de SEPTIEMBRE 2026:

📊 CAMBIO DE CICLO:
  Anterior: 26 de mes → 25 del mes siguiente
  Nuevo:    1 de mes → 30/31 del mes

✅ BENEFICIO CONTABLE:
  - Los gastos de septiembre en la app = gastos de septiembre en AEAT
  - Eliminamos distorsiones en imputación de IVA (Modelo 303)
  - Exportaciones de mes/trimestre ahora coinciden al céntimo

📋 ACCIÓN REQUERIDA (Opcional):
  - Si descargáis informes de gastos, ahora serán mes natural (1-30 sept)
  - Integración contable: cambio transparente, sin impacto en asientos

🔄 TRANSICIÓN:
  - Septiembre 2026 = transición (algunos gastos aún con lógica antigua)
  - Octubre 2026 en adelante = 100% mes natural

📞 Cualquier duda o inconsistencia:
  - Contactadnos inmediatamente

Saludos,
Equipo Smart Gestión
```

---

## 🎬 RESUMEN DE EJECUCIÓN

| Hito | Fecha | Estado | Responsable |
|------|-------|--------|-------------|
| Validación datos + decisiones | 11 sept | ✅ Completado | Gerencia |
| Desarrollo + PR review | 11-12 sept | 🔄 En curso | Dev Lead |
| QA Staging | 12-13 sept | 🔄 Pendiente | QA |
| Deploy prod (flag OFF) | 13 sept, tarde | ⏳ Programado | DevOps |
| Activar flag (flag ON) | 14 sept, mañana | ⏳ Programado | DevOps |
| Monitoreo 24/7 | 14-17 sept | 📞 Guardia activa | Dev + DevOps |
| Lock flag (remover fallback) | 17 sept | ⏳ Post-monitoreo | Dev Lead |
| Fase 2 (Renombramiento) | 18-24 sept | 📋 Planificado | Dev Lead |

---

*Plan Ejecutivo Finalizado: 11 sept 2026 | Listo para Inicio Inmediato*
