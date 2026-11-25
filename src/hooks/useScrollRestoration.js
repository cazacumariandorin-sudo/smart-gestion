import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

// Persists scroll position per pathname across navigations.
// El scroll vertical vive en el área de contenido del shell (.sg-main), no en la ventana.
const scrollPositions = new Map();

function scroller() {
  return document.querySelector('.sg-main');
}

export function useScrollRestoration() {
  const { pathname } = useLocation();
  const prevPath = useRef(pathname);

  useEffect(() => {
    // Save scroll position when leaving a route
    const save = () => {
      const el = scroller();
      scrollPositions.set(prevPath.current, el ? el.scrollTop : window.scrollY);
    };

    // Restore scroll when arriving at a route
    const savedY = scrollPositions.get(pathname) ?? 0;
    // Defer so content has rendered
    const frame = requestAnimationFrame(() => {
      const el = scroller();
      if (el) el.scrollTop = savedY;
      else window.scrollTo({ top: savedY, behavior: 'instant' });
    });

    prevPath.current = pathname;

    window.addEventListener('beforeunload', save);
    return () => {
      save();
      window.removeEventListener('beforeunload', save);
      cancelAnimationFrame(frame);
    };
  }, [pathname]);
}