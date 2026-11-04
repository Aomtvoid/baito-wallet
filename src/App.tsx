import React, { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  BaitoWalletState,
  getInitialWalletState,
  loadWalletStateAsync,
  saveWalletStateAsync,
} from './storage/repository';
import { CalendarLoggerView } from './components/CalendarLoggerView';
import { WalletDashboardView } from './components/WalletDashboardView';
import { JobsSetupModal } from './components/JobsSetupModal';
import { getThemePalette } from './theme/colors';

export const App: React.FC = () => {
  const [state, setState] = useState<BaitoWalletState>(() => getInitialWalletState());
  const [hydrated, setHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<'calendar' | 'wallet' | 'settings'>(
    'calendar'
  );

  useEffect(() => {
    loadWalletStateAsync().then((loaded) => {
      setState(loaded);
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveWalletStateAsync(state);
  }, [state, hydrated]);

  const palette = getThemePalette(state.settings.theme);

  return (
    <SafeAreaView style={[styles.safeRoot, { backgroundColor: palette.bgPage }]}>
      <StatusBar
        barStyle={state.settings.theme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={palette.bgSurface}
      />

      {/* Mobile Phone Shell (Full screen on iOS/Android, centered 430px phone frame on Web) */}
      <View
        style={[
          styles.phoneFrame,
          {
            backgroundColor: palette.bgPage,
            borderColor: palette.borderHairline,
          },
        ]}
      >
        {/* Minimal Mobile Top Bar */}
        <View
          style={[
            styles.topBar,
            {
              backgroundColor: palette.bgSurface,
              borderBottomColor: palette.borderHairline,
            },
          ]}
        >
          <Text style={[styles.appName, { color: palette.textPrimary }]}>
            Baito Wallet
          </Text>
          <Text style={{ fontSize: 11, color: palette.textMuted }}>
            {state.settings.vacation_mode_active ? '40h Vacation' : '28h Cap'}
          </Text>
        </View>

        {/* Active Screen */}
        <View style={styles.screenArea}>
          {activeTab === 'calendar' && (
            <CalendarLoggerView
              shifts={state.shifts}
              employers={state.employers}
              templates={state.templates}
              settings={state.settings}
              palette={palette}
              onAddShift={(shift) =>
                setState((prev) => ({ ...prev, shifts: [...prev.shifts, shift] }))
              }
              onUpdateShift={(updated) =>
                setState((prev) => ({
                  ...prev,
                  shifts: prev.shifts.map((s) => (s.id === updated.id ? updated : s)),
                }))
              }
              onDeleteShift={(shiftId) =>
                setState((prev) => ({
                  ...prev,
                  shifts: prev.shifts.filter((s) => s.id !== shiftId),
                }))
              }
            />
          )}

          {activeTab === 'wallet' && (
            <WalletDashboardView
              shifts={state.shifts}
              employers={state.employers}
              settings={state.settings}
              palette={palette}
              onUpdateSettings={(settings) =>
                setState((prev) => ({ ...prev, settings }))
              }
            />
          )}

          {activeTab === 'settings' && (
            <JobsSetupModal
              employers={state.employers}
              templates={state.templates}
              settings={state.settings}
              palette={palette}
              onSaveEmployers={(employers) =>
                setState((prev) => ({ ...prev, employers }))
              }
              onSaveTemplates={(templates) =>
                setState((prev) => ({ ...prev, templates }))
              }
              onUpdateSettings={(settings) =>
                setState((prev) => ({ ...prev, settings }))
              }
            />
          )}
        </View>

        {/* Thumb-Zone Bottom Tab Bar */}
        <View
          style={[
            styles.bottomTabBar,
            {
              backgroundColor: palette.bgSurface,
              borderTopColor: palette.borderHairline,
            },
          ]}
        >
          {(
            [
              { id: 'calendar', label: 'Shifts & Pulse' },
              { id: 'wallet', label: 'Payday Vault' },
              { id: 'settings', label: 'Jobs & Settings' },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={styles.tabBtn}
              >
                <View
                  style={[
                    styles.tabIndicator,
                    isActive && { backgroundColor: palette.accentInk },
                  ]}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: isActive ? '600' : '400',
                    color: isActive ? palette.textPrimary : palette.textSecondary,
                  }}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeRoot: {
    flex: 1,
    alignItems: 'center',
  },
  phoneFrame: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 430 : undefined,
    borderLeftWidth: Platform.OS === 'web' ? 1 : 0,
    borderRightWidth: Platform.OS === 'web' ? 1 : 0,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  appName: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  screenArea: {
    flex: 1,
  },
  bottomTabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 6 : 10,
    paddingTop: 6,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 4,
  },
  tabIndicator: {
    width: 20,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
});

export default App;
