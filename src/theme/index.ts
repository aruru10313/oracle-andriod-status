// ============================================================
// Dark theme constants for Oracle Monitor App
// Premium 2025/2026 design system
// ============================================================

export const Colors = {
  // Backgrounds
  background: '#0D0F14',
  surface: '#141720',
  surfaceElevated: '#1C2030',
  card: '#141720',
  cardBorder: 'rgba(255,255,255,0.07)',

  // Brand
  accent: '#06B6D4',
  accentSecondary: '#3B82F6',
  accentDark: '#0891B2',

  // Status
  online: '#10B981',
  onlineGlow: 'rgba(16,185,129,0.12)',
  offline: '#EF4444',
  offlineGlow: 'rgba(239,68,68,0.12)',
  warning: '#F59E0B',
  warningGlow: 'rgba(245,158,11,0.12)',

  // Progress rings / bars
  cpuColor: '#3B82F6',
  memoryColor: '#8B5CF6',
  diskColor: '#06B6D4',

  // Text
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#475569',

  // Misc
  separator: 'rgba(255,255,255,0.06)',
  inputBg: '#1C2030',
  fab: '#06B6D4',
  danger: '#EF4444',

  // Overlay
  overlay: 'rgba(0,0,0,0.75)',
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
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  fab: {
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 14,
  },
};
