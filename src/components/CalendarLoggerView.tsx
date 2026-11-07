import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppSettings, Employer, Shift, ShiftTemplate } from '../domain/types';
import { calculateShiftBreakdown, getJstDateAndMinute } from '../domain/wageEngine';
import {
  addDaysToDateStr,
  buildDailyNetMinutesMap,
  evaluateDayRollingCompliance,
} from '../domain/visaEngine';
import { buildPaycheckBuckets, resolveShiftPaydayDate } from '../domain/paydayEngine';
import { stampShiftFromTemplate } from '../storage/repository';
import { ThemePalette } from '../theme/colors';
import { ShiftEditModal } from './ShiftEditModal';
import { MonthGridSection } from './MonthGridSection';

interface Props {
  shifts: Shift[];
  employers: Employer[];
  templates: ShiftTemplate[];
  settings: AppSettings;
  palette: ThemePalette;
  onUpdateSettings: (next: AppSettings) => void;
  onAddShift: (shift: Shift) => void;
  onUpdateShift: (shift: Shift) => void;
  onDeleteShift: (shiftId: string) => void;
}

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function getDayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function getMondayOfWeek(dateStr: string): string {
  const dow = getDayOfWeek(dateStr);
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  return addDaysToDateStr(dateStr, diffToMonday);
}

function formatReadableDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  const dow = getDayOfWeek(dateStr);
  return `${SHORT_DAYS[dow]}, ${SHORT_MONTHS[m - 1]} ${d}`;
}

export const CalendarLoggerView: React.FC<Props> = ({
  shifts,
  employers,
  templates,
  settings,
  palette,
  onUpdateSettings,
  onAddShift,
  onUpdateShift,
  onDeleteShift,
}) => {
  const todayStr = getJstDateAndMinute(Date.now()).dateStr;
  const [selectedDateStr, setSelectedDateStr] = useState(todayStr);
  const [weekStartMonday, setWeekStartMonday] = useState(() =>
    getMondayOfWeek(todayStr)
  );
  const [modalState, setModalState] = useState<{
    dateStr: string;
    shift?: Shift;
  } | null>(null);

  const viewMode = settings.shift_view_mode ?? 'stream';

  const empMap = new Map(employers.map((e) => [e.id, e]));
  const dailyMap = buildDailyNetMinutesMap(shifts);

  // 7 days of the active week (Mon -> Sun)
  const weekDates = Array.from({ length: 7 }, (_, i) =>
    addDaysToDateStr(weekStartMonday, i)
  );

  const shiftWeek = (deltaDays: number) => {
    const nextMon = addDaysToDateStr(weekStartMonday, deltaDays);
    setWeekStartMonday(nextMon);
    setSelectedDateStr(addDaysToDateStr(selectedDateStr, deltaDays));
  };

  const jumpToToday = () => {
    setSelectedDateStr(todayStr);
    setWeekStartMonday(getMondayOfWeek(todayStr));
  };

  // Selected day compliance & shifts
  const selectedCompliance = evaluateDayRollingCompliance(
    dailyMap,
    selectedDateStr,
    settings.vacation_mode_active
  );

  // Next upcoming paycheck for the Hero Wallet Card
  const allBuckets = buildPaycheckBuckets(shifts, employers);
  const upcomingBuckets = allBuckets.filter((b) => b.payday_date >= todayStr);
  const nextBucket = upcomingBuckets[0];
  const totalUpcomingYen = upcomingBuckets.reduce(
    (acc, b) => acc + b.total_payout_yen,
    0
  );

  // Calculate week's total hours and earnings
  let weekNetMinutes = 0;
  let weekTotalYen = 0;
  for (const dStr of weekDates) {
    weekNetMinutes += dailyMap[dStr] ?? 0;
    const dayStarts = shifts.filter((s) => s.start_at.startsWith(dStr));
    for (const s of dayStarts) {
      weekTotalYen += calculateShiftBreakdown(s).total_payout_yen;
    }
  }

  const handleStampPreset = (tpl: ShiftTemplate) => {
    const emp = empMap.get(tpl.employer_id);
    if (!emp) return;
    onAddShift(stampShiftFromTemplate(selectedDateStr, tpl, emp));
  };

  const visaFillRatio = Math.min(
    1,
    selectedCompliance.rolling_7day_minutes / selectedCompliance.limit_minutes
  );

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. HERO PASSBOOK CARD: Live Payday + 28h Rolling Gauge */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: palette.bgSurface,
              borderColor: palette.borderHairline,
            },
          ]}
        >
          <View style={styles.heroTopRow}>
            <View>
              <Text style={[styles.eyebrow, { color: palette.textMuted }]}>
                PENDING BAITO PAYOUT
              </Text>
              <Text style={[styles.heroYen, { color: palette.textPrimary }]}>
                ¥{totalUpcomingYen.toLocaleString()}
              </Text>
              <Text style={{ fontSize: 11, color: palette.textSecondary, marginTop: 2 }}>
                {nextBucket
                  ? `Next payday: ${nextBucket.payday_date} (${nextBucket.employer_name} · ¥${nextBucket.total_payout_yen.toLocaleString()})`
                  : 'Stamp a shift below to forecast your next paycheck'}
              </Text>
            </View>

            <View
              style={[
                styles.weekSummaryPill,
                {
                  backgroundColor: palette.bgSubtle,
                  borderColor: palette.borderHairline,
                },
              ]}
            >
              <Text style={{ fontSize: 10, color: palette.textMuted }}>THIS WEEK</Text>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: palette.textPrimary,
                  marginTop: 1,
                }}
              >
                ¥{weekTotalYen.toLocaleString()}
              </Text>
              <Text style={{ fontSize: 10, color: palette.textSecondary }}>
                {(weekNetMinutes / 60).toFixed(1)}h worked
              </Text>
            </View>
          </View>

          {/* 7-Day Rolling Visa Bar inside the Hero Card */}
          <View
            style={[
              styles.visaGaugeBox,
              {
                backgroundColor: selectedCompliance.is_over_limit
                  ? palette.warnBg
                  : palette.bgSubtle,
                borderColor: selectedCompliance.is_over_limit
                  ? palette.warnBorder
                  : palette.borderHairline,
              },
            ]}
          >
            <View style={styles.visaGaugeHeader}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: selectedCompliance.is_over_limit
                    ? palette.warnText
                    : palette.textPrimary,
                }}
              >
                7-Day Rolling Visa Cap ({formatReadableDate(selectedDateStr)})
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: selectedCompliance.is_over_limit
                    ? palette.warnText
                    : palette.textPrimary,
                }}
              >
                {(selectedCompliance.rolling_7day_minutes / 60).toFixed(1)}h /{' '}
                {selectedCompliance.limit_minutes / 60}h
              </Text>
            </View>

            {/* Segmented Bar */}
            <View
              style={[
                styles.gaugeTrack,
                { backgroundColor: palette.bgPage },
              ]}
            >
              <View
                style={[
                  styles.gaugeFill,
                  {
                    width: `${Math.round(visaFillRatio * 100)}%`,
                    backgroundColor: selectedCompliance.is_over_limit
                      ? palette.warnText
                      : palette.accentInk,
                  },
                ]}
              />
            </View>

            <View style={styles.visaGaugeHeader}>
              <Text style={{ fontSize: 10, color: palette.textSecondary }}>
                {selectedCompliance.is_over_limit
                  ? `Exceeds rolling cap by ${(
                      (selectedCompliance.peak_overlapping_7day_minutes -
                        selectedCompliance.limit_minutes) /
                      60
                    ).toFixed(1)}h`
                  : `Safe to add up to ${(
                      selectedCompliance.remaining_safe_minutes_on_day / 60
                    ).toFixed(1)}h on this day`}
              </Text>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {(['stream', 'grid'] as const).map((mode) => {
                  const active = viewMode === mode;
                  return (
                    <Pressable
                      key={mode}
                      onPress={() =>
                        onUpdateSettings({ ...settings, shift_view_mode: mode })
                      }
                      style={{
                        borderWidth: 1,
                        borderRadius: 2,
                        paddingHorizontal: 7,
                        paddingVertical: 2,
                        backgroundColor: active
                          ? palette.accentInk
                          : palette.bgSurface,
                        borderColor: active
                          ? palette.accentInk
                          : palette.borderHairline,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '600',
                          color: active
                            ? palette.accentInkFg
                            : palette.textSecondary,
                        }}
                      >
                        {mode === 'stream' ? 'Ticket Stream' : 'Month Grid'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

        {viewMode === 'grid' ? (
          <MonthGridSection
            shifts={shifts}
            employers={employers}
            settings={settings}
            palette={palette}
            todayStr={todayStr}
            selectedDateStr={selectedDateStr}
            dailyMap={dailyMap}
            onSelectDate={(dStr) => {
              setSelectedDateStr(dStr);
              setWeekStartMonday(getMondayOfWeek(dStr));
            }}
            onEditShift={(dStr, sh) => setModalState({ dateStr: dStr, shift: sh })}
          />
        ) : (
          <>
            {/* 2. HORIZONTAL 7-DAY RIBBON */}
            <View style={styles.weekRibbonContainer}>
              <View style={styles.weekNavRow}>
                <Pressable onPress={() => shiftWeek(-7)} style={styles.weekArrow}>
                  <Text style={{ fontSize: 13, color: palette.textSecondary }}>
                    ← Prev Wk
                  </Text>
                </Pressable>

                <Pressable onPress={jumpToToday}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: palette.textPrimary,
                    }}
                  >
                    {formatReadableDate(weekDates[0])} –{' '}
                    {formatReadableDate(weekDates[6])}
                  </Text>
                </Pressable>

                <Pressable onPress={() => shiftWeek(7)} style={styles.weekArrow}>
                  <Text style={{ fontSize: 13, color: palette.textSecondary }}>
                    Next Wk →
                  </Text>
                </Pressable>
              </View>

              <View style={styles.weekStrip}>
                {weekDates.map((dStr) => {
                  const dayNum = Number(dStr.slice(8, 10));
                  const dow = getDayOfWeek(dStr);
                  const isSelected = dStr === selectedDateStr;
                  const isToday = dStr === todayStr;
                  const dayShifts = shifts.filter((s) => s.start_at.startsWith(dStr));
                  const dayComp = evaluateDayRollingCompliance(
                    dailyMap,
                    dStr,
                    settings.vacation_mode_active
                  );
                  const netHrs = (dailyMap[dStr] ?? 0) / 60;

                  return (
                    <Pressable
                      key={dStr}
                      onPress={() => setSelectedDateStr(dStr)}
                      style={[
                        styles.dayPill,
                        {
                          backgroundColor: isSelected
                            ? palette.accentInk
                            : dayComp.is_over_limit
                            ? palette.warnBg
                            : palette.bgSurface,
                          borderColor: isSelected
                            ? palette.accentInk
                            : isToday
                            ? palette.textPrimary
                            : palette.borderHairline,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          color: isSelected
                            ? palette.accentInkFg
                            : palette.textMuted,
                        }}
                      >
                        {SHORT_DAYS[dow]}
                      </Text>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: '700',
                          marginVertical: 2,
                          color: isSelected
                            ? palette.accentInkFg
                            : palette.textPrimary,
                        }}
                      >
                        {dayNum}
                      </Text>

                      <View style={styles.pillDotsRow}>
                        {dayShifts.length > 0 ? (
                          dayShifts.slice(0, 3).map((sh) => {
                            const emp = empMap.get(sh.employer_id);
                            return (
                              <View
                                key={sh.id}
                                style={[
                                  styles.miniDot,
                                  {
                                    backgroundColor: isSelected
                                      ? palette.accentInkFg
                                      : emp?.color ?? '#6E6A63',
                                  },
                                ]}
                              />
                            );
                          })
                        ) : (
                          <Text
                            style={{
                              fontSize: 9,
                              color: isSelected
                                ? palette.accentInkFg
                                : palette.textMuted,
                              opacity: 0.6,
                            }}
                          >
                            {netHrs > 0 ? `${netHrs.toFixed(0)}h` : '–'}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 3. VERTICAL SHIFT TICKET TIMELINE */}
        <View style={styles.timelineSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
              Week Schedule & Shift Tickets
            </Text>
            <Text style={{ fontSize: 11, color: palette.textMuted }}>
              Tap any day or ticket to edit
            </Text>
          </View>

          {weekDates.map((dStr) => {
            const isSelected = dStr === selectedDateStr;
            const dayShifts = shifts.filter((s) => s.start_at.startsWith(dStr));
            const overnightCarryMins =
              (dailyMap[dStr] ?? 0) -
              dayShifts.reduce(
                (acc, s) =>
                  acc + (calculateShiftBreakdown(s).daily_net_minutes_by_date[dStr] ?? 0),
                0
              );

            if (dayShifts.length === 0 && !isSelected && overnightCarryMins <= 0) {
              return null;
            }

            return (
              <Pressable
                key={`feed-${dStr}`}
                onPress={() => setSelectedDateStr(dStr)}
                style={[
                  styles.dayFeedGroup,
                  {
                    backgroundColor: isSelected
                      ? palette.bgSurface
                      : 'transparent',
                    borderColor: isSelected
                      ? palette.borderHairline
                      : 'transparent',
                  },
                ]}
              >
                <View style={styles.dayFeedHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: isSelected ? '700' : '600',
                        color: palette.textPrimary,
                      }}
                    >
                      {formatReadableDate(dStr)}
                    </Text>
                    {dStr === todayStr && (
                      <View
                        style={[
                          styles.todayTag,
                          { backgroundColor: palette.bgSubtle },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 9,
                            fontWeight: '600',
                            color: palette.textSecondary,
                          }}
                        >
                          TODAY
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 11, color: palette.textMuted }}>
                    {((dailyMap[dStr] ?? 0) / 60).toFixed(1)}h visa hrs on date
                  </Text>
                </View>

                {overnightCarryMins > 0 && (
                  <Text
                    style={{
                      fontSize: 11,
                      color: palette.textSecondary,
                      marginBottom: 6,
                    }}
                  >
                    ↳ Includes {(overnightCarryMins / 60).toFixed(1)}h carried past
                    00:00 from previous night&apos;s shift
                  </Text>
                )}

                {dayShifts.length === 0 ? (
                  <View
                    style={[
                      styles.emptyTicketSlot,
                      { borderColor: palette.borderHairline },
                    ]}
                  >
                    <Text style={{ fontSize: 12, color: palette.textMuted }}>
                      Rest day — tap a preset stamp at the bottom to log a shift here
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 8 }}>
                    {dayShifts.map((sh) => {
                      const emp = empMap.get(sh.employer_id);
                      const brk = calculateShiftBreakdown(sh);
                      const payday = emp
                        ? resolveShiftPaydayDate(sh.start_at, emp)
                        : '—';
                      const hasNight =
                        brk.midnight_normal_minutes +
                          brk.midnight_overtime_minutes >
                        0;
                      const hasOt =
                        brk.regular_overtime_minutes +
                          brk.midnight_overtime_minutes >
                        0;

                      return (
                        <Pressable
                          key={sh.id}
                          onPress={() =>
                            setModalState({ dateStr: dStr, shift: sh })
                          }
                          style={[
                            styles.ticketCard,
                            {
                              backgroundColor: palette.bgSubtle,
                              borderColor: palette.borderHairline,
                            },
                          ]}
                        >
                          {/* Left Time Rail */}
                          <View
                            style={[
                              styles.ticketTimeRail,
                              {
                                borderRightColor: palette.borderHairline,
                              },
                            ]}
                          >
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: '700',
                                color: palette.textPrimary,
                              }}
                            >
                              {sh.start_at.slice(11, 16)}
                            </Text>
                            <View
                              style={[
                                styles.railLine,
                                { backgroundColor: emp?.color ?? '#6E6A63' },
                              ]}
                            />
                            <Text
                              style={{
                                fontSize: 12,
                                color: palette.textSecondary,
                              }}
                            >
                              {sh.end_at.slice(11, 16)}
                            </Text>
                          </View>

                          {/* Center Job & Multipliers */}
                          <View style={styles.ticketCenter}>
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <View
                                style={[
                                  styles.jobDot,
                                  { backgroundColor: emp?.color ?? '#6E6A63' },
                                ]}
                              />
                              <Text
                                style={{
                                  fontSize: 14,
                                  fontWeight: '600',
                                  color: palette.textPrimary,
                                }}
                              >
                                {emp?.name ?? 'Shift'}
                              </Text>
                            </View>

                            <Text
                              style={{
                                fontSize: 11,
                                color: palette.textSecondary,
                                marginTop: 2,
                              }}
                            >
                              {(brk.net_work_minutes / 60).toFixed(2)}h net
                              {sh.break_minutes > 0
                                ? ` · ${sh.break_minutes}m break`
                                : ''}
                            </Text>

                            <View style={styles.badgeRow}>
                              {hasNight && (
                                <View
                                  style={[
                                    styles.miniBadge,
                                    { backgroundColor: palette.bgSurface },
                                  ]}
                                >
                                  <Text
                                    style={{
                                      fontSize: 10,
                                      color: palette.textSecondary,
                                    }}
                                  >
                                    22:00+ Late Night (
                                    {(
                                      (brk.midnight_normal_minutes +
                                        brk.midnight_overtime_minutes) /
                                      60
                                    ).toFixed(1)}
                                    h)
                                  </Text>
                                </View>
                              )}
                              {hasOt && (
                                <View
                                  style={[
                                    styles.miniBadge,
                                    { backgroundColor: palette.bgSurface },
                                  ]}
                                >
                                  <Text
                                    style={{
                                      fontSize: 10,
                                      color: palette.textSecondary,
                                    }}
                                  >
                                    &gt;8h OT (+25%)
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>

                          {/* Right Payout & Payday */}
                          <View style={styles.ticketRight}>
                            <Text
                              style={{
                                fontSize: 15,
                                fontWeight: '700',
                                color: palette.textPrimary,
                              }}
                            >
                              ¥{brk.total_payout_yen.toLocaleString()}
                            </Text>
                            <Text
                              style={{
                                fontSize: 10,
                                color: palette.textMuted,
                                marginTop: 2,
                              }}
                            >
                              Paid {payday.slice(5)}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
          </>
        )}
      </ScrollView>

      {/* 4. THUMB-ZONE QUICK STAMP DOCK (Pinned above Bottom Tab Bar) */}
      <View
        style={[
          styles.stampDock,
          {
            backgroundColor: palette.bgSurface,
            borderTopColor: palette.borderHairline,
          },
        ]}
      >
        <View style={styles.dockTopRow}>
          <Text style={{ fontSize: 11, color: palette.textSecondary }}>
            Quick Stamp onto{' '}
            <Text style={{ fontWeight: '700', color: palette.textPrimary }}>
              {formatReadableDate(selectedDateStr)}
            </Text>
            :
          </Text>
          <Pressable onPress={() => setModalState({ dateStr: selectedDateStr })}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                color: palette.textPrimary,
                textDecorationLine: 'underline',
              }}
            >
              + Custom Hours
            </Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stampScroll}
        >
          {templates.map((tpl) => {
            const emp = empMap.get(tpl.employer_id);
            return (
              <Pressable
                key={tpl.id}
                onPress={() => handleStampPreset(tpl)}
                style={[
                  styles.stampPill,
                  {
                    backgroundColor: palette.bgSubtle,
                    borderColor: palette.borderHairline,
                  },
                ]}
              >
                <View
                  style={[
                    styles.jobDot,
                    { backgroundColor: emp?.color ?? '#6E6A63' },
                  ]}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: palette.textPrimary,
                  }}
                >
                  + {tpl.label}
                </Text>
                <Text style={{ fontSize: 11, color: palette.textMuted }}>
                  {tpl.start_time}–{tpl.end_time}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {modalState && (
        <ShiftEditModal
          dateStr={modalState.dateStr}
          existingShift={modalState.shift}
          employers={employers}
          palette={palette}
          onSave={(saved) => {
            if (modalState.shift) {
              onUpdateShift(saved);
            } else {
              onAddShift(saved);
            }
            setModalState(null);
          }}
          onDelete={(id) => {
            onDeleteShift(id);
            setModalState(null);
          }}
          onClose={() => setModalState(null)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 14, gap: 14, paddingBottom: 24 },
  heroCard: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 16,
    gap: 14,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  heroYen: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  weekSummaryPill: {
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'flex-end',
  },
  visaGaugeBox: {
    borderWidth: 1,
    borderRadius: 3,
    padding: 10,
    gap: 6,
  },
  visaGaugeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gaugeTrack: {
    height: 6,
    borderRadius: 2,
    overflow: 'hidden',
  },
  gaugeFill: {
    height: '100%',
    borderRadius: 2,
  },
  weekRibbonContainer: {
    gap: 8,
  },
  weekNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  weekArrow: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  weekStrip: {
    flexDirection: 'row',
    gap: 6,
  },
  dayPill: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 3,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillDotsRow: {
    flexDirection: 'row',
    gap: 3,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniDot: {
    width: 5,
    height: 5,
    borderRadius: 1,
  },
  jumpCard: {
    borderWidth: 1,
    borderRadius: 3,
    padding: 10,
  },
  timelineSection: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  dayFeedGroup: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 12,
    gap: 8,
  },
  dayFeedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  todayTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  emptyTicketSlot: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 3,
    padding: 12,
    alignItems: 'center',
  },
  ticketCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 3,
    padding: 10,
    alignItems: 'center',
  },
  ticketTimeRail: {
    paddingRight: 10,
    borderRightWidth: 1,
    alignItems: 'center',
    minWidth: 54,
  },
  railLine: {
    width: 2,
    height: 10,
    marginVertical: 2,
    borderRadius: 0,
  },
  ticketCenter: {
    flex: 1,
    paddingHorizontal: 10,
  },
  jobDot: {
    width: 7,
    height: 7,
    borderRadius: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  miniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  ticketRight: {
    alignItems: 'flex-end',
  },
  stampDock: {
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  dockTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stampScroll: {
    gap: 8,
  },
  stampPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
});
