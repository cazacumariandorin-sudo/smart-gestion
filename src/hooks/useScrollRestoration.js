import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

// Persists scroll position per pathname across navigations
const scrollPositions = new Map();

export function useScrollRestoration() {
  const { pathname } = useLocation();
  const prevPath = useRef(pathname);

  useEffect(() => {
    // Save scroll position when leaving a route
    const save = () => {
      scrollPositions.set(prevPath.current, window.scrollY);
    };

    // Restore scroll when arriving at a route
    const savedY = scrollPositions.get(pathname) ?? 0;
    // Defer so content has rendered
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: savedY, behavior: 'instant' });
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