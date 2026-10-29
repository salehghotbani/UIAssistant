const make = (id, name, colors) => ({ id, name, colors: colors.split(' ').map((c) => '#' + c) });
export const palettes = [
  make(
    'essentials',
    'Studio essentials',
    '6C5CE7 A29BFE FDCB6E FF7675 E17055 00B894 00CEC9 0984E3 74B9FF FD79A8 E84393 2D3436 636E72 B2BEC3 DFE6E9 FFFFFF',
  ),
  make(
    'tailwind',
    'Tailwind essentials',
    '0F172A 334155 64748B CBD5E1 F1F5F9 EF4444 F97316 F59E0B EAB308 84CC16 22C55E 10B981 14B8A6 06B6D4 0EA5E9 3B82F6 6366F1 8B5CF6 A855F7 D946EF EC4899 F43F5E',
  ),
  make(
    'material',
    'Material design',
    'F44336 E91E63 9C27B0 673AB7 3F51B5 2196F3 03A9F4 00BCD4 009688 4CAF50 8BC34A CDDC39 FFEB3B FFC107 FF9800 FF5722 795548 9E9E9E 607D8B',
  ),
  make(
    'flat',
    'Flat UI',
    '1ABC9C 2ECC71 3498DB 9B59B6 34495E 16A085 27AE60 2980B9 8E44AD 2C3E50 F1C40F E67E22 E74C3C ECF0F1 95A5A6 F39C12 D35400 C0392B BDC3C7 7F8C8D',
  ),
  make(
    'css',
    'CSS classics',
    '000000 FFFFFF FF0000 00FF00 0000FF FFFF00 00FFFF FF00FF C0C0C0 808080 800000 808000 008000 800080 008080 000080 FFA500 663399 FFC0CB FFD700',
  ),
  {
    id: 'websafe',
    name: 'Web safe · 216',
    colors: Array.from(
      { length: 216 },
      (_, i) =>
        '#' +
        [Math.floor(i / 36), Math.floor(i / 6) % 6, i % 6]
          .map((n) => (n * 51).toString(16).padStart(2, '0'))
          .join('')
          .toUpperCase(),
    ),
  },
  {
    id: 'gray',
    name: 'Grayscale · 24',
    colors: Array.from(
      { length: 24 },
      (_, i) =>
        '#' +
        Math.round((i * 255) / 23)
          .toString(16)
          .padStart(2, '0')
          .repeat(3)
          .toUpperCase(),
    ),
  },
];
export const gradientPresets = [
  { name: 'Lilac hour', colors: ['#6C5CE7', '#B79BFA', '#F7C8D8'], angle: 125 },
  { name: 'Afterglow', colors: ['#FF512F', '#F09819', '#FFE7A3'], angle: 110 },
  { name: 'Northern lights', colors: ['#091E3A', '#2F80ED', '#2DCE89'], angle: 135 },
  { name: 'Rosewater', colors: ['#EE9CA7', '#FFDDE1'], angle: 90 },
  { name: 'Deep ocean', colors: ['#0F2027', '#203A43', '#2C5364'], angle: 135 },
  { name: 'Limewire', colors: ['#16222A', '#A8E063', '#DCE35B'], angle: 120 },
];
