import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings, Employer, Shift, ShiftTemplate } from '../domain/types';
import { addDaysToDateStr } from '../domain/visaEngine';

const STORAGE_KEY = 'baito_wallet_v1_state';

export interface BaitoWalletState {
  employers: Employer[];
  templates: ShiftTemplate[];
  shifts: Shift[];
  settings: AppSettings;
}

export const DEFAULT_EMPLOYERS: Employer[] = [
  {
    id: 'emp-amazon',
    name: 'Amazon',
    color: '#4A6278',
    base_hourly_yen: 1300,
    weekend_hourly_bonus_yen: 0,
    midnight_bonus_rate: 0.25,
    pays_overtime_after_8h: true,
    transport_per_shift_yen: 500,
    cutoff_day: 99,
    pay_month_offset: 1,
    pay_day: 25,
  },
  {
    id: 'emp-izakaya',
    name: 'Izakaya',
    color: '#B86B4B',
    base_hourly_yen: 1200,
    weekend_hourly_bonus_yen: 100,
    midnight_bonus_rate: 0.25,
    pays_overtime_after_8h: false,
    transport_per_shift_yen: 440,
    cutoff_day: 15,
    pay_month_offset: 0,
    pay_day: 25,
  },
];

export const DEFAULT_TEMPLATES: ShiftTemplate[] = [
  {
    id: 'tpl-amz-night',
    employer_id: 'emp-amazon',
    label: 'Amazon Night',
    start_time: '21:00',
    end_time: '06:00',
    break_minutes: 60,
    is_midnight_break: true,
  },
  {
    id: 'tpl-izk-dinner',
    employer_id: 'emp-izakaya',
    label: 'Izakaya Eve',
    start_time: '18:00',
    end_time: '23:00',
    break_minutes: 0,
    is_midnight_break: false,
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  vacation_mode_active: false,
  tax_wall_target_yen: 1030000,
  theme: 'paper',
  shift_view_mode: 'stream',
  calendar_show_pay: false,
  calendar_show_rolling_hours: false,
};

export function getInitialWalletState(): BaitoWalletState {
  return {
    employers: DEFAULT_EMPLOYERS,
    templates: DEFAULT_TEMPLATES,
    shifts: [],
    settings: DEFAULT_SETTINGS,
  };
}

export async function loadWalletStateAsync(): Promise<BaitoWalletState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return getInitialWalletState();
    const parsed = JSON.parse(raw) as Partial<BaitoWalletState>;
    return {
      employers: parsed.employers ?? DEFAULT_EMPLOYERS,
      templates: parsed.templates ?? DEFAULT_TEMPLATES,
      shifts: parsed.shifts ?? [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch {
    return getInitialWalletState();
  }
}

export async function saveWalletStateAsync(state: BaitoWalletState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage write errors in restricted environments
  }
}

export function isWeekendDateStr(dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 || dow === 6;
}

export function stampShiftFromTemplate(
  dateStr: string,
  template: ShiftTemplate,
  employer: Employer
): Shift {
  const crossesMidnight = template.end_time <= template.start_time;
  const endDateStr = crossesMidnight ? addDaysToDateStr(dateStr, 1) : dateStr;
  const weekendBonus = isWeekendDateStr(dateStr) ? employer.weekend_hourly_bonus_yen : 0;

  return {
    id: `shift-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    employer_id: employer.id,
    start_at: `${dateStr}T${template.start_time}`,
    end_at: `${endDateStr}T${template.end_time}`,
    break_minutes: template.break_minutes,
    is_midnight_break: template.is_midnight_break,
    applied_hourly_yen: employer.base_hourly_yen + weekendBonus,
    applied_transport_yen: employer.transport_per_shift_yen,
    pays_overtime_after_8h: employer.pays_overtime_after_8h,
    midnight_bonus_rate: employer.midnight_bonus_rate,
  };
}
