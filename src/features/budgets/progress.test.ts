import { describe, expect, it } from 'vitest';

import { meterState } from './progress';

describe('meterState', () => {
  it('is calm below the near-limit mark', () => {
    expect(meterState(0)).toEqual({ fill: 0, tone: 'ok' });
    expect(meterState(62.5)).toEqual({ fill: 62.5, tone: 'ok' });
    expect(meterState(84.9)).toEqual({ fill: 84.9, tone: 'ok' });
  });

  it('warns from 85% up to and including 100%', () => {
    expect(meterState(85)).toEqual({ fill: 85, tone: 'near' });
    expect(meterState(100)).toEqual({ fill: 100, tone: 'near' });
  });

  it('marks anything above 100% as over, and never draws past the track', () => {
    expect(meterState(100.1)).toEqual({ fill: 100, tone: 'over' });
    expect(meterState(240)).toEqual({ fill: 100, tone: 'over' });
  });

  it('draws nothing when there is no budget to measure against', () => {
    expect(meterState(null)).toEqual({ fill: 0, tone: 'ok' });
  });
});
