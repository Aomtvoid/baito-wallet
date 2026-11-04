import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Employer, Shift } from '../domain/types';
import { calculateShiftBreakdown } from '../domain/wageEngine';
import { resolveShiftPaydayDate } from '../domain/paydayEngine';
import { addDaysToDateStr } from '../domain/visaEngine';
import { isWeekendDateStr } from '../storage/repository';
import { ThemePalette } from '../theme/colors';

interface Props {
  dateStr: string;
  existingShift?: Shift;
  employers: Employer[];
  palette: ThemePalette;
  onSave: (shift: Shift) => void;
  onDelete?: (shiftId: string) => void;
  onClose: () => void;
}

export const ShiftEditModal: React.FC<Props> = ({
  dateStr,
  existingShift,
  employers,
  palette,
  onSave,
  onDelete,
  onClose,
}) => {
  const initialEmployer =
    employers.find((e) => e.id === existingShift?.employer_id) ?? employers[0];

  const [employerId, setEmployerId] = useState(initialEmployer?.id ?? '');
  const [startTime, setStartTime] = useState(
    existingShift ? existingShift.start_at.slice(11, 16) : '18:00'
  );
  const [endTime, setEndTime] = useState(
    existingShift ? existingShift.end_at.slice(11, 16) : '23:00'
  );
  const [breakMinutes, setBreakMinutes] = useState(
    String(existingShift?.break_minutes ?? 0)
  );
  const [isMidnightBreak, setIsMidnightBreak] = useState(
    existingShift?.is_midnight_break ?? false
  );
  const [hourlyYen, setHourlyYen] = useState(
    String(
      existingShift?.applied_hourly_yen ??
        (initialEmployer
          ? initialEmployer.base_hourly_yen +
            (isWeekendDateStr(dateStr) ? initialEmployer.weekend_hourly_bonus_yen : 0)
          : 1200)
    )
  );
  const [transportYen, setTransportYen] = useState(
    String(
      existingShift?.applied_transport_yen ?? initialEmployer?.transport_per_shift_yen ?? 0
    )
  );
  const [paysOvertimeAfter8h, setPaysOvertimeAfter8h] = useState(
    existingShift?.pays_overtime_after_8h ?? initialEmployer?.pays_overtime_after_8h ?? true
  );

  const selectedEmployer = employers.find((e) => e.id === employerId) ?? initialEmployer;
  const crossesMidnight = endTime <= startTime;
  const endDateStr = crossesMidnight ? addDaysToDateStr(dateStr, 1) : dateStr;

  const draftShift: Shift = {
    id: existingShift?.id ?? `shift-${Date.now()}`,
    employer_id: employerId,
    start_at: `${dateStr}T${startTime}`,
    end_at: `${endDateStr}T${endTime}`,
    break_minutes: Number(breakMinutes) || 0,
    is_midnight_break: isMidnightBreak,
    applied_hourly_yen: Number(hourlyYen) || 0,
    applied_transport_yen: Number(transportYen) || 0,
    pays_overtime_after_8h: paysOvertimeAfter8h,
    midnight_bonus_rate: selectedEmployer?.midnight_bonus_rate ?? 0.25,
  };

  const breakdown = calculateShiftBreakdown(draftShift);
  const touchesMidnightWindow =
    breakdown.midnight_normal_minutes + breakdown.midnight_overtime_minutes > 0 ||
    isMidnightBreak;
  const paydayDate = selectedEmployer
    ? resolveShiftPaydayDate(draftShift.start_at, selectedEmployer)
    : '—';

  const selectEmployer = (emp: Employer) => {
    setEmployerId(emp.id);
    const wkBonus = isWeekendDateStr(dateStr) ? emp.weekend_hourly_bonus_yen : 0;
    setHourlyYen(String(emp.base_hourly_yen + wkBonus));
    setTransportYen(String(emp.transport_per_shift_yen));
    setPaysOvertimeAfter8h(emp.pays_overtime_after_8h);
  };

  const inputStyle = [
    styles.input,
    {
      backgroundColor: palette.bgPage,
      borderColor: palette.borderHairline,
      color: palette.textPrimary,
    },
  ];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: palette.bgSurface, borderColor: palette.borderHairline },
          ]}
        >
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.title, { color: palette.textPrimary }]}>
                {existingShift ? 'Edit Shift' : 'Custom Shift'} · {dateStr}
              </Text>
              <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
                {crossesMidnight ? `Overnight to ${endDateStr}` : 'Same day'} · Payday{' '}
                {paydayDate}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={{ color: palette.textSecondary, fontSize: 13 }}>Close</Text>
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            <Text style={[styles.label, { color: palette.textSecondary }]}>Job</Text>
            <View style={styles.chipRow}>
              {employers.map((emp) => {
                const active = emp.id === employerId;
                return (
                  <Pressable
                    key={emp.id}
                    onPress={() => selectEmployer(emp)}
                    style={[
                      styles.jobChip,
                      {
                        backgroundColor: active ? palette.accentInk : palette.bgPage,
                        borderColor: active ? palette.accentInk : palette.borderHairline,
                      },
                    ]}
                  >
                    <View style={[styles.dot, { backgroundColor: emp.color }]} />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '500',
                        color: active ? palette.accentInkFg : palette.textPrimary,
                      }}
                    >
                      {emp.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.row2}>
              <View style={styles.col}>
                <Text style={[styles.label, { color: palette.textSecondary }]}>
                  Start (HH:mm)
                </Text>
                <TextInput
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="18:00"
                  style={inputStyle}
                />
              </View>
              <View style={styles.col}>
                <Text style={[styles.label, { color: palette.textSecondary }]}>
                  End {crossesMidnight ? '(+1d)' : '(HH:mm)'}
                </Text>
                <TextInput
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="23:00"
                  style={inputStyle}
                />
              </View>
            </View>

            <View style={styles.row2}>
              <View style={styles.col}>
                <Text style={[styles.label, { color: palette.textSecondary }]}>
                  Break (mins)
                </Text>
                <TextInput
                  value={breakMinutes}
                  onChangeText={setBreakMinutes}
                  keyboardType="numeric"
                  style={inputStyle}
                />
              </View>
              <View style={styles.col}>
                <Text style={[styles.label, { color: palette.textSecondary }]}>
                  Wage (¥/h)
                </Text>
                <TextInput
                  value={hourlyYen}
                  onChangeText={setHourlyYen}
                  keyboardType="numeric"
                  style={inputStyle}
                />
              </View>
              <View style={styles.col}>
                <Text style={[styles.label, { color: palette.textSecondary }]}>
                  Transport (¥)
                </Text>
                <TextInput
                  value={transportYen}
                  onChangeText={setTransportYen}
                  keyboardType="numeric"
                  style={inputStyle}
                />
              </View>
            </View>

            {touchesMidnightWindow && Number(breakMinutes) > 0 && (
              <View
                style={[
                  styles.toggleRow,
                  {
                    backgroundColor: palette.bgSubtle,
                    borderColor: palette.borderHairline,
                  },
                ]}
              >
                <Text style={{ fontSize: 12, color: palette.textPrimary }}>
                  Break taken after 22:00 (midnight window)?
                </Text>
                <Switch value={isMidnightBreak} onValueChange={setIsMidnightBreak} />
              </View>
            )}

            <View
              style={[
                styles.summaryBox,
                {
                  backgroundColor: palette.bgSubtle,
                  borderColor: palette.borderHairline,
                },
              ]}
            >
              <View style={styles.summaryLine}>
                <Text style={{ fontSize: 12, color: palette.textSecondary }}>
                  Net Work Duration
                </Text>
                <Text
                  style={{ fontSize: 12, fontWeight: '600', color: palette.textPrimary }}
                >
                  {(breakdown.net_work_minutes / 60).toFixed(2)}h (
                  {breakdown.net_work_minutes}m)
                </Text>
              </View>
              <View style={styles.summaryLine}>
                <Text style={{ fontSize: 12, color: palette.textSecondary }}>
                  Base + Late Night + Overtime
                </Text>
                <Text style={{ fontSize: 12, color: palette.textSecondary }}>
                  ¥{breakdown.base_wage_yen.toLocaleString()} + ¥
                  {breakdown.midnight_bonus_yen.toLocaleString()} + ¥
                  {breakdown.overtime_bonus_yen.toLocaleString()}
                </Text>
              </View>
              <View
                style={[
                  styles.summaryLine,
                  {
                    borderTopWidth: 1,
                    borderTopColor: palette.borderHairline,
                    paddingTop: 8,
                    marginTop: 4,
                  },
                ]}
              >
                <Text
                  style={{ fontSize: 13, fontWeight: '600', color: palette.textPrimary }}
                >
                  Total Payout
                </Text>
                <Text
                  style={{ fontSize: 14, fontWeight: '700', color: palette.textPrimary }}
                >
                  ¥{breakdown.total_payout_yen.toLocaleString()}
                </Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.footerRow}>
            {existingShift && onDelete ? (
              <Pressable
                onPress={() => onDelete(existingShift.id)}
                style={styles.deleteBtn}
              >
                <Text style={{ color: palette.warnText, fontSize: 13, fontWeight: '500' }}>
                  Delete
                </Text>
              </Pressable>
            ) : (
              <View />
            )}

            <Pressable
              onPress={() => onSave(draftShift)}
              style={[styles.saveBtn, { backgroundColor: palette.accentInk }]}
            >
              <Text
                style={{ color: palette.accentInkFg, fontSize: 13, fontWeight: '600' }}
              >
                Save Shift
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderTopWidth: 1,
    padding: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 15, fontWeight: '600' },
  subtitle: { fontSize: 12, marginTop: 2 },
  closeBtn: { padding: 6 },
  label: { fontSize: 11, marginBottom: 4, marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  jobChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  dot: { width: 7, height: 7, borderRadius: 1 },
  row2: { flexDirection: 'row', gap: 8 },
  col: { flex: 1 },
  input: {
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
  },
  summaryBox: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 12,
    marginTop: 14,
    gap: 4,
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  deleteBtn: { paddingVertical: 8, paddingHorizontal: 10 },
  saveBtn: {
    borderRadius: 3,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
});
