import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Guarda un valor (p. ej. un filtro) en la URL (?clave=valor) y en estado local.
 * Al volver atrás desde otra pantalla, la URL conserva los filtros.
 */
export function useUrlState(clave, porDefecto = '') {
  const [params, setParams] = useSearchParams();
  const [valor, setLocal] = useState(params.get(clave) ?? porDefecto);
  const setValor = (nuevo) => {
    setLocal(nuevo);
    setParams((prev) => {
      const n = new URLSearchParams(prev);
      if (nuevo === porDefecto || nuevo === '' || nuevo == null) n.delete(clave);
      else n.set(clave, nuevo);
      return n;
    }, { replace: true });
  };
  return [valor, setValor];
}
