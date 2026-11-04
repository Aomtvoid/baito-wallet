import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppSettings, Employer, Shift } from '../domain/types';
import { buildPaycheckBuckets, calculateAnnualTaxSummary } from '../domain/paydayEngine';
import { buildDailyNetMinutesMap, evaluateDayRollingCompliance } from '../domain/visaEngine';
import { getJstDateAndMinute } from '../domain/wageEngine';
import { ThemePalette } from '../theme/colors';

interface Props {
  shifts: Shift[];
  employers: Employer[];
  settings: AppSettings;
  palette: ThemePalette;
  onUpdateSettings: (next: AppSettings) => void;
}

export const WalletDashboardView: React.FC<Props> = ({
  shifts,
  employers,
  settings,
  palette,
  onUpdateSettings,
}) => {
  const nowDateStr = getJstDateAndMinute(Date.now()).dateStr;
  const currentYear = Number(nowDateStr.slice(0, 4));
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const buckets = buildPaycheckBuckets(shifts, employers);
  const upcomingBuckets = buckets.filter((b) => b.payday_date >= nowDateStr);
  const pastBuckets = buckets.filter((b) => b.payday_date < nowDateStr).reverse();

  const taxSummary = calculateAnnualTaxSummary(shifts, employers, selectedYear);
  const dailyMap = buildDailyNetMinutesMap(shifts);
  const todayCompliance = evaluateDayRollingCompliance(
    dailyMap,
    nowDateStr,
    settings.vacation_mode_active
  );

  const activeWallTarget = settings.tax_wall_target_yen;
  const activeWallUsed =
    activeWallTarget === 1030000
      ? taxSummary.total_taxable_yen
      : taxSummary.total_social_insurance_yen;
  const wallPercent = Math.min(100, Math.round((activeWallUsed / activeWallTarget) * 100));
  const remainingBeforeWall = Math.max(0, activeWallTarget - activeWallUsed);

  const totalUpcomingCash = upcomingBuckets.reduce((acc, b) => acc + b.total_payout_yen, 0);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Card 1: Upcoming Paychecks */}
      <View
        style={[
          styles.card,
          { backgroundColor: palette.bgSurface, borderColor: palette.borderHairline },
        ]}
      >
        <Text style={{ fontSize: 12, color: palette.textSecondary }}>
          Money I Will Receive (Upcoming Paydays)
        </Text>
        <Text
          style={{
            fontSize: 26,
            fontWeight: '700',
            color: palette.textPrimary,
            marginTop: 4,
          }}
        >
          ¥{totalUpcomingCash.toLocaleString()}
        </Text>
        <Text style={{ fontSize: 11, color: palette.textMuted, marginTop: 4 }}>
          {upcomingBuckets.length} upcoming paycheck(s) across your jobs
        </Text>
      </View>

      {/* Card 2: Rolling 7-Day Window */}
      <View
        style={[
          styles.card,
          { backgroundColor: palette.bgSurface, borderColor: palette.borderHairline },
        ]}
      >
        <View style={styles.rowBetween}>
          <Text style={{ fontSize: 12, color: palette.textSecondary }}>
            Rolling 7-Day Visa Hours (Today)
          </Text>
          <Text style={{ fontSize: 11, color: palette.textMuted }}>
            {settings.vacation_mode_active ? 'Vacation 40h' : 'Semester 28h'}
          </Text>
        </View>
        <View style={styles.baselineRow}>
          <Text
            style={{
              fontSize: 22,
              fontWeight: '700',
              color: todayCompliance.is_over_limit
                ? palette.warnText
                : palette.textPrimary,
            }}
          >
            {(todayCompliance.rolling_7day_minutes / 60).toFixed(1)}h
          </Text>
          <Text style={{ fontSize: 13, color: palette.textMuted }}>
            / {todayCompliance.limit_minutes / 60}h
          </Text>
        </View>
        <Text style={{ fontSize: 11, color: palette.textSecondary, marginTop: 4 }}>
          {todayCompliance.is_over_limit
            ? `Over limit by ${(
                (todayCompliance.peak_overlapping_7day_minutes -
                  todayCompliance.limit_minutes) /
                60
              ).toFixed(1)}h in overlapping 7-day window`
            : `${(todayCompliance.remaining_safe_minutes_on_day / 60).toFixed(
                1
              )}h available today`}
        </Text>
      </View>

      {/* Card 3: Annual Tax Wall */}
      <View
        style={[
          styles.card,
          { backgroundColor: palette.bgSurface, borderColor: palette.borderHairline },
        ]}
      >
        <View style={styles.rowBetween}>
          <Text style={{ fontSize: 12, color: palette.textSecondary }}>
            {selectedYear} Annual Wall (By Payday)
          </Text>
          <Pressable
            onPress={() =>
              onUpdateSettings({
                ...settings,
                tax_wall_target_yen: activeWallTarget === 1030000 ? 1300000 : 1030000,
              })
            }
            style={[
              styles.pillToggle,
              {
                backgroundColor: palette.bgSubtle,
                borderColor: palette.borderHairline,
              },
            ]}
          >
            <Text style={{ fontSize: 11, color: palette.textPrimary }}>
              Target: {activeWallTarget === 1030000 ? '¥1.03M' : '¥1.30M'} ↻
            </Text>
          </Pressable>
        </View>

        <Text
          style={{
            fontSize: 22,
            fontWeight: '700',
            color: palette.textPrimary,
            marginTop: 4,
          }}
        >
          ¥{activeWallUsed.toLocaleString()}
        </Text>

        <View style={[styles.progressTrack, { backgroundColor: palette.bgSubtle }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${wallPercent}%`,
                backgroundColor:
                  activeWallUsed > activeWallTarget
                    ? palette.warnText
                    : palette.accentInk,
              },
            ]}
          />
        </View>

        <Text style={{ fontSize: 11, color: palette.textSecondary, marginTop: 6 }}>
          ¥{remainingBeforeWall.toLocaleString()} remaining · Earned ¥
          {taxSummary.earned_taxable_yen.toLocaleString()} · Planned ¥
          {taxSummary.planned_taxable_yen.toLocaleString()}
        </Text>
      </View>

      {/* Payday Schedule List */}
      <View
        style={[
          styles.card,
          { backgroundColor: palette.bgSurface, borderColor: palette.borderHairline },
        ]}
      >
        <View style={styles.rowBetween}>
          <Text
            style={{ fontSize: 14, fontWeight: '600', color: palette.textPrimary }}
          >
            Payday Schedule (Shiharaibi)
          </Text>
          <View style={styles.yearSwitch}>
            {[currentYear - 1, currentYear, currentYear + 1].map((yr) => (
              <Pressable
                key={yr}
                onPress={() => setSelectedYear(yr)}
                style={[
                  styles.yearBtn,
                  yr === selectedYear && { backgroundColor: palette.bgSubtle },
                ]}
              >
                <Text
                  style={{
                    fontSize: 11,
                    color:
                      yr === selectedYear ? palette.textPrimary : palette.textMuted,
                    fontWeight: yr === selectedYear ? '600' : '400',
                  }}
                >
                  {yr}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {buckets.length === 0 ? (
          <Text
            style={{
              fontSize: 12,
              color: palette.textMuted,
              paddingVertical: 18,
              textAlign: 'center',
            }}
          >
            No shifts logged yet. Add shifts on the Calendar tab to see your paydays.
          </Text>
        ) : (
          <View style={{ marginTop: 8 }}>
            {[...upcomingBuckets, ...pastBuckets].map((b, idx) => {
              const isUpcoming = b.payday_date >= nowDateStr;
              return (
                <View
                  key={`${b.payday_date}-${b.employer_id}`}
                  style={[
                    styles.payRow,
                    idx > 0 && {
                      borderTopWidth: 1,
                      borderTopColor: palette.borderHairline,
                    },
                  ]}
                >
                  <View style={styles.payLeft}>
                    <View
                      style={[
                        styles.colorBar,
                        { backgroundColor: b.employer_color },
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
                        {b.payday_date} · {b.employer_name}
                      </Text>
                      <Text style={{ fontSize: 11, color: palette.textMuted }}>
                        {b.period_label} · {b.shift_count} shift(s){' '}
                        {!isUpcoming ? '(Past)' : ''}
                      </Text>
                    </View>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '700',
                        color: palette.textPrimary,
                      }}
                    >
                      ¥{b.total_payout_yen.toLocaleString()}
                    </Text>
                    <Text style={{ fontSize: 10, color: palette.textMuted }}>
                      Earned ¥{b.earned_payout_yen.toLocaleString()}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 14, gap: 12, paddingBottom: 28 },
  card: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 14,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  baselineRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 4,
  },
  pillToggle: {
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  progressTrack: {
    height: 6,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: {
    height: '100%',
  },
  yearSwitch: { flexDirection: 'row', gap: 4 },
  yearBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 3 },
  payRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  payLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  colorBar: { width: 3, height: 28, borderRadius: 1 },
});
