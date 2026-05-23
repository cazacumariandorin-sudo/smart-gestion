/**
 * useOfflineCache — Caché local con localStorage como sustituto del Service Worker.
 * TTL configurable por entidad.
 */
export function useOfflineCache(entityName, queryFn, ttlMinutes = 30) {
  const cacheKey = `sgcache_${entityName}`;
  const cacheTimeKey = `sgcache_time_${entityName}`;

  const getFromCache = () => {
    try {
      const cached = localStorage.getItem(cacheKey);
      const cachedTime = localStorage.getItem(cacheTimeKey);
      if (cached && cachedTime) {
        const ageMinutes = (Date.now() - parseInt(cachedTime)) / 60000;
        if (ageMinutes < ttlMinutes) {
          return JSON.parse(cached);
        }
      }
    } catch (e) {}
    return null;
  };

  const saveToCache = (data) => {
    try {
      localStorage.setItem(cacheKey, JSON.stringify(data));
      localStorage.setItem(cacheTimeKey, Date.now().toString());
    } catch (e) {}
  };

  const fetchWithCache = async () => {
    if (!navigator.onLine) {
      const cached = getFromCache();
      if (cached) return cached;
      throw new Error('Sin conexión y sin datos en caché');
    }
    try {
      const data = await queryFn();
      saveToCache(data);
      return data;
    } catch (e) {
      const cached = getFromCache();
      if (cached) return cached;
      throw e;
    }
  };

  return { fetchWithCache, getFromCache, saveToCache };
}

/**
 * TTL recomendados por entidad (en minutos)
 */
export const CACHE_TTL = {
  obras: 60,
  solar_obras: 60,
  operarios: 120,
  materials: 480,
  solar_materials: 480,
  fabricantes: 480,
  manuales: 480,
  drawings: 480,
  work_orders: 15,
  fichajes: 5,
  gastos_operario: 10,
};

/**
 * Precargar caché de entidades críticas en background (fire and forget)
 */
export async function preloadOfflineCache(base44) {
  const tasks = [
    {
      name: 'obras',
      fn: () => base44.entities.Obra.filter({ status: 'activa' }),
    },
    {
      name: 'operarios',
      fn: () => base44.entities.Operario.list(),
    },
    {
      name: 'materials',
      fn: () => base44.entities.MaterialCatalog.list(),
    },
  ];

  for (const task of tasks) {
    try {
      const data = await task.fn();
      localStorage.setItem(`sgcache_${task.name}`, JSON.stringify(data));
      localStorage.setItem(`sgcache_time_${task.name}`, Date.now().toString());
    } catch {}
  }
}