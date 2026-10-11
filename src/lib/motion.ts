import { useEffect, useState } from 'react';

/**
 * True when the reader asked the system for less motion. Also true where the
 * question cannot be asked (no `matchMedia`), so the safe choice is the default.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/**
 * Counts from zero up to `target` once, when the component first appears.
 * With reduced motion the final value is shown at once.
 */
export function useCountUp(target: number, durationMs = 700): number {
  const [reduced] = useState(prefersReducedMotion);
  const [progress, setProgress] = useState(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const next = Math.min(1, (now - startedAt) / durationMs);
      setProgress(next);
      if (next < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduced, durationMs]);

  return Math.round(target * easeOutCubic(progress));
}
