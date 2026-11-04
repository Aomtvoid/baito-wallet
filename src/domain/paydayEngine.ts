import { Employer, PaycheckBucket, Shift } from './types';
import { calculateShiftBreakdown, getJstDateAndMinute, parseJstTimestampMs } from './wageEngine';

/**
 * Returns the last day of a given (year, month 1..12), e.g. (2026, 2) -> 28.
 */
export function getLastDayOfMonth(year: number, month1To12: number): number {
  return new Date(Date.UTC(year, month1To12, 0)).getUTCDate();
}

function clampDay(year: number, month1To12: number, dayOr99: number): number {
  const lastDay = getLastDayOfMonth(year, month1To12);
  if (dayOr99 >= 99) return lastDay;
  return Math.min(Math.max(1, dayOr99), lastDay);
}

function formatYmd(year: number, month1To12: number, day: number): string {
  return `${year}-${String(month1To12).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Maps a shift's start date in JST to its exact Employer Payday ("YYYY-MM-DD") based on
 * Japanese Shimebi (`cutoff_day`) and Shiharaibi (`pay_month_offset`, `pay_day`).
 */
export function resolveShiftPaydayDate(shiftStartAt: string, employer: Employer): string {
  const startMs = parseJstTimestampMs(shiftStartAt);
  const { dateStr } = getJstDateAndMinute(startMs);
  const [y, m, d] = dateStr.split('-').map(Number);

  const effectiveCutoffThisMonth = clampDay(y, m, employer.cutoff_day);

  // If the shift is worked after this month's cutoff day (e.g. worked Nov 16 when cutoff is 15th),
  // it belongs to NEXT month's cutoff cycle.
  let cutoffYear = y;
  let cutoffMonth = m;
  if (d > effectiveCutoffThisMonth) {
    cutoffMonth += 1;
    if (cutoffMonth > 12) {
      cutoffMonth = 1;
      cutoffYear += 1;
    }
  }

  // Payday is `pay_month_offset` months after the cutoff cycle's month
  let payYear = cutoffYear;
  let payMonth = cutoffMonth + employer.pay_month_offset;
  while (payMonth > 12) {
    payMonth -= 12;
    payYear += 1;
  }

  const effectivePayDay = clampDay(payYear, payMonth, employer.pay_day);
  return formatYmd(payYear, payMonth, effectivePayDay);
}

export function isShiftEarned(shift: Shift, nowMs: number = Date.now()): boolean {
  return parseJstTimestampMs(shift.end_at) <= nowMs;
}

/**
 * Groups shifts by (payday_date, employer_id) to power the "Money I Will Receive" cashflow view.
 */
export function buildPaycheckBuckets(
  shifts: Shift[],
  employers: Employer[],
  nowMs: number = Date.now()
): PaycheckBucket[] {
  const empMap = new Map<string, Employer>(employers.map((e) => [e.id, e]));
  const bucketMap = new Map<string, PaycheckBucket>();

  for (const shift of shifts) {
    const employer = empMap.get(shift.employer_id);
    if (!employer) continue;

    const paydayDate = resolveShiftPaydayDate(shift.start_at, employer);
    const key = `${paydayDate}__${employer.id}`;
    const breakdown = calculateShiftBreakdown(shift);
    const earned = isShiftEarned(shift, nowMs);

    let bucket = bucketMap.get(key);
    if (!bucket) {
      bucket = {
        payday_date: paydayDate,
        employer_id: employer.id,
        employer_name: employer.name,
        employer_color: employer.color,
        period_label:
          employer.cutoff_day >= 99 ? 'End-of-month cutoff' : `Closes ${employer.cutoff_day}th`,
        shift_count: 0,
        earned_payout_yen: 0,
        planned_payout_yen: 0,
        total_payout_yen: 0,
        taxable_wage_yen: 0,
        transport_yen: 0,
      };
      bucketMap.set(key, bucket);
    }

    bucket.shift_count += 1;
    if (earned) {
      bucket.earned_payout_yen += breakdown.total_payout_yen;
    } else {
      bucket.planned_payout_yen += breakdown.total_payout_yen;
    }
    bucket.total_payout_yen += breakdown.total_payout_yen;
    bucket.taxable_wage_yen += breakdown.taxable_wage_yen;
    bucket.transport_yen += breakdown.transport_yen;
  }

  return Array.from(bucketMap.values()).sort((a, b) =>
    a.payday_date.localeCompare(b.payday_date)
  );
}

export interface AnnualTaxSummary {
  tax_year: number;
  earned_taxable_yen: number; // Counts toward 1.03M wall (earned shifts paid in tax_year)
  planned_taxable_yen: number; // Counts toward 1.03M wall (upcoming shifts paid in tax_year)
  total_taxable_yen: number; // earned + planned taxable wage
  total_social_insurance_yen: number; // taxable wage + transport (counts toward 1.30M wall)
}

/**
 * Calculates NTA annual income for `taxYear` (Jan 1 - Dec 31) strictly based on PAYDAY date (Shiharaibi).
 */
export function calculateAnnualTaxSummary(
  shifts: Shift[],
  employers: Employer[],
  taxYear: number,
  nowMs: number = Date.now()
): AnnualTaxSummary {
  const empMap = new Map<string, Employer>(employers.map((e) => [e.id, e]));
  let earnedTaxableYen = 0;
  let plannedTaxableYen = 0;
  let totalTransportYen = 0;

  const yearPrefix = `${taxYear}-`;

  for (const shift of shifts) {
    const employer = empMap.get(shift.employer_id);
    if (!employer) continue;

    const paydayDate = resolveShiftPaydayDate(shift.start_at, employer);
    if (!paydayDate.startsWith(yearPrefix)) continue;

    const breakdown = calculateShiftBreakdown(shift);
    if (isShiftEarned(shift, nowMs)) {
      earnedTaxableYen += breakdown.taxable_wage_yen;
    } else {
      plannedTaxableYen += breakdown.taxable_wage_yen;
    }
    totalTransportYen += breakdown.transport_yen;
  }

  const totalTaxableYen = earnedTaxableYen + plannedTaxableYen;

  return {
    tax_year: taxYear,
    earned_taxable_yen: earnedTaxableYen,
    planned_taxable_yen: plannedTaxableYen,
    total_taxable_yen: totalTaxableYen,
    total_social_insurance_yen: totalTaxableYen + totalTransportYen,
  };
}
