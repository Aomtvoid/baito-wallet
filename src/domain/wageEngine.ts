import { Shift, ShiftWageBreakdown } from './types';

/**
 * Parses a JST timestamp ("YYYY-MM-DDTHH:mm" or ISO with +09:00) into epoch ms,
 * treating naive strings as JST (+09:00) so calculations are 100% deterministic regardless of host OS timezone.
 */
export function parseJstTimestampMs(isoOrLocal: string): number {
  const trimmed = isoOrLocal.trim();
  if (trimmed.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return new Date(trimmed).getTime();
  }
  const normalized = trimmed.length === 16 ? `${trimmed}:00+09:00` : `${trimmed}+09:00`;
  return new Date(normalized).getTime();
}

/**
 * Returns the JST date string "YYYY-MM-DD" and minute-of-day (0..1439) for a given epoch ms.
 */
export function getJstDateAndMinute(epochMs: number): { dateStr: string; minuteOfDay: number; dayOfWeek: number } {
  // Shift by +9 hours and read UTC fields for deterministic JST calendar math
  const jstMs = epochMs + 9 * 3600 * 1000;
  const d = new Date(jstMs);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hours = d.getUTCHours();
  const mins = d.getUTCMinutes();
  return {
    dateStr: `${year}-${month}-${day}`,
    minuteOfDay: hours * 60 + mins,
    dayOfWeek: d.getUTCDay(), // 0 = Sun, 6 = Sat
  };
}

export function isMidnightMinute(minuteOfDay: number): boolean {
  // 22:00 (1320) to 24:00 (1440) OR 00:00 (0) to 05:00 (300)
  return minuteOfDay >= 22 * 60 || minuteOfDay < 5 * 60;
}

/**
 * Chronologically walks a shift minute-by-minute in JST:
 * 1. Categorizes each gross minute as Regular (05:00-22:00) or Midnight (22:00-05:00).
 * 2. Deducts `break_minutes` from the target bucket (`is_midnight_break` ? Midnight first : Regular first),
 *    spilling over to the other bucket if break exceeds that bucket's minutes.
 * 3. Walks the remaining worked minutes chronologically, tracking cumulative net worked minutes.
 *    Once cumulative net worked minutes exceed 480 (8 hours) AND `pays_overtime_after_8h` is true,
 *    subsequent worked minutes earn the +25% overtime bonus.
 * 4. Records exact net worked minutes per JST calendar date ("YYYY-MM-DD") for the 28h/40h visa engine.
 */
export function calculateShiftBreakdown(shift: Shift): ShiftWageBreakdown {
  const startMs = parseJstTimestampMs(shift.start_at);
  const endMs = parseJstTimestampMs(shift.end_at);
  const grossMinutes = Math.max(0, Math.round((endMs - startMs) / 60000));
  const clampedBreak = Math.min(grossMinutes, Math.max(0, Math.round(shift.break_minutes)));

  // Step 1: Build minute timeline
  interface MinuteSlot {
    dateStr: string;
    isMidnight: boolean;
    isBreak: boolean;
  }

  const timeline: MinuteSlot[] = [];
  for (let i = 0; i < grossMinutes; i++) {
    const currentMs = startMs + i * 60000;
    const { dateStr, minuteOfDay } = getJstDateAndMinute(currentMs);
    timeline.push({
      dateStr,
      isMidnight: isMidnightMinute(minuteOfDay),
      isBreak: false,
    });
  }

  // Step 2: Mark break minutes deterministically from the preferred window first
  let breakRemaining = clampedBreak;
  const preferMidnight = shift.is_midnight_break;

  for (const slot of timeline) {
    if (breakRemaining <= 0) break;
    if (slot.isMidnight === preferMidnight) {
      slot.isBreak = true;
      breakRemaining--;
    }
  }
  // Spillover if break_minutes > minutes available in preferred window
  for (const slot of timeline) {
    if (breakRemaining <= 0) break;
    if (!slot.isBreak) {
      slot.isBreak = true;
      breakRemaining--;
    }
  }

  // Step 3: Walk chronologically to tally multipliers and per-date net minutes
  let netWorkMinutes = 0;
  let regularNormalMinutes = 0;
  let midnightNormalMinutes = 0;
  let regularOvertimeMinutes = 0;
  let midnightOvertimeMinutes = 0;
  const dailyNetMinutesByDate: Record<string, number> = {};

  for (const slot of timeline) {
    if (slot.isBreak) continue;

    netWorkMinutes++;
    dailyNetMinutesByDate[slot.dateStr] = (dailyNetMinutesByDate[slot.dateStr] ?? 0) + 1;

    const isOvertime = shift.pays_overtime_after_8h && netWorkMinutes > 480;
    if (slot.isMidnight && isOvertime) {
      midnightOvertimeMinutes++;
    } else if (slot.isMidnight && !isOvertime) {
      midnightNormalMinutes++;
    } else if (!slot.isMidnight && isOvertime) {
      regularOvertimeMinutes++;
    } else {
      regularNormalMinutes++;
    }
  }

  const hourly = shift.applied_hourly_yen;
  const midnightRate = shift.midnight_bonus_rate ?? 0.25;
  const overtimeRate = 0.25;

  const baseWageYen = (netWorkMinutes / 60) * hourly;
  const midnightBonusYen =
    ((midnightNormalMinutes + midnightOvertimeMinutes) / 60) * hourly * midnightRate;
  const overtimeBonusYen =
    ((regularOvertimeMinutes + midnightOvertimeMinutes) / 60) * hourly * overtimeRate;

  const taxableWageYen = Math.round(baseWageYen + midnightBonusYen + overtimeBonusYen);
  const transportYen = grossMinutes > 0 ? Math.max(0, Math.round(shift.applied_transport_yen)) : 0;

  return {
    gross_duration_minutes: grossMinutes,
    net_work_minutes: netWorkMinutes,
    regular_normal_minutes: regularNormalMinutes,
    midnight_normal_minutes: midnightNormalMinutes,
    regular_overtime_minutes: regularOvertimeMinutes,
    midnight_overtime_minutes: midnightOvertimeMinutes,
    base_wage_yen: Math.round(baseWageYen),
    midnight_bonus_yen: Math.round(midnightBonusYen),
    overtime_bonus_yen: Math.round(overtimeBonusYen),
    taxable_wage_yen: taxableWageYen,
    transport_yen: transportYen,
    total_payout_yen: taxableWageYen + transportYen,
    daily_net_minutes_by_date: dailyNetMinutesByDate,
  };
}
