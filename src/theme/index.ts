// ============================================================
// Dark theme constants for Oracle Monitor App
// ============================================================

export const Colors = {
  // Backgrounds
  background: '#0f1117',
  surface: '#1a1d2e',
  surfaceElevated: '#222640',
  card: '#1a1d2e',
  cardBorder: '#2a2d42',

  // Brand
  accent: '#4f8ef7',
  accentDark: '#3a6fd4',

  // Status
  online: '#22c55e',
  onlineGlow: 'rgba(34,197,94,0.25)',
  offline: '#ef4444',
  offlineGlow: 'rgba(239,68,68,0.25)',
  warning: '#f59e0b',
  warningGlow: 'rgba(245,158,11,0.25)',

  // Progress rings
  cpuColor: '#4f8ef7',
  memoryColor: '#a78bfa',
  diskColor: '#34d399',

  // Text
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#475569',

  // Misc
  separator: '#1e2132',
  inputBg: '#0d1020',
  fab: '#4f8ef7',
  danger: '#ef4444',

  // Overlay
  overlay: 'rgba(0,0,0,0.6)',
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
    shadowColor: '#4f8ef7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
  },
};
