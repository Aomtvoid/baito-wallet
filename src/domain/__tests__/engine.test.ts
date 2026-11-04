import { describe, expect, it } from 'vitest';
import { calculateShiftBreakdown } from '../wageEngine';
import {
  buildDailyNetMinutesMap,
  evaluateDayRollingCompliance,
  getRolling7DayMinutesEndingOn,
} from '../visaEngine';
import {
  calculateAnnualTaxSummary,
  resolveShiftPaydayDate,
} from '../paydayEngine';
import { Employer, Shift } from '../types';

describe('Step 1: Chronological Wage, Midnight & Overtime Engine', () => {
  it('calculates Amazon night shift (20:00 -> 06:00, 60m break) with 05:00-06:00 OT at 1.25x', () => {
    // 20:00 to 06:00 = 10h gross (600 mins), 60m break -> 9h (540 mins) net work.
    // Break is taken during midnight window (is_midnight_break: true).
    // 20:00-22:00 = 120m regular normal (1.0x)
    // 22:00-05:00 = 420m gross midnight - 60m break = 360m midnight normal (1.25x).
    // Cumulative net worked minutes at 05:00 = 120 + 360 = 480m (exactly 8 hours!).
    // 05:00-06:00 = 60m after 05:00 AND after 480th net minute -> regular_overtime_minutes = 60m (1.25x, NOT 1.50x!).
    const amazonShift: Shift = {
      id: 'amz-1',
      employer_id: 'amazon',
      start_at: '2026-11-05T20:00',
      end_at: '2026-11-06T06:00',
      break_minutes: 60,
      is_midnight_break: true,
      applied_hourly_yen: 1200,
      applied_transport_yen: 500,
      pays_overtime_after_8h: true,
    };

    const res = calculateShiftBreakdown(amazonShift);
    expect(res.gross_duration_minutes).toBe(600);
    expect(res.net_work_minutes).toBe(540);
    expect(res.regular_normal_minutes).toBe(120); // 20:00-22:00 (1.0x)
    expect(res.midnight_normal_minutes).toBe(360); // 22:00-05:00 minus 60m break (1.25x)
    expect(res.regular_overtime_minutes).toBe(60); // 05:00-06:00 (1.25x)
    expect(res.midnight_overtime_minutes).toBe(0); // 0m at 1.50x!

    // Base: 9h * 1200 = 10,800
    // Midnight bonus: 6h * 1200 * 0.25 = 1,800
    // Overtime bonus: 1h * 1200 * 0.25 = 300
    // Taxable wage = 12,900; Total payout with 500 transport = 13,400
    expect(res.taxable_wage_yen).toBe(12900);
    expect(res.total_payout_yen).toBe(13400);
  });

  it('stacks midnight (+25%) and overtime (+25%) to 1.50x when >8h occurs inside 22:00-05:00', () => {
    // 18:00 to 04:00 = 10h gross, 60m break before 22:00 -> 9h net work.
    // 18:00-22:00 = 4h gross - 1h break = 3h (180m) regular normal.
    // 22:00-03:00 = 5h (300m) midnight normal (reaches 480m net at 03:00).
    // 03:00-04:00 = 1h (60m) inside 22:00-05:00 AND >480m -> 60m midnight_overtime_minutes (1.50x).
    const shift: Shift = {
      id: 's-stack',
      employer_id: 'amz',
      start_at: '2026-11-05T18:00',
      end_at: '2026-11-06T04:00',
      break_minutes: 60,
      is_midnight_break: false,
      applied_hourly_yen: 1000,
      applied_transport_yen: 0,
      pays_overtime_after_8h: true,
    };

    const res = calculateShiftBreakdown(shift);
    expect(res.regular_normal_minutes).toBe(180);
    expect(res.midnight_normal_minutes).toBe(300);
    expect(res.midnight_overtime_minutes).toBe(60);
    // 3h * 1000 + 5h * 1250 + 1h * 1500 = 3000 + 6250 + 1500 = 10,750
    expect(res.taxable_wage_yen).toBe(10750);
  });

  it('respects pays_overtime_after_8h = false for jobs that do not pay >8h overtime', () => {
    const shift: Shift = {
      id: 's-no-ot',
      employer_id: 'izakaya',
      start_at: '2026-11-05T10:00',
      end_at: '2026-11-05T20:00', // 10h gross, 1h break -> 9h net
      break_minutes: 60,
      is_midnight_break: false,
      applied_hourly_yen: 1100,
      applied_transport_yen: 400,
      pays_overtime_after_8h: false,
    };

    const res = calculateShiftBreakdown(shift);
    expect(res.net_work_minutes).toBe(540);
    expect(res.regular_overtime_minutes).toBe(0);
    expect(res.taxable_wage_yen).toBe(9 * 1100);
  });
});

describe('Step 1: Overnight 00:00 Split & Rolling 7-Day Visa Window (28h / 40h)', () => {
  it('splits an overnight shift (21:00 Fri -> 02:00 Sat) strictly at 00:00 JST', () => {
    const overnight: Shift = {
      id: 'ov-1',
      employer_id: 'izakaya',
      start_at: '2026-11-06T21:00', // Friday
      end_at: '2026-11-07T02:00', // Saturday
      break_minutes: 0,
      is_midnight_break: false,
      applied_hourly_yen: 1200,
      applied_transport_yen: 0,
      pays_overtime_after_8h: true,
    };

    const dailyMap = buildDailyNetMinutesMap([overnight]);
    expect(dailyMap['2026-11-06']).toBe(180); // 21:00-00:00 = 3h
    expect(dailyMap['2026-11-07']).toBe(120); // 00:00-02:00 = 2h
  });

  it('flags rolling 7-day window > 28h in semester mode and allows up to 40h in vacation mode', () => {
    // 6 days of 4.5 hours (270 mins/day) = 27 hours (1620 mins) from Nov 1 to Nov 6
    const shifts: Shift[] = [1, 2, 3, 4, 5, 6].map((day) => ({
      id: `d-${day}`,
      employer_id: 'job1',
      start_at: `2026-11-0${day}T10:00`,
      end_at: `2026-11-0${day}T14:30`,
      break_minutes: 0,
      is_midnight_break: false,
      applied_hourly_yen: 1200,
      applied_transport_yen: 0,
      pays_overtime_after_8h: true,
    }));

    const mapBefore = buildDailyNetMinutesMap(shifts);
    expect(getRolling7DayMinutesEndingOn(mapBefore, '2026-11-07')).toBe(1620); // 27h

    // On Nov 7, only 60 mins (1h) remain before hitting 28h
    const checkBefore = evaluateDayRollingCompliance(mapBefore, '2026-11-07', false);
    expect(checkBefore.is_over_limit).toBe(false);
    expect(checkBefore.remaining_safe_minutes_on_day).toBe(60);

    // Add a 2-hour shift on Nov 7 -> total = 29h (1740 mins)
    shifts.push({
      id: 'd-7',
      employer_id: 'job1',
      start_at: '2026-11-07T10:00',
      end_at: '2026-11-07T12:00',
      break_minutes: 0,
      is_midnight_break: false,
      applied_hourly_yen: 1200,
      applied_transport_yen: 0,
      pays_overtime_after_8h: true,
    });

    const mapAfter = buildDailyNetMinutesMap(shifts);
    const semesterEval = evaluateDayRollingCompliance(mapAfter, '2026-11-07', false);
    expect(semesterEval.is_over_limit).toBe(true);
    expect(semesterEval.peak_overlapping_7day_minutes).toBe(1740); // 29h

    // Turn on Vacation Mode (40h cap = 2400 mins) -> 29h is well within 40h
    const vacationEval = evaluateDayRollingCompliance(mapAfter, '2026-11-07', true);
    expect(vacationEval.is_over_limit).toBe(false);
    expect(vacationEval.remaining_safe_minutes_on_day).toBe(2400 - 1740);
  });
});

describe('Step 1: Shimebi / Shiharaibi Payday & NTA Tax Walls (¥1.03M / ¥1.3M)', () => {
  const izakaya: Employer = {
    id: 'izakaya',
    name: 'Torikizoku',
    color: '#f59e0b',
    base_hourly_yen: 1200,
    weekend_hourly_bonus_yen: 100,
    midnight_bonus_rate: 0.25,
    pays_overtime_after_8h: true,
    transport_per_shift_yen: 500,
    cutoff_day: 15, // Closes on the 15th
    pay_month_offset: 0, // Paid same month
    pay_day: 25, // Paid on the 25th
  };

  const conbini: Employer = {
    id: 'conbini',
    name: '7-Eleven',
    color: '#10b981',
    base_hourly_yen: 1150,
    weekend_hourly_bonus_yen: 0,
    midnight_bonus_rate: 0.25,
    pays_overtime_after_8h: true,
    transport_per_shift_yen: 400,
    cutoff_day: 99, // Closes End of Month
    pay_month_offset: 1, // Paid next month
    pay_day: 15, // Paid 15th of next month
  };

  it('assigns Nov 14 shift to Nov 25 payday, and Nov 16 shift to Dec 25 payday (15th cutoff)', () => {
    expect(resolveShiftPaydayDate('2026-11-14T18:00', izakaya)).toBe('2026-11-25');
    expect(resolveShiftPaydayDate('2026-11-15T18:00', izakaya)).toBe('2026-11-25');
    expect(resolveShiftPaydayDate('2026-11-16T18:00', izakaya)).toBe('2026-12-25');
  });

  it('assigns December shift with next-month payday to next calendar year tax wall', () => {
    const decShiftPaidInJan: Shift = {
      id: 'dec-1',
      employer_id: 'conbini',
      start_at: '2026-12-20T09:00',
      end_at: '2026-12-20T14:00', // 5h * 1150 = 5,750 wage + 400 transport
      break_minutes: 0,
      is_midnight_break: false,
      applied_hourly_yen: 1150,
      applied_transport_yen: 400,
      pays_overtime_after_8h: true,
    };

    expect(resolveShiftPaydayDate(decShiftPaidInJan.start_at, conbini)).toBe('2027-01-15');

    const tax2026 = calculateAnnualTaxSummary([decShiftPaidInJan], [conbini], 2026);
    expect(tax2026.total_taxable_yen).toBe(0);

    const tax2027 = calculateAnnualTaxSummary([decShiftPaidInJan], [conbini], 2027);
    expect(tax2027.total_taxable_yen).toBe(5750); // 1.03M wall excludes transport
    expect(tax2027.total_social_insurance_yen).toBe(6150); // 1.30M wall includes transport
  });
});
