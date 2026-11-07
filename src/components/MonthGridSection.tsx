import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppSettings, Employer, Shift } from '../domain/types';
import { calculateShiftBreakdown } from '../domain/wageEngine';
import {
  evaluateDayRollingCompliance,
  getLastDayOfMonthForCalendar,
} from './calendarHelpers';
import { ThemePalette } from '../theme/colors';

interface Props {
  shifts: Shift[];
  employers: Employer[];
  settings: AppSettings;
  palette: ThemePalette;
  todayStr: string;
  selectedDateStr: string;
  dailyMap: Record<string, number>;
  onSelectDate: (dateStr: string) => void;
  onEditShift: (dateStr: string, shift: Shift) => void;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const MonthGridSection: React.FC<Props> = ({
  shifts,
  employers,
  settings,
  palette,
  todayStr,
  selectedDateStr,
  dailyMap,
  onSelectDate,
  onEditShift,
}) => {
  const [viewYear, setViewYear] = useState(Number(selectedDateStr.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(Number(selectedDateStr.slice(5, 7)));

  const empMap = new Map(employers.map((e) => [e.id, e]));
  const firstDayDow = new Date(Date.UTC(viewYear, viewMonth - 1, 1)).getUTCDay();
  const daysInMonth = getLastDayOfMonthForCalendar(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 1) {
      setViewYear(viewYear - 1);
      setViewMonth(12);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 12) {
      setViewYear(viewYear + 1);
      setViewMonth(1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const cells: Array<string | null> = [];
  for (let i = 0; i < firstDayDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(
      `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    );
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: Array<Array<string | null>> = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  const monthPrefix = `${viewYear}-${String(viewMonth).padStart(2, '0')}`;
  const monthShifts = shifts.filter((s) => s.start_at.startsWith(monthPrefix));
  let monthMinutes = 0;
  let monthYen = 0;
  for (const s of monthShifts) {
    const b = calculateShiftBreakdown(s);
    monthMinutes += b.net_work_minutes;
    monthYen += b.total_payout_yen;
  }

  const selectedDayShifts = shifts.filter((s) =>
    s.start_at.startsWith(selectedDateStr)
  );

  return (
    <View style={styles.wrapper}>
      {/* Month Bar */}
      <View style={styles.monthBar}>
        <View style={styles.monthNav}>
          <Pressable onPress={prevMonth} style={styles.arrowBtn}>
            <Text style={{ color: palette.textSecondary, fontSize: 16 }}>‹</Text>
          </Pressable>
          <Text style={[styles.monthTitle, { color: palette.textPrimary }]}>
            {MONTH_NAMES[viewMonth - 1]} {viewYear}
          </Text>
          <Pressable onPress={nextMonth} style={styles.arrowBtn}>
            <Text style={{ color: palette.textSecondary, fontSize: 16 }}>›</Text>
          </Pressable>
        </View>
        <Text style={{ fontSize: 12, color: palette.textSecondary }}>
          {(monthMinutes / 60).toFixed(1)}h · ¥{monthYen.toLocaleString()}
        </Text>
      </View>

      {/* Crisp Hairline Month Grid */}
      <View
        style={[
          styles.calendarCard,
          {
            backgroundColor: palette.bgSurface,
            borderColor: palette.borderHairline,
          },
        ]}
      >
        <View
          style={[
            styles.weekHeader,
            {
              backgroundColor: palette.bgSubtle,
              borderBottomColor: palette.borderHairline,
            },
          ]}
        >
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <View key={d} style={styles.weekDayCell}>
              <Text style={{ fontSize: 11, color: palette.textSecondary }}>{d}</Text>
            </View>
          ))}
        </View>

        {rows.map((row, rIdx) => (
          <View
            key={`row-${rIdx}`}
            style={[
              styles.weekRow,
              rIdx < rows.length - 1 && {
                borderBottomWidth: 1,
                borderBottomColor: palette.borderHairline,
              },
            ]}
          >
            {row.map((dateStr, cIdx) => {
              const cellBorderRight =
                cIdx < 6
                  ? { borderRightWidth: 1, borderRightColor: palette.borderHairline }
                  : undefined;

              if (!dateStr) {
                return (
                  <View
                    key={`empty-${rIdx}-${cIdx}`}
                    style={[
                      styles.dayCell,
                      cellBorderRight,
                      { backgroundColor: palette.bgPage, opacity: 0.4 },
                    ]}
                  />
                );
              }

              const dayNum = Number(dateStr.slice(8, 10));
              const dayShifts = shifts.filter((s) => s.start_at.startsWith(dateStr));
              const comp = evaluateDayRollingCompliance(
                dailyMap,
                dateStr,
                settings.vacation_mode_active
              );
              const isSelected = dateStr === selectedDateStr;
              const isToday = dateStr === todayStr;

              return (
                <Pressable
                  key={dateStr}
                  onPress={() => onSelectDate(dateStr)}
                  style={[
                    styles.dayCell,
                    cellBorderRight,
                    comp.is_over_limit && { backgroundColor: palette.warnBg },
                    isSelected && { backgroundColor: palette.bgSubtle },
                  ]}
                >
                  <View style={styles.dayTopRow}>
                    <View
                      style={[
                        styles.dayBadge,
                        isSelected && { backgroundColor: palette.accentInk },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: isToday || isSelected ? '700' : '400',
                          color: isSelected
                            ? palette.accentInkFg
                            : isToday
                            ? palette.textPrimary
                            : palette.textSecondary,
                        }}
                      >
                        {dayNum}
                      </Text>
                    </View>
                    {(comp.is_over_limit ||
                      (settings.calendar_show_rolling_hours &&
                        comp.rolling_7day_minutes > 0)) && (
                      <Text
                        style={{
                          fontSize: 9,
                          color: comp.is_over_limit
                            ? palette.warnText
                            : palette.textMuted,
                        }}
                      >
                        {Math.round(comp.rolling_7day_minutes / 60)}h
                      </Text>
                    )}
                  </View>

                  <View style={styles.markerList}>
                    {dayShifts.slice(0, 2).map((sh) => {
                      const emp = empMap.get(sh.employer_id);
                      const brk = calculateShiftBreakdown(sh);
                      return (
                        <View
                          key={sh.id}
                          style={[
                            styles.shiftMarker,
                            {
                              borderLeftColor: emp?.color ?? '#6E6A63',
                              backgroundColor: palette.bgPage,
                            },
                          ]}
                        >
                          <Text
                            numberOfLines={1}
                            style={{ fontSize: 9, color: palette.textPrimary }}
                          >
                            {settings.calendar_show_pay
                              ? `¥${brk.total_payout_yen}`
                              : sh.start_at.slice(11, 16)}
                          </Text>
                        </View>
                      );
                    })}
                    {dayShifts.length > 2 && (
                      <Text style={{ fontSize: 9, color: palette.textMuted }}>
                        +{dayShifts.length - 2}
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {/* Selected Day Shifts below Month Grid */}
      <View
        style={[
          styles.selectedCard,
          {
            backgroundColor: palette.bgSurface,
            borderColor: palette.borderHairline,
          },
        ]}
      >
        <Text
          style={{
            fontSize: 13,
            fontWeight: '600',
            color: palette.textPrimary,
            marginBottom: 6,
          }}
        >
          Shifts on {selectedDateStr}
        </Text>

        {selectedDayShifts.length === 0 ? (
          <Text style={{ fontSize: 12, color: palette.textMuted }}>
            No shifts on this date. Use the Quick Stamp dock below to add one.
          </Text>
        ) : (
          <View style={{ gap: 6 }}>
            {selectedDayShifts.map((sh) => {
              const emp = empMap.get(sh.employer_id);
              const brk = calculateShiftBreakdown(sh);
              return (
                <Pressable
                  key={sh.id}
                  onPress={() => onEditShift(selectedDateStr, sh)}
                  style={[
                    styles.shiftRow,
                    {
                      backgroundColor: palette.bgSubtle,
                      borderColor: palette.borderHairline,
                    },
                  ]}
                >
                  <View style={styles.shiftRowLeft}>
                    <View
                      style={[
                        styles.colorBar,
                        { backgroundColor: emp?.color ?? '#6E6A63' },
                      ]}
                    />
                    <View>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '600',
                          color: palette.textPrimary,
                        }}
                      >
                        {emp?.name ?? 'Job'} · {sh.start_at.slice(11, 16)}–
                        {sh.end_at.slice(11, 16)}
                      </Text>
                      <Text style={{ fontSize: 11, color: palette.textSecondary }}>
                        {(brk.net_work_minutes / 60).toFixed(1)}h net · Tap to edit
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: palette.textPrimary,
                    }}
                  >
                    ¥{brk.total_payout_yen.toLocaleString()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { gap: 10 },
  monthBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  arrowBtn: { paddingHorizontal: 8, paddingVertical: 2 },
  monthTitle: { fontSize: 14, fontWeight: '600', minWidth: 120, textAlign: 'center' },
  calendarCard: {
    borderWidth: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  weekHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingVertical: 6,
  },
  weekDayCell: { flex: 1, alignItems: 'center' },
  weekRow: { flexDirection: 'row' },
  dayCell: {
    flex: 1,
    minHeight: 60,
    padding: 4,
    justifyContent: 'space-between',
  },
  dayTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayBadge: {
    width: 19,
    height: 19,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerList: { gap: 2, marginTop: 2 },
  shiftMarker: {
    borderLeftWidth: 2,
    paddingLeft: 3,
    paddingVertical: 1,
    borderRadius: 1,
  },
  selectedCard: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 12,
  },
  shiftRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 3,
    padding: 9,
  },
  shiftRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  colorBar: { width: 3, height: 26, borderRadius: 1 },
});
