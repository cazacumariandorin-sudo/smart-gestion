# Crear Entidades en Base44 Programáticamente

## ⚠️ NOTA IMPORTANTE

**Base44 NO expone una API pública para crear modelos/entidades.** Esto es por diseño - el schema debe manejarse desde el Builder visual.

Sin embargo, hay **3 formas** de hacerlo:

---

## 🟢 OPCIÓN 1: Crear Script en Base44 Backend (RECOMENDADO)

### Requisitos:
- Acceso a Base44 Builder
- Permiso para crear funciones backend

### Pasos:

#### 1. En Base44 Builder → Functions → Crear Nueva Función

```javascript
// src/backend/functions/setupDatabase.js
// (O en Base44 Backend Functions UI)

import { base44 } from "@base44/sdk";

// Esta función se ejecuta SOLO una vez para setup inicial
export async function setupObrasCivilesSolares(req) {
  try {
    console.log('🚀 Iniciando setup de obras civiles y solares...');
    
    // NOTA: Base44 no permite crear entidades vía API
    // Pero sí podemos crear registros de ejemplo
    
    // Crear datos de prueba para ObraCivil
    const obrasCiviles = [
      {
        name: 'Reforma Oficinas Centro',
        code: 'CIV-001',
        client_id: 'client_uuid_1',
        client_name: 'Acme Corp',
        address: 'Calle Principal 123, Madrid',
        start_date: '2024-01-15',
        end_date: '2024-06-30',
        status: 'activa',
        budget: 50000,
        description: 'Reforma integral de oficinas',
        contact_person: 'Juan García',
        contact_phone: '600123456',
        notes: 'Proyecto piloto',
        type: 'civil'
      },
      {
        name: 'Construcción Almacén Logístico',
        code: 'CIV-002',
        client_id: 'client_uuid_2',
        client_name: 'LogisticHub S.L.',
        address: 'Polígono Industrial, Barcelona',
        start_date: '2024-02-01',
        end_date: '2024-12-31',
        status: 'activa',
        budget: 250000,
        description: 'Almacén de 5000 m²',
        contact_person: 'María López',
        contact_phone: '600654321',
        notes: 'Proyecto premium',
        type: 'civil'
      }
    ];

    // Crear datos de prueba para ObraSolar
    const obrasSolares = [
      {
        name: 'Planta Solar Tejados - Madrid',
        code: 'SOL-001',
        client_id: 'client_uuid_3',
        client_name: 'GreenEnergy S.A.',
        address: 'Techumbre Centro Comercial, Madrid',
        start_date: '2024-03-01',
        end_date: '2024-05-31',
        status: 'activa',
        budget: 75000,
        description: 'Instalación solar fotovoltaica 50kW',
        contact_person: 'Carlos Jiménez',
        contact_phone: '600789012',
        notes: 'Conexión a red prevista junio 2024',
        type: 'solar',
        potencia_kw: 50,
        modulos_cantidad: 120,
        inversor_marca: 'SMA',
        bateria_kwh: 0,
        licencia_tramite: 'ENE-2024-0001',
        licencia_estado: 'aprobada',
        fecha_conexion: '2024-06-15'
      },
      {
        name: 'Sistema Solar Híbrido - Valencia',
        code: 'SOL-002',
        client_id: 'client_uuid_4',
        client_name: 'SunSolutions Ltd',
        address: 'Tejado Industrial, Valencia',
        start_date: '2024-04-01',
        end_date: '2024-09-30',
        status: 'presupuesto',
        budget: 120000,
        description: 'Sistema solar + almacenamiento en batería',
        contact_person: 'Ana Rodríguez',
        contact_phone: '600345678',
        notes: 'Incluye 30kWh de baterías',
        type: 'solar',
        potencia_kw: 40,
        modulos_cantidad: 100,
        inversor_marca: 'Fronius',
        bateria_kwh: 30,
        licencia_tramite: 'ENE-2024-0002',
        licencia_estado: 'pendiente',
        fecha_conexion: null
      }
    ];

    // Crear registros en Base44
    // (Usando asServiceRole para admin access)
    const results = {
      obrasCiviles: [],
      obrasSolares: []
    };

    // Intentar crear ObrasCiviles
    try {
      for (const obra of obrasCiviles) {
        const created = await base44.asServiceRole.entities.ObraCivil.create(obra);
        results.obrasCiviles.push(created);
        console.log(`✅ Obra civil creada: ${created.name}`);
      }
    } catch (error) {
      console.warn(`⚠️ Error creando obras civiles: ${error.message}`);
    }

    // Intentar crear ObrasSolares
    try {
      for (const obra of obrasSolares) {
        const created = await base44.asServiceRole.entities.ObraSolar.create(obra);
        results.obrasSolares.push(created);
        console.log(`✅ Obra solar creada: ${created.name}`);
      }
    } catch (error) {
      console.warn(`⚠️ Error creando obras solares: ${error.message}`);
    }

    return {
      success: true,
      message: '✅ Setup de obras completado',
      data: results
    };
  } catch (error) {
    console.error('❌ Error en setup:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
```

#### 2. Llamar desde React cuando sea necesario

```javascript
// En tu app React
import { base44 } from '@/api/base44Client';

// Cuando quieras ejecutar el setup
const handleSetupDatabase = async () => {
  try {
    const response = await base44.functions.setupObrasCivilesSolares();
    console.log('Setup completado:', response);
    alert('✅ Base de datos inicializada');
  } catch (error) {
    console.error('Error en setup:', error);
  }
};
```

---

## 🔴 OPCIÓN 2: Script Manual (Sin Base44 API)

Si **Base44 NO permite** crear entidades vía API, debes hacerlo **manualmente una sola vez**:

### Proceso:

1. **Abre Base44 Builder**
2. **Ve a Data Model**
3. **Copia/Pega el JSON** de estructura (si existe)
4. O **crea entidades manualmente** desde UI

### El script que creé ayuda a:
- ✅ Llenar con datos iniciales
- ✅ Crear registros de prueba
- ✅ Automatizar importación de datos CSV

---

## 🟡 OPCIÓN 3: Usar CSV Import de Base44

### Si tienes datos en CSV:

1. **Crea las entidades manualmente** en Base44 Builder
2. **Ve a Data → Import**
3. **Sube tu CSV** con datos de ObrasCivil y ObraSolar
4. **Base44 mapea automáticamente** los campos

### Formato CSV:

**obras_civiles.csv:**
```csv
name,code,client_id,client_name,address,start_date,status,budget,type
"Reforma Oficinas","CIV-001","client_123","Acme Corp","Calle 123","2024-01-15","activa",50000,"civil"
"Almacén Logístico","CIV-002","client_456","LogisticHub","Polígono 1","2024-02-01","activa",250000,"civil"
```

**obras_solares.csv:**
```csv
name,code,client_id,client_name,address,start_date,status,budget,potencia_kw,modulos_cantidad,type
"Planta Solar Madrid","SOL-001","client_789","GreenEnergy","Techumbre CC","2024-03-01","activa",75000,50,120,"solar"
```

---

## 📊 Comparativa de Opciones

| Opción | Requisito | Automatización | Escalabilidad | Dificultad |
|--------|-----------|----------------|---------------|----------|
| 1: Backend Function | Node.js en Base44 | 🟢 Alta | 🟢 Alta | 🟡 Media |
| 2: Manual UI | Solo navegador | 🔴 Baja | 🔴 Baja | 🟢 Fácil |
| 3: CSV Import | CSV preparado | 🟡 Media | 🟡 Media | 🟢 Fácil |

---

## ⚡ RECOMENDACIÓN FINAL

### Para tu proyecto "smart-gestion":

1. **Primero (manual):**
   - Crea las entidades ObraCivil y ObraSolar en Base44 Builder (UI visual)
   - Crea los módulos de permisos
   - Crea los roles de usuario

2. **Luego (automatizado):**
   - Usa el **script de Backend Function** (Opción 1) para:
     - Crear datos de prueba
     - Hacer migraciones futuras
     - Automatizar importación

3. **Para datos del usuario:**
   - Los usuarios crean registros vía UI de React
   - O importan CSV grandes en Base44

---

## 🚀 Script Completo para Ejecutar

### En Base44 Backend → Crear función:

**Nombre función:** `setupObras`

**Código:**

```javascript
import { base44 } from "@base44/sdk";

export async function setupObras(req) {
  const obrasCiviles = [
    {
      name: 'Reforma Oficinas Centro',
      code: 'CIV-001',
      status: 'activa',
      budget: 50000,
      type: 'civil'
    },
    {
      name: 'Construcción Almacén',
      code: 'CIV-002',
      status: 'activa',
      budget: 250000,
      type: 'civil'
    }
  ];

  const obrasSolares = [
    {
      name: 'Planta Solar Madrid',
      code: 'SOL-001',
      status: 'activa',
      budget: 75000,
      potencia_kw: 50,
      modulos_cantidad: 120,
      type: 'solar'
    }
  ];

  try {
    // Crear obras civiles
    const createdCivil = await Promise.all(
      obrasCiviles.map(obra => base44.asServiceRole.entities.ObraCivil.create(obra))
    );

    // Crear obras solares
    const createdSolar = await Promise.all(
      obrasSolares.map(obra => base44.asServiceRole.entities.ObraSolar.create(obra))
    );

    return {
      success: true,
      obrasCiviles: createdCivil,
      obrasSolares: createdSolar
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

### Llamar desde React:

```javascript
const { mutate: setupDB } = useMutation({
  mutationFn: () => base44.functions.setupObras(),
  onSuccess: (data) => {
    toast.success(`✅ ${data.obrasCiviles.length} obras civiles + ${data.obrasSolares.length} solares creadas`);
  }
});

// En tu componente
<button onClick={() => setupDB()}>Inicializar Base de Datos</button>
```

---

## ✅ Conclusión

**No hay API pública** en Base44 para crear modelos/esquemas programáticamente, pero:

✅ **Puedes automatizar la carga de datos** con Backend Functions  
✅ **Puedes importar CSV** en masa  
✅ **Puedes crear registros** vía API SDK  

Para tu caso específico:
1. Crea entidades ObraCivil y ObraSolar **manualmente en Base44 Builder** (5-10 min)
2. Usa el **script de Backend Function** para automatizar datos iniciales
3. Los usuarios crean nuevas obras desde React

¿Necesitas que adapte el script a tu estructura específica? 🚀
