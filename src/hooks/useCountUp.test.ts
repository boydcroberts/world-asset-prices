import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useCountUp } from "./useCountUp";

// The test env reports prefers-reduced-motion (see src/test/setup.ts), so the
// count-up animation is suppressed and the hook resolves straight to its target —
// a deterministic surface to assert the value-tracking contract.
describe("useCountUp", () => {
  it("returns the target immediately under reduced motion", () => {
    const { result } = renderHook(() => useCountUp(120, { from: 100 }));
    expect(result.current).toBe(120);
  });

  it("passes through null", () => {
    const { result } = renderHook(() => useCountUp(null, { from: 100 }));
    expect(result.current).toBeNull();
  });

  it("tracks live updates after the first valid value", () => {
    const { result, rerender } = renderHook(({ t }) => useCountUp(t, { from: 100 }), {
      initialProps: { t: 120 as number | null },
    });
    expect(result.current).toBe(120);
    act(() => rerender({ t: 135 }));
    expect(result.current).toBe(135);
    act(() => rerender({ t: 128 }));
    expect(result.current).toBe(128);
  });
});
