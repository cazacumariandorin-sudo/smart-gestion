# 📁 Sistema de Sincronización Google Drive

## Descripción General

El sistema permite que **todos los archivos subidos por los usuarios** (documentos, fotos, tickets, etc.) se guarden automáticamente en **Google Drive** cuando el conector está activo, manteniendo una sincronización bidireccional con la base de datos local.

## 🗂️ Estructura de Carpetas en Google Drive

```
SIMANTEC/
├── Pedidos/
├── Obras/
│   └── Materiales/
├── Notas_Gastos/
├── Operarios/
│   └── Documentos/
├── Partes_Trabajo/
│   └── Fotos/
├── Planos/
├── Manuales/
├── Catalogo_Materiales/
└── Obras_Solar/
    └── Legalizacion/
```

**Folder ID raíz:** `1yJzcwSzo2acrswgmtKLbNTKVd7WxUtF1`

## 🔄 Flujo de Subida de Archivos

### 1. **Detección Automática**
Cuando un usuario sube un archivo, el sistema:
1. Verifica si el conector de Google Drive está autorizado
2. Si está conectado → sube a Google Drive
3. Si NO está conectado → usa almacenamiento local de Base44 (fallback)

### 2. **Función Backend: `uploadFileToGdrive`**

**Parámetros de entrada:**
```json
{
  "file": "base64_encoded_file",
  "folder_path": "Ruta/En/Google/Drive"
}
```

**Respuesta:**
```json
{
  "success": true,
  "file_url": "https://drive.google.com/uc?id=FILE_ID&export=download",
  "storage": "googledrive" | "local",
  "drive_file_id": "ID_DEL_ARCHIVO",
  "drive_folder_id": "ID_CARPETA"
}
```

### 3. **Archivos Actualizados**

Los siguientes componentes ahora usan Google Drive automáticamente:

| Componente | Ruta Google Drive | Entidad |
|------------|------------------|---------|
| `TicketCapture` (gastos) | `/Notas_Gastos` | `RegistroGasto`, `GastoOperario` |
| `PhotoUploader` (partes) | `/Partes_Trabajo/Fotos` | `WorkPhoto` |
| `GaleriaFotos` | `/Obras` | `FotoProyecto` |
| `DocsList` (operarios) | `/Operarios/Documentos` | `OperarioDoc` |

## 📊 Entidad: `GdriveSyncState`

Entidad para rastrear el estado de sincronización:

- **recurso_tipo**: `folder`, `file`, `webhook`
- **recurso_id**: ID del recurso en Google Drive
- **ruta_completa**: Ruta completa (ej: `/Obras/Materiales`)
- **page_token**: Token para webhooks incrementales
- **ultima_sync**: Timestamp de última sincronización
- **estado**: `activo`, `error`, `pendiente`

## 🔧 Funciones Backend

### `createGdriveFolderStructure`
- Crea la estructura inicial de carpetas
- Se ejecuta al conectar Google Drive por primera vez
- Usa el conector autorizado `googledrive`

### `uploadFileToGdrive` ⭐
- Sube archivos a Google Drive o local (fallback)
- Convierte base64 a blob
- Crea carpetas automáticamente si no existen
- Hace los archivos públicamente accesibles (reader: anyone)

### `sincronizarDatosUsuario`
- Sincroniza datos personales cada 6 horas (automatización)
- No aplica para archivos, solo datos de usuario

## 🎯 Automatizaciones

| Nombre | Función | Schedule | Descripción |
|--------|---------|----------|-------------|
| `Sincronización Datos Personales Usuarios` | `sincronizarDatosUsuario` | `0 */6 * * *` | Cada 6 horas |
| `Completado Automático de Fichajes` | `completarFichajesAutomaticos` | `30 23 * * 1-5` | Lunes-Viernes 23:30 |
| `Completado Automático de Fichajes` | `completarFichajesAutomaticos` | `30 16 * * 0,6` | Sáb-Dom 16:30 |

## 📝 Campos en Entidades

Las siguientes entidades ahora incluyen campos opcionales para rastrear el almacenamiento:

```json
{
  "storage": "googledrive" | "local",
  "drive_file_id": "ID_OPCIONAL"
}
```

**Entidades actualizadas:**
- `WorkPhoto`
- `FotoProyecto`
- `OperarioDoc`
- `RegistroGasto` (vía `archivo` field)
- `GastoOperario` (vía `ticket_url`)

## 🔐 Permisos y Seguridad

- **Connector**: `googledrive` con scope `https://www.googleapis.com/auth/drive`
- **Acceso**: Archivos creados son `reader: anyone` para permitir visualización en la app
- **RLS**: Solo admins pueden ver/modificar `GdriveSyncState`

## 🚀 Cómo Funciona para el Usuario

1. **Conexión inicial**: 
   - Usuario va a Profile → "Conectar Google Drive"
   - Autoriza OAuth
   - Sistema crea estructura de carpetas automáticamente

2. **Subida de archivos**:
   - Usuario sube foto/ticket/documento
   - Sistema detecta Google Drive activo
   - Archivo se guarda en la nube (ruta correspondiente)
   - URL de Google Drive se guarda en la entidad

3. **Visualización**:
   - App carga URLs directamente desde Google Drive
   - Mismo UX que almacenamiento local
   - Sin cambios en la interfaz

## 📈 Ventajas

✅ **Ahorro de almacenamiento local** en Base44  
✅ **Archivos persistentes** incluso si se elimina la app  
✅ **Acceso desde cualquier dispositivo** vía Google Drive  
✅ **Backups automáticos** gestionados por Google  
✅ **Escalabilidad ilimitada** (según cuota de Google Drive)  
✅ **Colaboración** (se puede compartir carpetas con el equipo)  

## 🔍 Monitorización

Para verificar el estado de sincronización:

```js
// Desde la consola del navegador
const sync = await base44.entities.GdriveSyncState.list();
console.log(sync);

// Verificar archivos subidos
const fotos = await base44.entities.WorkPhoto.list();
console.log(fotos.filter(f => f.storage === 'googledrive'));
```

## 🛠️ Mantenimiento

### Limpiar archivos huérfanos
Si un archivo se elimina de la entidad pero sigue en Google Drive:

```js
// Backend function (ejemplo)
const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
await fetch(`https://www.googleapis.com/drive/v3/files/${drive_file_id}`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${accessToken}` }
});
```

### Re-sincronizar carpetas
Si la estructura se corrompe:

1. Ir a Profile → Desconectar Google Drive
2. Volver a conectar
3. Ejecutar `createGdriveFolderStructure`

## 📞 Soporte

Para incidencias con Google Drive:
1. Verificar que el conector esté autorizado (`googledrive`)
2. Revisar logs de `uploadFileToGdrive`
3. Comprobar entidad `GdriveSyncState` para errores
4. Validar que el folder raíz existe: `1yJzcwSzo2acrswgmtKLbNTKVd7WxUtF1