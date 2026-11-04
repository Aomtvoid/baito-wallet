import { RollingWindowDaySummary, Shift } from './types';
import { calculateShiftBreakdown } from './wageEngine';

/**
 * Adds `days` (positive or negative) to a "YYYY-MM-DD" date string in pure UTC/JST calendar math.
 */
export function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Aggregates all shifts into a map of "YYYY-MM-DD" -> total net worked minutes on that date.
 * Overnight shifts are automatically split at 00:00 JST by `calculateShiftBreakdown`.
 */
export function buildDailyNetMinutesMap(shifts: Shift[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const shift of shifts) {
    const breakdown = calculateShiftBreakdown(shift);
    for (const [dateStr, mins] of Object.entries(breakdown.daily_net_minutes_by_date)) {
      map[dateStr] = (map[dateStr] ?? 0) + mins;
    }
  }
  return map;
}

/**
 * Sums net worked minutes in the 7-day window ending on `endDateStr` inclusive: `[endDateStr - 6 days .. endDateStr]`.
 */
export function getRolling7DayMinutesEndingOn(
  dailyMap: Record<string, number>,
  endDateStr: string
): number {
  let sum = 0;
  for (let offset = -6; offset <= 0; offset++) {
    const d = addDaysToDateStr(endDateStr, offset);
    sum += dailyMap[d] ?? 0;
  }
  return sum;
}

/**
 * Evaluates a target calendar date `dateStr` against all 7 rolling windows that contain `dateStr`:
 * `[dateStr - 6 .. dateStr]`, `[dateStr - 5 .. dateStr + 1]`, ..., `[dateStr .. dateStr + 6]`.
 *
 * This guarantees that when a student plans shifts ahead of time on a calendar, adding a shift on `dateStr`
 * immediately checks both backward-looking and forward-looking 7-day windows.
 */
export function evaluateDayRollingCompliance(
  dailyMap: Record<string, number>,
  dateStr: string,
  vacationModeActive: boolean
): RollingWindowDaySummary {
  const limitMinutes = (vacationModeActive ? 40 : 28) * 60;
  const dailyNetMinutes = dailyMap[dateStr] ?? 0;
  const rolling7DayMinutes = getRolling7DayMinutesEndingOn(dailyMap, dateStr);

  let peakOverlapping7DayMinutes = 0;
  for (let windowEndOffset = 0; windowEndOffset <= 6; windowEndOffset++) {
    const windowEndDate = addDaysToDateStr(dateStr, windowEndOffset);
    const windowSum = getRolling7DayMinutesEndingOn(dailyMap, windowEndDate);
    if (windowSum > peakOverlapping7DayMinutes) {
      peakOverlapping7DayMinutes = windowSum;
    }
  }

  const remainingSafeMinutesOnDay = Math.max(0, limitMinutes - peakOverlapping7DayMinutes);

  return {
    date: dateStr,
    daily_net_minutes: dailyNetMinutes,
    rolling_7day_minutes: rolling7DayMinutes,
    peak_overlapping_7day_minutes: peakOverlapping7DayMinutes,
    remaining_safe_minutes_on_day: remainingSafeMinutesOnDay,
    limit_minutes: limitMinutes,
    is_over_limit: peakOverlapping7DayMinutes > limitMinutes,
  };
}
