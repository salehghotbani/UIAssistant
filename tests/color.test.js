import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseColor,
  formatColor,
  hex,
  rgba,
  hsvToRgb,
  rgbToHsv,
  hslToRgb,
  rgbToHsl,
  averagePixels,
  sampleBounds,
  contrast,
} from '../lib/color.js';
test('CSS colors parse percentages, short hex, alpha and angles', () => {
  assert.deepEqual(parseColor('#f008'), rgba(255, 0, 0, 136 / 255));
  assert.deepEqual(parseColor('rgb(100% 0% 0% / 50%)'), rgba(255, 0, 0, 0.5));
  assert.deepEqual(parseColor('hsl(0.5turn 100% 50%)'), rgba(0, 255, 255));
  assert.equal(parseColor('#12345'), null);
  assert.equal(parseColor('rgb(nope, 0, 0)'), null);
  assert.deepEqual(parseColor('transparent'), rgba(0, 0, 0, 0));
});
test('color conversions round-trip across the gamut', () => {
  for (let r = 0; r <= 255; r += 51)
    for (let g = 0; g <= 255; g += 51)
      for (let b = 0; b <= 255; b += 51) {
        const c = rgba(r, g, b, 0.4),
          hsv = rgbToHsv(c),
          hsl = rgbToHsl(c);
        assert.deepEqual(hsvToRgb(hsv.h, hsv.s, hsv.v, 0.4), c);
        assert.deepEqual(hslToRgb(hsl.h, hsl.s, hsl.l, 0.4), c);
      }
});
test('formatting preserves transparency', () => {
  const c = rgba(108, 92, 231, 0.5);
  assert.equal(hex(c), '#6C5CE780');
  assert.equal(formatColor(c, 'rgb'), 'rgba(108, 92, 231, 0.5)');
  assert.match(formatColor(c, 'hsl'), /^hsla\(/);
  assert.equal(formatColor(rgba(0, 0, 0), 'hex8'), '#000000FF');
});
test('average sampling weighs alpha and handles empty regions', () => {
  assert.deepEqual(averagePixels([255, 0, 0, 255, 0, 0, 255, 255]), rgba(128, 0, 128));
  assert.deepEqual(averagePixels([255, 0, 0, 0, 0, 0, 255, 255]), rgba(0, 0, 255, 0.5));
  assert.deepEqual(averagePixels([]), rgba(0, 0, 0, 0));
  assert.deepEqual(sampleBounds(99, 99, 25, 100, 100), { x: 87, y: 87, width: 13, height: 13 });
});
test('contrast reference black/white is 21:1', () =>
  assert.equal(contrast(rgba(0, 0, 0), rgba(255, 255, 255)), 21));
