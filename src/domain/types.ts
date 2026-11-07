export interface Employer {
  id: string;
  name: string;
  color: string;
  base_hourly_yen: number;
  weekend_hourly_bonus_yen: number;
  midnight_bonus_rate: number; // default 0.25 (25% bonus between 22:00-05:00)
  pays_overtime_after_8h: boolean; // +25% after 480 net work minutes
  transport_per_shift_yen: number; // tax-exempt for 1.03M wall, included in bank & 1.3M wall
  cutoff_day: number; // 1-28, or 99 for End of Month (Shimebi)
  pay_month_offset: 0 | 1; // 0 = same month as cutoff, 1 = next month
  pay_day: number; // 1-28, or 99 for End of Month (Shiharaibi)
}

export interface ShiftTemplate {
  id: string;
  employer_id: string;
  label: string;
  start_time: string; // "HH:mm" in JST, e.g. "21:00"
  end_time: string; // "HH:mm" in JST, e.g. "06:00" (if <= start_time, crosses midnight to next day)
  break_minutes: number;
  is_midnight_break: boolean; // false = deduct break from regular (05:00-22:00) first; true = deduct from 22:00-05:00 first
}

export interface Shift {
  id: string;
  employer_id: string;
  start_at: string; // ISO-8601 string with +09:00 or local JST "YYYY-MM-DDTHH:mm"
  end_at: string;
  break_minutes: number;
  is_midnight_break: boolean;
  applied_hourly_yen: number;
  applied_transport_yen: number;
  pays_overtime_after_8h: boolean;
  midnight_bonus_rate?: number; // defaults to 0.25
}

export interface AppSettings {
  vacation_mode_active: boolean; // false = 28h rolling 7-day target, true = 40h target
  tax_wall_target_yen: 1030000 | 1300000;
  theme?: 'paper' | 'dark';
  shift_view_mode?: 'stream' | 'grid';
  calendar_show_pay?: boolean;
  calendar_show_rolling_hours?: boolean;
}

export interface ShiftWageBreakdown {
  gross_duration_minutes: number;
  net_work_minutes: number;
  regular_normal_minutes: number; // 1.0x
  midnight_normal_minutes: number; // 1.25x (22:00-05:00 within first 8h)
  regular_overtime_minutes: number; // 1.25x (>8h outside 22:00-05:00, e.g. 05:00-06:00)
  midnight_overtime_minutes: number; // 1.50x (>8h inside 22:00-05:00)
  base_wage_yen: number;
  midnight_bonus_yen: number;
  overtime_bonus_yen: number;
  taxable_wage_yen: number; // base + midnight + overtime
  transport_yen: number;
  total_payout_yen: number; // taxable_wage_yen + transport_yen
  daily_net_minutes_by_date: Record<string, number>; // "YYYY-MM-DD" -> net worked minutes on that date
}

export interface RollingWindowDaySummary {
  date: string; // "YYYY-MM-DD"
  daily_net_minutes: number;
  rolling_7day_minutes: number; // sum of [D-6 .. D]
  peak_overlapping_7day_minutes: number; // max of any 7-day window containing D
  remaining_safe_minutes_on_day: number; // how many more minutes can be added on D without exceeding limit
  limit_minutes: number; // 1680 (28h) or 2400 (40h)
  is_over_limit: boolean;
}

export interface PaycheckBucket {
  payday_date: string; // "YYYY-MM-DD"
  employer_id: string;
  employer_name: string;
  employer_color: string;
  period_label: string;
  shift_count: number;
  earned_payout_yen: number;
  planned_payout_yen: number;
  total_payout_yen: number;
  taxable_wage_yen: number;
  transport_yen: number;
}
