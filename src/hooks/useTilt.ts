import { useCallback, useEffect, useRef, type RefObject } from "react";

const TILT_MAX_DEG = 4;

// Tilt is a desktop-hover flourish: skip it on touch devices and for users who
// prefer reduced motion. Evaluated once — these media states don't meaningfully
// change within a session.
const tiltEnabled =
  typeof window !== "undefined" &&
  window.matchMedia("(hover: hover)").matches &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Pointer-driven 3D tilt with no animation-library dependency. Writes the full
 * `transform` to the element's inline style (the CSS `transition` smooths it),
 * matching the prior framer-motion behavior. Reads are rAF-throttled to one
 * layout query per frame.
 */
export function useTilt(): {
  ref: RefObject<HTMLElement | null>;
  onMouseMove: (event: React.MouseEvent) => void;
  onMouseLeave: () => void;
} {
  const ref = useRef<HTMLElement | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    },
    [],
  );

  const onMouseMove = useCallback((event: React.MouseEvent) => {
    if (!tiltEnabled || !ref.current) return;
    if (frameRef.current !== null) return; // a frame is already scheduled
    const { clientX, clientY } = event;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const node = ref.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const normalX = (clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
      const normalY = (clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
      const rotateX = (-normalY * TILT_MAX_DEG).toFixed(2);
      const rotateY = (normalX * TILT_MAX_DEG).toFixed(2);
      node.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });
  }, []);

  const onMouseLeave = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    const node = ref.current;
    if (!node) return;
    node.style.transform = "";
  }, []);

  return { ref, onMouseMove, onMouseLeave };
}
