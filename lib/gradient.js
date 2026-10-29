import { parseColor, formatColor, mix, clamp, rgbToHsl, hslToRgb } from './color.js';
export const defaultGradient = () => ({
  type: 'linear',
  angle: 125,
  repeating: false,
  stops: [
    { color: '#6C5CE7', position: 0 },
    { color: '#B79BFA', position: 52 },
    { color: '#F7C8D8', position: 100 },
  ],
  opacity: [
    { alpha: 1, position: 0 },
    { alpha: 1, position: 100 },
  ],
});
const sorted = (list) => [...list].sort((a, b) => a.position - b.position);
function at(list, position, value, blend) {
  list = sorted(list);
  if (position <= list[0].position) return value(list[0]);
  for (let i = 1; i < list.length; i++)
    if (position < list[i].position)
      return blend(
        value(list[i - 1]),
        value(list[i]),
        (position - list[i - 1].position) / (list[i].position - list[i - 1].position),
      );
  return value(list.at(-1));
}
export function gradientStops(gradient) {
  const min = Math.min(...gradient.stops.map((s) => s.position)),
    max = Math.max(...gradient.stops.map((s) => s.position));
  const opacity = gradient.repeating
    ? gradient.opacity.filter((s) => s.position >= min && s.position <= max)
    : gradient.opacity;
  const positions = [...new Set([...gradient.stops, ...opacity].map((s) => s.position))].sort(
    (a, b) => a - b,
  );
  // Preserve duplicate color stops for hard transitions.
  return positions.flatMap((position) => {
    const originals = gradient.stops.filter((s) => s.position === position);
    const colors = originals.length
      ? originals.map((s) => parseColor(s.color))
      : [at(gradient.stops, position, (s) => parseColor(s.color), mix)];
    return colors.map((color) => ({
      ...color,
      a:
        color.a *
        at(
          gradient.opacity,
          position,
          (s) => s.alpha,
          (a, b, t) => a + (b - a) * t,
        ),
      position,
    }));
  });
}
export function gradientCSS(g, format = 'hex') {
  const prefix = g.repeating ? 'repeating-' : '';
  return `${prefix}${g.type}-gradient(${g.type === 'linear' ? `${g.angle}deg` : g.type === 'radial' ? `${g.shape || 'ellipse'} at center` : `from ${g.angle}deg`}, ${gradientStops(
    g,
  )
    .map((c) => `${formatColor(c, format)} ${c.position}%`)
    .join(', ')})`;
}
export function gradientCode(g, { format = 'hex', compatibility = false, scss = false } = {}) {
  const css = gradientCSS(g, format),
    first = formatColor(gradientStops(g)[0], format);
  const lines = [`background: ${first};`];
  if (compatibility && g.type !== 'conic') {
    const legacyCSS = gradientCSS(
      g,
      format === 'hex' && gradientStops(g).some((c) => c.a < 1) ? 'rgb' : format,
    );
    for (const prefix of ['-webkit-', '-moz-', '-o-']) {
      const old =
        g.type === 'linear' ? legacyCSS.replace(`${g.angle}deg`, `${90 - g.angle}deg`) : legacyCSS;
      lines.push(`background: ${prefix}${old};`);
    }
  }
  lines.push(`background: ${css};`);
  return scss ? `$ui-gradient: ${css};\n\nbackground: $ui-gradient;` : lines.join('\n');
}
export function splitArguments(input) {
  let depth = 0,
    start = 0,
    parts = [];
  for (let i = 0; i < input.length; i++) {
    if (input[i] === '(') depth++;
    if (input[i] === ')') depth--;
    if (input[i] === ',' && depth === 0) {
      parts.push(input.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(input.slice(start).trim());
  return parts;
}
export function parseGradient(text, resolveColor = parseColor) {
  if (!/(?:linear|radial|conic)-gradient\(/.test(text)) {
    const legacy = text.match(/(?:DXImageTransform\.Microsoft\.)?gradient\(([^)]*)\)/i);
    if (legacy) {
      const get = (name) =>
        legacy[1].match(new RegExp(name + '\\s*=\\s*[\'"]?(#[0-9a-f]{6,8})', 'i'))?.[1];
      const decode = (value) =>
        value?.length === 9 ? '#' + value.slice(3) + value.slice(1, 3) : value;
      const start = decode(get('startColorstr')),
        end = decode(get('endColorstr'));
      if (start && end)
        return parseGradient(
          `linear-gradient(${/GradientType\s*=\s*1/i.test(legacy[1]) ? 90 : 180}deg, ${start}, ${end})`,
          resolveColor,
        );
    }
    if (text.includes('-webkit-gradient(')) {
      const start = text.indexOf('-webkit-gradient(') + 17;
      let end = start,
        depth = 1;
      while (end < text.length && depth) {
        if (text[end] === '(') depth++;
        if (text[end] === ')') depth--;
        end++;
      }
      const args = splitArguments(text.slice(start, end - 1));
      if (args[0] !== 'linear')
        throw new Error('Only linear legacy WebKit gradients can be imported.');
      const points = args.slice(1, 3).map((point) =>
        point
          .trim()
          .split(/\s+/)
          .map(
            (v, i) =>
              ({ left: 0, right: 100, top: 0, bottom: 100, center: 50 })[v] ?? parseFloat(v),
          ),
      );
      const angle =
        ((Math.atan2(points[1][0] - points[0][0], -(points[1][1] - points[0][1])) * 180) / Math.PI +
          360) %
        360;
      const stops = args.slice(3).map((arg) => {
        if (arg.startsWith('from(')) return arg.slice(5, -1) + ' 0%';
        if (arg.startsWith('to(')) return arg.slice(3, -1) + ' 100%';
        const parts = splitArguments(arg.slice(11, -1));
        const position = parseFloat(parts[0]) * (parts[0].includes('%') ? 1 : 100);
        return parts[1] + ' ' + position + '%';
      });
      return parseGradient(`linear-gradient(${angle}deg, ${stops.join(', ')})`, resolveColor);
    }
  }
  const found = [...text.matchAll(/((?:repeating-)?(?:linear|radial|conic)-gradient)\(/g)];
  if (!found.length) throw new Error('Enter a linear, radial or conic CSS gradient.');
  const m = found.at(-1);
  let start = m.index + m[0].length,
    depth = 1,
    end = start;
  while (end < text.length && depth) {
    if (text[end] === '(') depth++;
    if (text[end] === ')') depth--;
    end++;
  }
  if (depth) throw new Error('The gradient has unbalanced parentheses.');
  const args = splitArguments(text.slice(start, end - 1));
  let angle = 180,
    type = m[1].includes('radial') ? 'radial' : m[1].includes('conic') ? 'conic' : 'linear',
    shape = 'ellipse';
  if (type === 'conic') angle = 0;
  const legacyPrefix = /-[a-z]+-$/.test(text.slice(Math.max(0, m.index - 9), m.index));
  if (legacyPrefix && type === 'linear') {
    const directions = {
      top: 'to bottom',
      bottom: 'to top',
      left: 'to right',
      right: 'to left',
      'left top': 'to bottom right',
      'top left': 'to bottom right',
      'right top': 'to bottom left',
      'top right': 'to bottom left',
      'left bottom': 'to top right',
      'bottom left': 'to top right',
      'right bottom': 'to top left',
      'bottom right': 'to top left',
    };
    if (directions[args[0]]) args[0] = directions[args[0]];
    else if (/^[+-]?[\d.]+deg$/.test(args[0])) args[0] = 90 - parseFloat(args[0]) + 'deg';
  }
  const dirs = {
    'to top': 0,
    'to right': 90,
    'to bottom': 180,
    'to left': 270,
    'to top right': 45,
    'to right top': 45,
    'to bottom right': 135,
    'to right bottom': 135,
    'to bottom left': 225,
    'to left bottom': 225,
    'to top left': 315,
    'to left top': 315,
  };
  if (/^(to |from |[+-]?[\d.]+(?:deg|turn|rad)|circle|ellipse|at )/.test(args[0])) {
    const direction = args.shift();
    if (type === 'radial' && !/^(?:ellipse|circle)(?: at center)?$/.test(direction))
      throw new Error('Use a centered circle or ellipse radial gradient.');
    if (type === 'radial') shape = direction.startsWith('circle') ? 'circle' : 'ellipse';
    if (type === 'conic' && direction.includes(' at ') && !direction.endsWith(' at center'))
      throw new Error('Use a centered conic gradient.');
    angle =
      dirs[direction] ??
      parseFloat(direction.replace('from ', '')) *
        (direction.includes('turn') ? 360 : direction.includes('rad') ? 180 / Math.PI : 1);
    if (!Number.isFinite(angle)) angle = 180;
  }
  const stops = args.map((arg) => {
    const match = arg.match(/^(.*?)(?:\s+([+-]?[\d.]+)%)?$/);
    const c = resolveColor(match[1]);
    if (!c) throw new Error('Unsupported stop. Use a CSS color and a percentage position.');
    return {
      color: formatColor(c),
      position: match[2] === undefined ? null : clamp(match[2], 0, 100),
    };
  });
  if (stops.length < 2 || stops.length > 64) throw new Error('Use between 2 and 64 color stops.');
  stops[0].position ??= 0;
  stops.at(-1).position ??= 100;
  for (let i = 1; i < stops.length; i++)
    if (stops[i].position !== null) {
      let j = i - 1;
      while (stops[j].position === null) j--;
      stops[i].position = Math.max(stops[j].position, stops[i].position);
      for (let k = j + 1; k < i; k++)
        stops[k].position =
          stops[j].position + ((stops[i].position - stops[j].position) * (k - j)) / (i - j);
    }
  return {
    type,
    angle,
    shape,
    repeating: m[1].startsWith('repeating'),
    stops,
    opacity: [
      { alpha: 1, position: 0 },
      { alpha: 1, position: 100 },
    ],
  };
}
export function adjustGradient(g, h, s, l) {
  return {
    ...g,
    stops: g.stops.map((stop) => {
      const c = parseColor(stop.color),
        hsl = rgbToHsl(c);
      return {
        ...stop,
        color: formatColor(
          hslToRgb(hsl.h + h, clamp(hsl.s + s, 0, 100), clamp(hsl.l + l, 0, 100), c.a),
        ),
      };
    }),
  };
}
export function imageGradient(data, width, height, vertical = false, tolerance = 12) {
  const n = vertical ? height : width;
  const colors = [];
  for (let i = 0; i < n; i++) {
    const k =
      (vertical ? i * width + Math.floor(width / 2) : Math.floor(height / 2) * width + i) * 4;
    colors.push({ r: data[k], g: data[k + 1], b: data[k + 2], a: data[k + 3] / 255 });
  }
  const chosen = new Set([0, n - 1]);
  function simplify(a, b) {
    let max = 0,
      index = -1;
    for (let i = a + 1; i < b; i++) {
      const c = mix(colors[a], colors[b], (i - a) / (b - a));
      const error = Math.max(
        ...['r', 'g', 'b'].map((k) => Math.abs(c[k] - colors[i][k])),
        Math.abs(c.a - colors[i].a) * 255,
      );
      if (error > max) {
        max = error;
        index = i;
      }
    }
    if (max > tolerance && chosen.size < 32) {
      chosen.add(index);
      simplify(a, index);
      simplify(index, b);
    }
  }
  simplify(0, n - 1);
  return {
    type: 'linear',
    angle: vertical ? 180 : 90,
    repeating: false,
    stops: [...chosen]
      .sort((a, b) => a - b)
      .map((i) => ({
        color: formatColor(colors[i]),
        position: Math.round((i / (n - 1)) * 1000) / 10,
      })),
    opacity: [
      { alpha: 1, position: 0 },
      { alpha: 1, position: 100 },
    ],
  };
}
