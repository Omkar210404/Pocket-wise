/** How a budget's "percent used" is drawn. Kept apart from the component so it can be tested. */

export type MeterTone = 'ok' | 'near' | 'over';

/** From this share of a budget upwards, the meter warns that the limit is close. */
export const NEAR_LIMIT_PERCENT = 85;

export interface MeterState {
  /** Width of the fill, 0 to 100. Never wider than the track. */
  fill: number;
  tone: MeterTone;
}

/**
 * `percent` is the API's `percent_used`: spent as a percentage of the budget,
 * above 100 when over budget, null when there is no budget to measure against.
 */
export function meterState(percent: number | null): MeterState {
  if (percent === null || Number.isNaN(percent)) return { fill: 0, tone: 'ok' };
  const fill = Math.min(100, Math.max(0, percent));
  if (percent > 100) return { fill, tone: 'over' };
  if (percent >= NEAR_LIMIT_PERCENT) return { fill, tone: 'near' };
  return { fill, tone: 'ok' };
}
