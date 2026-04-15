import { useState, useEffect, useRef } from 'react';

export function usePullToRefresh(onRefresh, threshold = 70) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current || window;

    const handleTouchStart = (e) => {
      const scrollTop = containerRef.current
        ? containerRef.current.scrollTop
        : window.scrollY;
      if (scrollTop === 0) {
        startY.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e) => {
      if (startY.current === null) return;
      const dist = e.touches[0].clientY - startY.current;
      if (dist > 0) {
        setPullDistance(Math.min(dist, threshold * 1.5));
        setPulling(true);
      }
    };

    const handleTouchEnd = async () => {
      if (pullDistance >= threshold && !refreshing) {
        setRefreshing(true);
        await onRefresh();
        setRefreshing(false);
      }
      startY.current = null;
      setPullDistance(0);
      setPulling(false);
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, refreshing, onRefresh, threshold]);

  return { pulling, pullDistance, refreshing, containerRef };
}