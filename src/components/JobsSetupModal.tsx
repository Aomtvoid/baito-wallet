import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppSettings, Employer, ShiftTemplate } from '../domain/types';
import { ThemePalette } from '../theme/colors';

interface Props {
  employers: Employer[];
  templates: ShiftTemplate[];
  settings: AppSettings;
  palette: ThemePalette;
  onSaveEmployers: (next: Employer[]) => void;
  onSaveTemplates: (next: ShiftTemplate[]) => void;
  onUpdateSettings: (next: AppSettings) => void;
}

const JOB_COLORS = ['#4A6278', '#B86B4B', '#4A6B5D', '#8C6D46', '#6E5A7A'];

export const JobsSetupModal: React.FC<Props> = ({
  employers,
  templates,
  settings,
  palette,
  onSaveEmployers,
  onSaveTemplates,
  onUpdateSettings,
}) => {
  const [name, setName] = useState('');
  const [baseWage, setBaseWage] = useState('1250');
  const [weekendBonus, setWeekendBonus] = useState('0');
  const [transportYen, setTransportYen] = useState('500');
  const [paysOtAfter8h, setPaysOtAfter8h] = useState(true);
  const [cutoffDay, setCutoffDay] = useState('99');
  const [payMonthOffset, setPayMonthOffset] = useState<0 | 1>(1);
  const [payDay, setPayDay] = useState('25');
  const [color, setColor] = useState(JOB_COLORS[0]);

  const [tplEmpId, setTplEmpId] = useState(employers[0]?.id ?? '');
  const [tplLabel, setTplLabel] = useState('');
  const [tplStart, setTplStart] = useState('18:00');
  const [tplEnd, setTplEnd] = useState('23:00');
  const [tplBreak, setTplBreak] = useState('0');
  const [tplMidnightBreak, setTplMidnightBreak] = useState(false);

  const handleAddEmployer = () => {
    if (!name.trim()) return;
    const newEmp: Employer = {
      id: `emp-${Date.now()}`,
      name: name.trim(),
      color,
      base_hourly_yen: Number(baseWage) || 1200,
      weekend_hourly_bonus_yen: Number(weekendBonus) || 0,
      midnight_bonus_rate: 0.25,
      pays_overtime_after_8h: paysOtAfter8h,
      transport_per_shift_yen: Number(transportYen) || 0,
      cutoff_day: Number(cutoffDay) || 99,
      pay_month_offset: payMonthOffset,
      pay_day: Number(payDay) || 25,
    };
    onSaveEmployers([...employers, newEmp]);
    setName('');
    if (!tplEmpId) setTplEmpId(newEmp.id);
  };

  const handleAddTemplate = () => {
    if (!tplLabel.trim() || !tplEmpId) return;
    const newTpl: ShiftTemplate = {
      id: `tpl-${Date.now()}`,
      employer_id: tplEmpId,
      label: tplLabel.trim(),
      start_time: tplStart,
      end_time: tplEnd,
      break_minutes: Number(tplBreak) || 0,
      is_midnight_break: tplMidnightBreak,
    };
    onSaveTemplates([...templates, newTpl]);
    setTplLabel('');
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Display & Compliance Preferences */}
      <View
        style={[
          styles.card,
          { backgroundColor: palette.bgSurface, borderColor: palette.borderHairline },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
          App Settings
        </Text>

        <View style={styles.prefRow}>
          <Text style={{ fontSize: 13, color: palette.textSecondary }}>
            Shift Screen Layout
          </Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {(['stream', 'grid'] as const).map((mode) => {
              const active = (settings.shift_view_mode ?? 'stream') === mode;
              return (
                <Pressable
                  key={mode}
                  onPress={() =>
                    onUpdateSettings({ ...settings, shift_view_mode: mode })
                  }
                  style={[
                    styles.themeBtn,
                    {
                      backgroundColor: active ? palette.accentInk : palette.bgPage,
                      borderColor: active ? palette.accentInk : palette.borderHairline,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: active ? palette.accentInkFg : palette.textSecondary,
                    }}
                  >
                    {mode === 'stream' ? 'Ticket Stream' : 'Month Grid'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.prefRow}>
          <Text style={{ fontSize: 13, color: palette.textSecondary }}>Theme</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {(['paper', 'dark'] as const).map((t) => {
              const active = (settings.theme ?? 'paper') === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => onUpdateSettings({ ...settings, theme: t })}
                  style={[
                    styles.themeBtn,
                    {
                      backgroundColor: active ? palette.accentInk : palette.bgPage,
                      borderColor: active ? palette.accentInk : palette.borderHairline,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: active ? palette.accentInkFg : palette.textSecondary,
                    }}
                  >
                    {t === 'paper' ? 'Warm Paper' : 'Soft Dark'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.prefRow}>
          <Text style={{ fontSize: 13, color: palette.textSecondary, flex: 1 }}>
            School Vacation Mode (40h/wk limit)
          </Text>
          <Switch
            value={settings.vacation_mode_active}
            onValueChange={(v) =>
              onUpdateSettings({ ...settings, vacation_mode_active: v })
            }
          />
        </View>

        <View style={styles.prefRow}>
          <Text style={{ fontSize: 13, color: palette.textSecondary, flex: 1 }}>
            Show yen instead of time inside calendar cells
          </Text>
          <Switch
            value={Boolean(settings.calendar_show_pay)}
            onValueChange={(v) =>
              onUpdateSettings({ ...settings, calendar_show_pay: v })
            }
          />
        </View>

        <View style={styles.prefRow}>
          <Text style={{ fontSize: 13, color: palette.textSecondary, flex: 1 }}>
            Always show 7-day rolling hours on calendar cells
          </Text>
          <Switch
            value={Boolean(settings.calendar_show_rolling_hours)}
            onValueChange={(v) =>
              onUpdateSettings({ ...settings, calendar_show_rolling_hours: v })
            }
          />
        </View>
      </View>

      {/* Jobs Section */}
      <View
        style={[
          styles.card,
          { backgroundColor: palette.bgSurface, borderColor: palette.borderHairline },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
          Your Jobs (Employers)
        </Text>
        {employers.map((emp) => (
          <View
            key={emp.id}
            style={[
              styles.listItem,
              { borderBottomColor: palette.borderHairline },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.dot, { backgroundColor: emp.color }]} />
              <View>
                <Text
                  style={{ fontSize: 13, fontWeight: '600', color: palette.textPrimary }}
                >
                  {emp.name} · ¥{emp.base_hourly_yen}/h
                </Text>
                <Text style={{ fontSize: 11, color: palette.textMuted }}>
                  Wknd +¥{emp.weekend_hourly_bonus_yen} · Trans ¥
                  {emp.transport_per_shift_yen} ·{' '}
                  {emp.pays_overtime_after_8h ? '>8h OT ON' : 'Flat >8h'}
                </Text>
              </View>
            </View>
            {employers.length > 1 && (
              <Pressable
                onPress={() =>
                  onSaveEmployers(employers.filter((i) => i.id !== emp.id))
                }
              >
                <Text style={{ fontSize: 12, color: palette.warnText }}>Remove</Text>
              </Pressable>
            )}
          </View>
        ))}

        <Text
          style={{
            fontSize: 12,
            fontWeight: '600',
            color: palette.textSecondary,
            marginTop: 12,
            marginBottom: 6,
          }}
        >
          Add New Job
        </Text>
        <TextInput
          placeholder="Job Name (e.g. 7-Eleven)"
          placeholderTextColor={palette.textMuted}
          value={name}
          onChangeText={setName}
          style={inputStyle}
        />

        <View style={[styles.colorRow, { marginTop: 8 }]}>
          {JOB_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              style={[
                styles.colorCircle,
                { backgroundColor: c },
                color === c && { borderWidth: 2, borderColor: palette.textPrimary },
              ]}
            />
          ))}
        </View>

        <View style={styles.row3}>
          <View style={styles.col}>
            <Text style={[styles.label, { color: palette.textMuted }]}>Base ¥/h</Text>
            <TextInput
              value={baseWage}
              onChangeText={setBaseWage}
              keyboardType="numeric"
              style={inputStyle}
            />
          </View>
          <View style={styles.col}>
            <Text style={[styles.label, { color: palette.textMuted }]}>Wknd +¥</Text>
            <TextInput
              value={weekendBonus}
              onChangeText={setWeekendBonus}
              keyboardType="numeric"
              style={inputStyle}
            />
          </View>
          <View style={styles.col}>
            <Text style={[styles.label, { color: palette.textMuted }]}>Transport ¥</Text>
            <TextInput
              value={transportYen}
              onChangeText={setTransportYen}
              keyboardType="numeric"
              style={inputStyle}
            />
          </View>
        </View>

        <View style={styles.row3}>
          <View style={styles.col}>
            <Text style={[styles.label, { color: palette.textMuted }]}>
              Cutoff (99=EOM)
            </Text>
            <TextInput
              value={cutoffDay}
              onChangeText={setCutoffDay}
              keyboardType="numeric"
              style={inputStyle}
            />
          </View>
          <View style={styles.col}>
            <Text style={[styles.label, { color: palette.textMuted }]}>Pay Month</Text>
            <Pressable
              onPress={() => setPayMonthOffset(payMonthOffset === 1 ? 0 : 1)}
              style={[
                styles.input,
                {
                  backgroundColor: palette.bgPage,
                  borderColor: palette.borderHairline,
                  justifyContent: 'center',
                },
              ]}
            >
              <Text style={{ fontSize: 12, color: palette.textPrimary }}>
                {payMonthOffset === 1 ? 'Next Month' : 'Same Month'}
              </Text>
            </Pressable>
          </View>
          <View style={styles.col}>
            <Text style={[styles.label, { color: palette.textMuted }]}>Payday</Text>
            <TextInput
              value={payDay}
              onChangeText={setPayDay}
              keyboardType="numeric"
              style={inputStyle}
            />
          </View>
        </View>

        <View style={[styles.prefRow, { marginTop: 8 }]}>
          <Text style={{ fontSize: 12, color: palette.textSecondary }}>
            Pays +25% overtime after 8h net work?
          </Text>
          <Switch value={paysOtAfter8h} onValueChange={setPaysOtAfter8h} />
        </View>

        <Pressable
          onPress={handleAddEmployer}
          style={[styles.primaryBtn, { backgroundColor: palette.accentInk }]}
        >
          <Text style={{ color: palette.accentInkFg, fontSize: 13, fontWeight: '600' }}>
            Add Job
          </Text>
        </Pressable>
      </View>

      {/* 1-Tap Templates Section */}
      <View
        style={[
          styles.card,
          { backgroundColor: palette.bgSurface, borderColor: palette.borderHairline },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
          1-Tap Shift Presets
        </Text>
        {templates.map((tpl) => {
          const emp = employers.find((e) => e.id === tpl.employer_id);
          return (
            <View
              key={tpl.id}
              style={[styles.listItem, { borderBottomColor: palette.borderHairline }]}
            >
              <View>
                <Text
                  style={{ fontSize: 13, fontWeight: '600', color: palette.textPrimary }}
                >
                  {tpl.label}
                </Text>
                <Text style={{ fontSize: 11, color: palette.textMuted }}>
                  {emp?.name} · {tpl.start_time}–{tpl.end_time} ({tpl.break_minutes}m
                  break)
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  onSaveTemplates(templates.filter((i) => i.id !== tpl.id))
                }
              >
                <Text style={{ fontSize: 12, color: palette.warnText }}>Remove</Text>
              </Pressable>
            </View>
          );
        })}

        <Text
          style={{
            fontSize: 12,
            fontWeight: '600',
            color: palette.textSecondary,
            marginTop: 12,
            marginBottom: 6,
          }}
        >
          Create New Preset
        </Text>

        <View style={styles.chipRow}>
          {employers.map((emp) => {
            const active = emp.id === tplEmpId;
            return (
              <Pressable
                key={emp.id}
                onPress={() => setTplEmpId(emp.id)}
                style={[
                  styles.themeBtn,
                  {
                    backgroundColor: active ? palette.accentInk : palette.bgPage,
                    borderColor: active ? palette.accentInk : palette.borderHairline,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 12,
                    color: active ? palette.accentInkFg : palette.textPrimary,
                  }}
                >
                  {emp.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          placeholder="Preset Label (e.g. Morning 5h)"
          placeholderTextColor={palette.textMuted}
          value={tplLabel}
          onChangeText={setTplLabel}
          style={[...inputStyle, { marginTop: 8 }]}
        />

        <View style={styles.row3}>
          <View style={styles.col}>
            <Text style={[styles.label, { color: palette.textMuted }]}>Start</Text>
            <TextInput value={tplStart} onChangeText={setTplStart} style={inputStyle} />
          </View>
          <View style={styles.col}>
            <Text style={[styles.label, { color: palette.textMuted }]}>End</Text>
            <TextInput value={tplEnd} onChangeText={setTplEnd} style={inputStyle} />
          </View>
          <View style={styles.col}>
            <Text style={[styles.label, { color: palette.textMuted }]}>Break (m)</Text>
            <TextInput
              value={tplBreak}
              onChangeText={setTplBreak}
              keyboardType="numeric"
              style={inputStyle}
            />
          </View>
        </View>

        <View style={[styles.prefRow, { marginTop: 8 }]}>
          <Text style={{ fontSize: 12, color: palette.textSecondary }}>
            Break happens after 22:00?
          </Text>
          <Switch value={tplMidnightBreak} onValueChange={setTplMidnightBreak} />
        </View>

        <Pressable
          onPress={handleAddTemplate}
          style={[styles.primaryBtn, { backgroundColor: palette.accentInk }]}
        >
          <Text style={{ color: palette.accentInkFg, fontSize: 13, fontWeight: '600' }}>
            Save Preset
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 14, gap: 14, paddingBottom: 32 },
  card: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 14,
  },
  sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  prefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  themeBtn: {
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  dot: { width: 7, height: 7, borderRadius: 1 },
  colorRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  colorCircle: { width: 22, height: 22, borderRadius: 3 },
  row3: { flexDirection: 'row', gap: 8, marginTop: 8 },
  col: { flex: 1 },
  label: { fontSize: 10, marginBottom: 3 },
  input: {
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  primaryBtn: {
    borderRadius: 3,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
});
