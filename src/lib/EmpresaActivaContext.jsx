import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { setEmpresaActiva, getEmpresaActiva, leerEmpresaRecordada } from '@/lib/empresaActiva';

const Ctx = createContext(null);

/**
 * Resuelve la empresa del usuario y la deja disponible en toda la app.
 * - Un acceso normal queda fijado a su empresa: no hay selector.
 * - El propietario de la app (es_propietario_global) puede cambiar de empresa
 *   para supervisar todas.
 */
export function EmpresaActivaProvider({ children }) {
  const { user, isLoadingAuth } = useAuth();
  const [empresas, setEmpresas] = useState([]);
  const [activa, setActiva] = useState(getEmpresaActiva());

  const esPropietario = user?.es_propietario_global === true || user?.role === 'propietario';

  useEffect(() => {
    if (!user?.email) {
      setEmpresas([]);
      return;
    }
    base44.entities.Empresa.list('-created_date', 100)
      .then((lista) => setEmpresas(Array.isArray(lista) ? lista : []))
      .catch(() => setEmpresas([]));
  }, [user?.email, esPropietario]);

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!user) {
      setEmpresaActiva(null);
      setActiva(null);
      return;
    }
    if (esPropietario) {
      const recordada = leerEmpresaRecordada();
      const elegida = empresas.find((e) => e.id === recordada)
        || empresas.find((e) => e.es_principal)
        || empresas[0]
        || null;
      setEmpresaActiva(elegida);
      setActiva(elegida ? { id: elegida.id, nombre: elegida.nombre } : null);
      return;
    }
    const propia = empresas.find((e) => e.id === user.empresa_id)
      || (user.empresa_id ? { id: user.empresa_id, nombre: user.empresa_nombre || '' } : null);
    setEmpresaActiva(propia);
    setActiva(propia ? { id: propia.id, nombre: propia.nombre } : null);
  }, [user?.email, user?.empresa_id, user?.empresa_nombre, empresas, esPropietario, isLoadingAuth]);

  const cambiarEmpresa = useCallback((id) => {
    const elegida = empresas.find((e) => e.id === id) || null;
    setEmpresaActiva(elegida);
    setActiva(elegida ? { id: elegida.id, nombre: elegida.nombre } : null);
  }, [empresas]);

  // Un administrador nunca se queda fuera de la app: el bloqueo es para accesos
  // de plantilla que aún no tienen empresa asignada.
  const sinEmpresa = !isLoadingAuth && !!user && !esPropietario
    && user.role !== 'admin' && !user.empresa_id;

  return (
    <Ctx.Provider value={{
      empresa: activa,
      empresas,
      esPropietario,
      puedeCambiar: esPropietario && empresas.length > 1,
      cambiarEmpresa,
      sinEmpresa,
      cargando: isLoadingAuth,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useEmpresaActiva() {
  return useContext(Ctx) || {
    empresa: null, empresas: [], esPropietario: false, puedeCambiar: false,
    cambiarEmpresa: () => {}, sinEmpresa: false, cargando: false,
  };
}