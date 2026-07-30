import { useEffect, useRef } from 'react';

const IDLE_MS = 90_000;

/**
 * Aluno abandona no meio do fluxo o tempo todo. Sem isto, o próximo vê a
 * triagem PAR-Q do anterior já respondida.
 */
export function useIdleTimeout(onIdle: () => void, active: boolean, ms = IDLE_MS): void {
  const timer = useRef<number | undefined>(undefined);
  const cb = useRef(onIdle);
  cb.current = onIdle;

  useEffect(() => {
    if (!active) return;

    const reset = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => cb.current(), ms);
    };

    reset();
    const events = ['pointerdown', 'keydown', 'touchstart'] as const;
    for (const e of events) window.addEventListener(e, reset, { passive: true });

    return () => {
      window.clearTimeout(timer.current);
      for (const e of events) window.removeEventListener(e, reset);
    };
  }, [active, ms]);
}
