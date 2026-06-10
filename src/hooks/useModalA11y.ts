import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessibility plumbing shared by every modal dialog (asset detail drawer,
 * search modal): move focus into the dialog on open, trap Tab inside it, mark
 * the background `<main>` inert, lock background scroll, and restore focus to the
 * triggering element on close. Centralizing this keeps all dialogs consistent
 * (WCAG 2.4.3 focus order, 1.4.13, 4.1.2).
 *
 * @param containerRef ref to the dialog container whose focusables are trapped
 * @param initialFocusSelector optional selector (within the container) to focus
 *   first; defaults to the first focusable element
 */
export function useModalA11y(
  containerRef: RefObject<HTMLElement | null>,
  initialFocusSelector?: string,
): void {
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    const focusTarget = initialFocusSelector
      ? container?.querySelector<HTMLElement>(initialFocusSelector)
      : container?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    focusTarget?.focus();

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const mainEl = document.querySelector<HTMLElement>("main");
    if (mainEl) mainEl.inert = true;

    function handleTab(event: KeyboardEvent) {
      if (event.key !== "Tab" || !container) return;
      const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !container.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleTab, true);
    return () => {
      document.removeEventListener("keydown", handleTab, true);
      document.body.style.overflow = previousBodyOverflow;
      if (mainEl) mainEl.inert = false;
      previouslyFocused?.focus?.();
    };
  }, [containerRef, initialFocusSelector]);
}
