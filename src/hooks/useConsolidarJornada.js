import { useMemo } from 'react';

/**
 * Hook para consolidar Fichajes y ApuntesHorario por jornada laboral.
 * Realiza el "anclaje virtual" basado en coincidencia de:
 * - operario_id
 * - date
 * - obra_id
 * 
 * @param {Array} fichajes - Lista de fichajes
 * @param {Array} apuntes - Lista de apuntes horarios
 * @returns {Object} { jornadasConsolidadas, apuntesSinAnclar, getEstadoAnclaje }
 */
export function useConsolidarJornada(fichajes = [], apuntes = []) {
  const jornadasConsolidadas = useMemo(() => {
    const mapaJornadas = {};

    // Indexar fichajes por clave única: operario_id|date|obra_id
    fichajes.forEach(fichaje => {
      const clave = `${fichaje.operario_id}|${fichaje.date}|${fichaje.obra_id || 'sin_obra'}`;
      
      if (!mapaJornadas[clave]) {
        mapaJornadas[clave] = {
          ...fichaje,
          apuntes_asociados: [],
          total_cantidad: 0,
          total_importe: 0,
          tiene_apuntes: false,
        };
      }
    });

    // Anclar apuntes a sus jornadas correspondientes
    apuntes.forEach(apunte => {
      const clave = `${apunte.operario_id}|${apunte.date}|${apunte.obra_id || 'sin_obra'}`;
      
      if (mapaJornadas[clave]) {
        // Anclaje exitoso: el apunte coincide con una jornada existente
        mapaJornadas[clave].apuntes_asociados.push(apunte);
        mapaJornadas[clave].total_cantidad += apunte.cantidad || 0;
        mapaJornadas[clave].total_importe += apunte.total || 0;
        mapaJornadas[clave].tiene_apuntes = true;
      }
      // Si no hay coincidencia, el apunte queda "sin anclar" (se maneja abajo)
    });

    return Object.values(mapaJornadas);
  }, [fichajes, apuntes]);

  // Apuntes que no pudieron anclarse a ninguna jornada
  const apuntesSinAnclar = useMemo(() => {
    const clavesConJornada = new Set(
      apuntes
        .filter(apunte => {
          const clave = `${apunte.operario_id}|${apunte.date}|${apunte.obra_id || 'sin_obra'}`;
          return fichajes.some(f => `${f.operario_id}|${f.date}|${f.obra_id || 'sin_obra'}` === clave);
        })
        .map(a => a.id)
    );

    return apuntes.filter(apunte => !clavesConJornada.has(apunte.id));
  }, [fichajes, apuntes]);

  // Función utilitaria para obtener el estado de anclaje de un apunte específico
  const getEstadoAnclaje = (apunte) => {
    const clave = `${apunte.operario_id}|${apunte.date}|${apunte.obra_id || 'sin_obra'}`;
    const tieneJornada = fichajes.some(f => `${f.operario_id}|${f.date}|${f.obra_id || 'sin_obra'}` === clave);
    
    return {
      anclado: tieneJornada,
      mensaje: tieneJornada ? 'Vinculado a jornada' : 'Sin jornada asociada',
      color: tieneJornada ? 'text-emerald-600' : 'text-amber-600',
      badgeClass: tieneJornada 
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
        : 'bg-amber-50 text-amber-700 border-amber-200'
    };
  };

  return {
    jornadasConsolidadas,
    apuntesSinAnclar,
    getEstadoAnclaje,
  };
}