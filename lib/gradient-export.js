import { gradientStops } from './gradient.js';
import { hex } from './color.js';
export function gradientSVG(g, width, height) {
  if (g.type === 'conic' || g.repeating)
    throw new Error('Use PNG or CSS to export conic and repeating gradients.');
  let attrs =
    g.shape === 'circle'
      ? `gradientUnits="userSpaceOnUse" cx="${width / 2}" cy="${height / 2}" r="${Math.hypot(width / 2, height / 2)}"`
      : 'r="70.710678%"';
  if (g.type === 'linear') {
    const rad = (g.angle * Math.PI) / 180,
      x = Math.sin(rad),
      y = -Math.cos(rad),
      length = Math.abs(width * x) + Math.abs(height * y);
    attrs = `gradientUnits="userSpaceOnUse" x1="${width / 2 - (x * length) / 2}" y1="${height / 2 - (y * length) / 2}" x2="${width / 2 + (x * length) / 2}" y2="${height / 2 + (y * length) / 2}"`;
  }
  const kind = g.type === 'radial' ? 'radialGradient' : 'linearGradient';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><${kind} id="g" ${attrs}>${gradientStops(
    g,
  )
    .map(
      (c) => `<stop offset="${c.position}%" stop-color="${hex(c, false)}" stop-opacity="${c.a}"/>`,
    )
    .join('')}</${kind}></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
}
export function rasterGradient(g, width, height) {
  const stops = gradientStops(g),
    first = stops[0].position,
    last = stops.at(-1).position,
    period = last - first;
  const lut = new Uint8ClampedArray(4097 * 4);
  for (let i = 0; i <= 4096; i++) {
    let position = (i / 4096) * 100;
    if (g.repeating && period > 0)
      position = ((((position - first) % period) + period) % period) + first;
    let right = stops.findIndex((s) => s.position > position);
    let c;
    if (right === 0) c = stops[0];
    else if (right === -1) c = stops.at(-1);
    else {
      const a = stops[right - 1],
        b = stops[right],
        t = (position - a.position) / (b.position - a.position),
        alpha = a.a + (b.a - a.a) * t;
      c = { a: alpha };
      for (const key of ['r', 'g', 'b'])
        c[key] = alpha ? (a[key] * a.a * (1 - t) + b[key] * b.a * t) / alpha : 0;
    }
    lut.set([c.r, c.g, c.b, c.a * 255], i * 4);
  }
  const out = new Uint8ClampedArray(width * height * 4),
    rad = (g.angle * Math.PI) / 180,
    dx = Math.sin(rad),
    dy = -Math.cos(rad),
    length = Math.abs(width * dx) + Math.abs(height * dy);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const px = x + 0.5 - width / 2,
        py = y + 0.5 - height / 2;
      let t =
        g.type === 'linear'
          ? 0.5 + (px * dx + py * dy) / length
          : g.type === 'radial'
            ? g.shape === 'circle'
              ? Math.hypot(px, py) / Math.hypot(width / 2, height / 2)
              : Math.hypot(px / (width / Math.SQRT2), py / (height / Math.SQRT2))
            : ((((Math.atan2(px, -py) - rad) / (Math.PI * 2)) % 1) + 1) % 1;
      const index = Math.max(0, Math.min(4096, Math.round(t * 4096))) * 4,
        k = (y * width + x) * 4;
      out[k] = lut[index];
      out[k + 1] = lut[index + 1];
      out[k + 2] = lut[index + 2];
      out[k + 3] = lut[index + 3];
    }
  return out;
}
