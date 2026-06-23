import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// JSDOM does not implement matchMedia — provide a minimal stub
// Guard: setup.ts is injected into all test environments including Node (api/ tests)
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      // Report reduced-motion in tests so motion (count-up, etc.) resolves
      // deterministically to its final state.
      matches: /prefers-reduced-motion/.test(query),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });

  // JSDOM does not implement IntersectionObserver — provide a minimal stub
  class IntersectionObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(window, "IntersectionObserver", {
    writable: true,
    value: IntersectionObserverStub,
  });
}

afterEach(() => {
  cleanup();
});
