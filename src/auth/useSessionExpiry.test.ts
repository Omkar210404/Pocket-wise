import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSessionExpiry } from './useSessionExpiry';

describe('useSessionExpiry', () => {
  beforeEach(() => {
    // Here the timers are faked too, not only the clock.
    vi.useFakeTimers();
  });

  it('calls onExpire when the token lifetime runs out, and not before', () => {
    const onExpire = vi.fn();
    renderHook(() => useSessionExpiry(Date.now() + 30 * 60_000, onExpire));

    vi.advanceTimersByTime(30 * 60_000 - 1);
    expect(onExpire).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('expires at once when the time has already passed', () => {
    const onExpire = vi.fn();
    renderHook(() => useSessionExpiry(Date.now() - 1, onExpire));
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('does nothing without a session', () => {
    const onExpire = vi.fn();
    renderHook(() => useSessionExpiry(null, onExpire));

    vi.advanceTimersByTime(24 * 60 * 60_000);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('checks again when the tab gets focus, in case the timer was held back', () => {
    const onExpire = vi.fn();
    renderHook(() => useSessionExpiry(Date.now() + 60_000, onExpire));

    // The clock moves on without the timer firing, as in a sleeping laptop.
    vi.setSystemTime(Date.now() + 61_000);
    expect(onExpire).not.toHaveBeenCalled();

    window.dispatchEvent(new Event('focus'));
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('stops watching when the session ends', () => {
    const onExpire = vi.fn();
    const { rerender } = renderHook(
      ({ expiresAt }: { expiresAt: number | null }) => useSessionExpiry(expiresAt, onExpire),
      { initialProps: { expiresAt: Date.now() + 60_000 } as { expiresAt: number | null } },
    );

    rerender({ expiresAt: null });
    vi.advanceTimersByTime(120_000);
    expect(onExpire).not.toHaveBeenCalled();
  });
});
