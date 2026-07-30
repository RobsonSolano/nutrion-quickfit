import { useCallback, useEffect, useState, type RefObject } from 'react';

/**
 * Num totem a barra de rolagem é a única dica de que existe mais conteúdo.
 * Este hook alimenta o véu e o contador "↓ mais N exercícios".
 */
export function useHasMore(ref: RefObject<HTMLElement | null>): {
  hasMore: boolean;
  below: number;
} {
  const [state, setState] = useState({ hasMore: false, below: 0 });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const hidden = el.scrollHeight - el.clientHeight - el.scrollTop;
    if (hidden <= 4) {
      setState({ hasMore: false, below: 0 });
      return;
    }
    const below = Array.from(el.children).filter(
      (c) => (c as HTMLElement).offsetTop - el.scrollTop + (c as HTMLElement).offsetHeight
        > el.clientHeight + 2,
    ).length;
    setState({ hasMore: true, below });
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      ro.disconnect();
    };
  }, [ref, measure]);

  return state;
}
