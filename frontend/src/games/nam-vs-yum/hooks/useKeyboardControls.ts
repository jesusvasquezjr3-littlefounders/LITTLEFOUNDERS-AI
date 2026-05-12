import { useEffect, useRef, useCallback } from 'react';

interface UseKeyboardControlsProps {
  isPlaying: boolean;
  onPause: () => void;
  onKonami?: () => void;
}

export function useKeyboardControls({ isPlaying, onPause, onKonami }: UseKeyboardControlsProps) {
  const konamiRef = useRef<string[]>([]);
  const KONAMI_SEQUENCE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Konami code tracking (works always)
      konamiRef.current.push(e.key);
      if (konamiRef.current.length > KONAMI_SEQUENCE.length) {
        konamiRef.current.shift();
      }
      if (konamiRef.current.join(',') === KONAMI_SEQUENCE.join(',')) {
        onKonami?.();
        konamiRef.current = [];
        return;
      }

      if (!isPlaying) return;

      switch (e.key) {
        case ' ':
        case 'Escape':
          e.preventDefault();
          onPause();
          break;
      }
    },
    [isPlaying, onPause, onKonami]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {};
}
