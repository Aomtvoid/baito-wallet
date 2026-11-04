export interface ThemePalette {
  bgPage: string;
  bgSurface: string;
  bgSubtle: string;
  borderHairline: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accentInk: string;
  accentInkFg: string;
  warnBg: string;
  warnBorder: string;
  warnText: string;
}

export const PAPER_THEME: ThemePalette = {
  bgPage: '#F6F5F0',
  bgSurface: '#FFFFFF',
  bgSubtle: '#EFECE6',
  borderHairline: '#E2DFD7',
  textPrimary: '#1F1E1B',
  textSecondary: '#6E6A63',
  textMuted: '#9C978E',
  accentInk: '#2C2A26',
  accentInkFg: '#FAF9F6',
  warnBg: '#FDF6EC',
  warnBorder: '#E6C89C',
  warnText: '#9A5B13',
};

export const DARK_THEME: ThemePalette = {
  bgPage: '#171716',
  bgSurface: '#20201E',
  bgSubtle: '#282825',
  borderHairline: '#2E2E2B',
  textPrimary: '#EAE7E0',
  textSecondary: '#9E9B93',
  textMuted: '#6E6C65',
  accentInk: '#E5E2DA',
  accentInkFg: '#171716',
  warnBg: '#2B2318',
  warnBorder: '#5C4524',
  warnText: '#E0A958',
};

export function getThemePalette(theme?: 'paper' | 'dark'): ThemePalette {
  return theme === 'dark' ? DARK_THEME : PAPER_THEME;
}
