import { useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Tracks navigation depth to determine forward/back direction
// Returns 'forward' | 'back'
const historyStack = [];

export function useNavDirection() {
  const location = useLocation();
  const direction = useRef('forward');

  useEffect(() => {
    const key = location.key;
    const existingIdx = historyStack.indexOf(key);

    if (existingIdx !== -1) {
      // We've been here before → going back
      direction.current = 'back';
      historyStack.splice(existingIdx + 1); // trim forward entries
    } else {
      direction.current = 'forward';
      historyStack.push(key);
    }
  }, [location.key]);

  return direction;
}