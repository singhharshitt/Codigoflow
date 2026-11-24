/**
 * CódigoFlow design tokens (JS mirror of tailwind.config.js `cf` colors).
 * Neutral ink surfaces, one brand accent (red), cyan reserved for focus and data.
 */
export const theme = {
  colors: {
    bg: '#0B0E15',
    navy: '#080A10',
    secondary: '#0E121A',
    sidebar: '#0A0D13',
    card: '#11151F',
    elevated: '#1A1F2A',
    border: '#232937',
    red: '#E62429',
    crimson: '#B5121B',
    royal: '#4C8DF6',
    cyan: '#5DC4DF',
    ice: '#D6ECF3',
    violet: '#9AA3B5',
    text: '#ECEEF3',
    muted: '#A3A9B8',
    faint: '#7D8598',
    success: '#4CC38A',
    warning: '#E8B44C',
    error: '#E5484D',
  },
  chart: {
    grid: 'rgba(236, 238, 243, 0.06)',
    axis: '#7D8598',
    tooltipBg: '#1A1F2A',
    tooltipBorder: '#2A3040',
    cyan: '#5DC4DF',
    red: '#E62429',
    violet: '#9AA3B5',
    royal: '#4C8DF6',
    neutral: '#5B6375',
  },
} as const;

export type ThemeColors = typeof theme.colors;
