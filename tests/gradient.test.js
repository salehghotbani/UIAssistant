import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultGradient,
  gradientCSS,
  gradientStops,
  parseGradient,
  adjustGradient,
  imageGradient,
  gradientCode,
} from '../lib/gradient.js';
import { parseColor } from '../lib/color.js';
test('imports nested color functions and omitted positions', () => {
  const g = parseGradient(
    'background: linear-gradient(to right, rgba(255, 0, 0, .5), #00FF00, hsl(240 100% 50%) 100%);',
  );
  assert.equal(g.angle, 90);
  assert.equal(g.stops[1].position, 50);
  assert.equal(g.stops[0].color, '#FF000080');
  assert.equal(g.stops[2].color, '#0000FF');
  assert.match(gradientCSS(g), /^linear-gradient\(90deg/);
});
test('parses the final declaration and preserves repeating gradients', () => {
  const g = parseGradient(
    'background:-webkit-linear-gradient(0deg, #fff, #000); background:repeating-linear-gradient(45deg,#fff 0%,#000 10%);',
  );
  assert.equal(g.repeating, true);
  assert.equal(g.angle, 45);
  assert.equal(g.stops[1].position, 10);
});
test('independent opacity interpolates a color at the opacity stop', () => {
  const g = {
    ...defaultGradient(),
    stops: [
      { color: '#FF0000', position: 0 },
      { color: '#0000FF', position: 100 },
    ],
    opacity: [
      { alpha: 1, position: 0 },
      { alpha: 0, position: 50 },
      { alpha: 1, position: 100 },
    ],
  };
  const stops = gradientStops(g);
  assert.equal(stops.length, 3);
  assert.equal(stops[1].a, 0);
  assert.equal(stops[1].r, 128);
  assert.equal(stops[1].b, 128);
});
test('duplicate color stops retain hard transitions', () => {
  const g = parseGradient('linear-gradient(90deg, #fff 0%, #fff 50%, #000 50%, #000 100%)');
  assert.equal(gradientStops(g).filter((s) => s.position === 50).length, 2);
});
test('rejects malformed and unsupported geometry rather than changing it silently', () => {
  assert.throws(() => parseGradient('garbage'));
  assert.throws(() => parseGradient('linear-gradient(#fff)'));
  assert.throws(() => parseGradient('linear-gradient(red, blue'));
  assert.throws(() => parseGradient('radial-gradient(circle at left, #fff, #000)'));
});
test('hue adjustment and compatibility code stay valid', () => {
  const g = adjustGradient(defaultGradient(), 60, -10, 5);
  g.stops.forEach((s) => assert.ok(parseColor(s.color)));
  assert.match(gradientCode(g, { compatibility: true }), /-webkit-linear-gradient/);
  assert.match(gradientCode(g, { scss: true }), /\$ui-gradient:/);
});
test('conic gradients start at zero and circles keep their shape', () => {
  assert.equal(parseGradient('conic-gradient(#fff, #000)').angle, 0);
  assert.match(
    gradientCSS(parseGradient('radial-gradient(circle at center, #fff, #000)')),
    /circle at center/,
  );
});
test('image import simplifies linear pixels and preserves alpha', () => {
  const data = new Uint8ClampedArray(101 * 4);
  for (let i = 0; i <= 100; i++)
    data.set([Math.round(i * 2.55), 0, Math.round(255 - i * 2.55), 255], i * 4);
  const g = imageGradient(data, 101, 1);
  assert.equal(g.stops.length, 2);
  assert.equal(g.stops[0].color, '#0000FF');
  assert.equal(g.stops[1].color, '#FF0000');
});
