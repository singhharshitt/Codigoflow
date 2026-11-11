/** CódigoFlow design tokens — Spider-Man-inspired navy / red / cyan system */
export const theme = {
  colors: {
    bg: '#080D2B',
    navy: '#070B24',
    secondary: '#0B1538',
    sidebar: '#0C173D',
    card: '#101D45',
    elevated: '#162653',
    border: '#263968',
    red: '#E62429',
    crimson: '#B5121B',
    royal: '#1476D4',
    cyan: '#38DFFF',
    ice: '#B8F5FF',
    violet: '#8247E5',
    text: '#F4F7FF',
    muted: '#A7B4D2',
    faint: '#7381A8',
    success: '#35D58A',
    warning: '#FFBD45',
    error: '#FF525E',
  },
  chart: {
    grid: '#263968',
    axis: '#7381A8',
    tooltipBg: '#101D45',
    tooltipBorder: '#263968',
    cyan: '#38DFFF',
    red: '#E62429',
    violet: '#8247E5',
    royal: '#1476D4',
  },
} as const;

export type ThemeColors = typeof theme.colors;
