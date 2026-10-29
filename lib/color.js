export const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, Number(n) || 0));
export const rgba = (r, g, b, a = 1) => ({
  r: Math.round(clamp(r, 0, 255)),
  g: Math.round(clamp(g, 0, 255)),
  b: Math.round(clamp(b, 0, 255)),
  a: clamp(a),
});
const round = (n, p = 1) => Number(n.toFixed(p));
export function hsvToRgb(h, s, v, a = 1) {
  h = ((Number(h) % 360) + 360) % 360;
  s = clamp(s / 100);
  v = clamp(v / 100);
  const c = v * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = v - c;
  const parts =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return rgba(...parts.map((p) => (p + m) * 255), a);
}
export function rgbToHsv({ r, g, b }) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  let h =
    d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max ? (d / max) * 100 : 0, v: max * 100 };
}
export function rgbToHsl({ r, g, b }) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min,
    l = (max + min) / 2;
  const { h } = rgbToHsv(rgba(r * 255, g * 255, b * 255));
  return { h, s: d ? (d / (1 - Math.abs(2 * l - 1))) * 100 : 0, l: l * 100 };
}
export function hslToRgb(h, s, l, a = 1) {
  l = clamp(l / 100);
  s = clamp(s / 100);
  const v = l + s * Math.min(l, 1 - l);
  return hsvToRgb(h, v ? 200 * (1 - l / v) : 0, v * 100, a);
}
export function parseColor(input) {
  if (typeof input !== 'string') return null;
  let value = input.trim().toLowerCase();
  if (value === 'transparent') return rgba(0, 0, 0, 0);
  if (/^#?[\da-f]{3,8}$/i.test(value)) {
    value = value.replace('#', '');
    if (![3, 4, 6, 8].includes(value.length)) return null;
    if (value.length < 5) value = [...value].map((x) => x + x).join('');
    return rgba(
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16),
      value.length === 8 ? parseInt(value.slice(6), 16) / 255 : 1,
    );
  }
  const match = value.match(/^(rgba?|hsla?|hsva?)\((.*)\)$/);
  if (!match) return null;
  const parts = match[2].trim().split(/[\s,/]+/);
  if (
    parts.length < 3 ||
    parts.length > 4 ||
    parts.some((p) => !/^[+-]?(?:\d*\.)?\d+(?:%|deg|turn|rad)?$/.test(p))
  )
    return null;
  let alpha =
    parts[3] === undefined ? 1 : parseFloat(parts[3]) / (parts[3].endsWith('%') ? 100 : 1);
  if (match[1].startsWith('rgb'))
    return rgba(
      ...parts.slice(0, 3).map((p) => parseFloat(p) * (p.endsWith('%') ? 2.55 : 1)),
      alpha,
    );
  const hue =
    parseFloat(parts[0]) *
    (parts[0].endsWith('turn') ? 360 : parts[0].endsWith('rad') ? 180 / Math.PI : 1);
  return (match[1].startsWith('hsl') ? hslToRgb : hsvToRgb)(
    hue,
    parseFloat(parts[1]),
    parseFloat(parts[2]),
    alpha,
  );
}
export function hex(color, alpha = color.a < 1) {
  return (
    '#' +
    [color.r, color.g, color.b, ...(alpha ? [Math.round(color.a * 255)] : [])]
      .map((n) => Math.round(n).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}
export function formatColor(color, format = 'hex') {
  const { r, g, b, a } = color,
    { h, s, l } = rgbToHsl(color);
  switch (format) {
    case 'rgb':
      return a < 1 ? `rgba(${r}, ${g}, ${b}, ${round(a, 3)})` : `rgb(${r}, ${g}, ${b})`;
    case 'rgba':
      return `rgba(${r}, ${g}, ${b}, ${round(a, 3)})`;
    case 'hsl':
      return a < 1
        ? `hsla(${round(h)}, ${round(s)}%, ${round(l)}%, ${round(a, 3)})`
        : `hsl(${round(h)}, ${round(s)}%, ${round(l)}%)`;
    case 'hsla':
      return `hsla(${round(h)}, ${round(s)}%, ${round(l)}%, ${round(a, 3)})`;
    case 'hex8':
      return hex(color, true);
    case 'hex-no-hash':
      return hex(color).slice(1);
    case 'css':
      return `--color: ${hex(color)};`;
    default:
      return hex(color);
  }
}
export function mix(a, b, t) {
  return rgba(
    a.r + (b.r - a.r) * t,
    a.g + (b.g - a.g) * t,
    a.b + (b.b - a.b) * t,
    a.a + (b.a - a.a) * t,
  );
}
export function averagePixels(data) {
  if (!data.length) return rgba(0, 0, 0, 0);
  let r = 0,
    g = 0,
    b = 0,
    a = 0;
  for (let i = 0; i < data.length; i += 4) {
    const w = data[i + 3] / 255;
    r += data[i] * w;
    g += data[i + 1] * w;
    b += data[i + 2] * w;
    a += w;
  }
  return rgba(a ? r / a : 0, a ? g / a : 0, a ? b / a : 0, a / (data.length / 4));
}
export function sampleBounds(x, y, size, width, height) {
  const left = Math.max(0, Math.floor(x - (size - 1) / 2)),
    top = Math.max(0, Math.floor(y - (size - 1) / 2));
  return {
    x: left,
    y: top,
    width: Math.min(size, width - left),
    height: Math.min(size, height - top),
  };
}
export function contrast(a, b) {
  const lum = (c) =>
    [c.r, c.g, c.b]
      .map((n) => {
        n /= 255;
        return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
      })
      .reduce((v, n, i) => v + n * [0.2126, 0.7152, 0.0722][i], 0);
  const x = lum(a),
    y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
