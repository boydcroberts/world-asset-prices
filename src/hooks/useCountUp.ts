import { useEffect, useRef, useState } from "react";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Animate a number to `target` once, on the first valid value (cinematic load-in),
 * then track live updates instantly. Counts from `from` (e.g. the previous close)
 * so the hero's day move accrues on screen. Honors prefers-reduced-motion.
 */
export function useCountUp(target: number | null, opts: { from?: number | null; durationMs?: number } = {}): number | null {
  const { from, durationMs = 900 } = opts;
  const [value, setValue] = useState<number | null>(target);
  const doneRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (target == null) return;
    // After the initial count-up, just track the live value.
    if (doneRef.current) {
      setValue(target);
      return;
    }
    // First valid target: skip the animation when reduced-motion / no start point.
    if (prefersReducedMotion() || from == null || from === target) {
      doneRef.current = true;
      setValue(target);
      return;
    }
    doneRef.current = true;
    const start = from;
    const t0 = performance.now();
    const tick = (t: number) => {
      const progress = Math.min(1, (t - t0) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(start + (target - start) * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
      else setValue(target);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, from, durationMs]);

  return value;
}
