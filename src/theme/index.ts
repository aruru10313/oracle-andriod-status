// ============================================================
// Dark theme constants for Oracle Monitor App
// ============================================================

export const Colors = {
  // Backgrounds
  background: '#000000',
  surface: '#111111',
  surfaceElevated: '#1A1A1A',
  card: '#111111',
  cardBorder: '#222222',

  // Brand
  accent: '#0A84FF',
  accentDark: '#0066CC',

  // Status
  online: '#32D74B',
  onlineGlow: 'transparent',
  offline: '#FF453A',
  offlineGlow: 'transparent',
  warning: '#FF9F0A',
  warningGlow: 'transparent',

  // Progress rings
  cpuColor: '#0A84FF',
  memoryColor: '#BF5AF2',
  diskColor: '#30D158',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#8E8E93',
  textMuted: '#636366',

  // Misc
  separator: '#2C2C2E',
  inputBg: '#1C1C1E',
  fab: '#0A84FF',
  danger: '#FF453A',

  // Overlay
  overlay: 'rgba(0,0,0,0.7)',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 26,
  xxxl: 34,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export const Shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
  },
};
