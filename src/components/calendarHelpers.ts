import { buildDailyNetMinutesMap, evaluateDayRollingCompliance } from '../domain/visaEngine';
import { getLastDayOfMonth } from '../domain/paydayEngine';

export { buildDailyNetMinutesMap, evaluateDayRollingCompliance };

export function getLastDayOfMonthForCalendar(year: number, month1To12: number): number {
  return getLastDayOfMonth(year, month1To12);
}
