import test from 'node:test';
import assert from 'node:assert/strict';
import {
  convertUnits,
  fluidSize,
  shadowCSS,
  gridCSS,
  radiusCSS,
  easingCSS,
} from '../lib/css-tools.js';

test('unit conversion uses the configured root and round-trips fractional values', () => {
  assert.equal(convertUnits(24, 16), 1.5);
  assert.equal(convertUnits(1.5, 20, 'rem'), 30);
  assert.equal(convertUnits(convertUnits(-7.25, 18), 18, 'rem'), -7.25);
  for (const root of [0, -1, NaN, Infinity]) assert.throws(() => convertUnits(16, root));
  assert.throws(() => convertUnits(NaN, 16));
  assert.throws(() => convertUnits(16, 16, 'em'));
});

test('fluid expression meets both viewport endpoints with a non-default root', () => {
  const css = fluidSize({
    minSize: 18,
    maxSize: 42,
    minViewport: 360,
    maxViewport: 1440,
    root: 20,
  });
  const parts = css
    .match(/clamp\(([-\d.]+)rem, ([-\d.]+)rem \+ ([-\d.]+)vw, ([-\d.]+)rem\)/)
    .slice(1)
    .map(Number);
  const [min, base, vw, max] = parts;
  const at = (width) => Math.max(min * 20, Math.min(max * 20, base * 20 + (vw * width) / 100));
  assert.ok(Math.abs(at(360) - 18) < 0.0001);
  assert.ok(Math.abs(at(1440) - 42) < 0.0001);
  assert.ok(Math.abs(at(900) - 30) < 0.0001);
  assert.equal(at(100), 18);
  assert.ok(Math.abs(at(2000) - 42) < 0.0001);
});

test('fluid sizes support a negative intercept, a constant size and reject degenerate ranges', () => {
  const values = { minSize: 16, maxSize: 64, minViewport: 800, maxViewport: 1200, root: 16 };
  assert.match(fluidSize(values), /-5rem \+ 12vw/);
  assert.equal(fluidSize({ ...values, maxSize: 16 }), 'clamp(1rem, 1rem + 0vw, 1rem)');
  for (const patch of [
    { root: 0 },
    { minSize: 0 },
    { maxSize: 12 },
    { maxViewport: 800 },
    { minViewport: -1 },
    { minSize: NaN },
  ])
    assert.throws(() => fluidSize({ ...values, ...patch }));
});

test('shadows keep signed offsets, spread, inset and explicit alpha', () => {
  const values = { x: -4, y: 8, blur: 24, spread: -2, color: '#302547', opacity: 18, inset: true };
  assert.equal(shadowCSS(values), 'inset -4px 8px 24px -2px rgba(48, 37, 71, 0.18)');
  assert.match(shadowCSS({ ...values, opacity: 0, inset: false }), /^-4px.*0\)$/);
  for (const patch of [{ blur: -1 }, { opacity: 101 }, { color: 'red' }, { x: Infinity }])
    assert.throws(() => shadowCSS({ ...values, ...patch }));
});

test('grid output guards narrow containers and refuses unbounded or injected track values', () => {
  const values = { columns: 3, minWidth: 160, columnGap: 16, rowGap: 24 };
  assert.match(gridCSS(values), /minmax\(min\(100%, 160px\), 1fr\)/);
  assert.match(gridCSS({ ...values, responsive: false }), /repeat\(3, minmax\(0, 1fr\)\)/);
  for (const patch of [
    { columns: 2.5 },
    { columns: 13 },
    { minWidth: 0 },
    { rowGap: -1 },
    { columnGap: Infinity },
    { minWidth: '1px);color:red' },
  ])
    assert.throws(() => gridCSS({ ...values, ...patch }));
});

test('radius output preserves physical corner order and validates percentage limits', () => {
  const values = { topLeft: 1, topRight: 2, bottomRight: 3, bottomLeft: 4 };
  assert.equal(radiusCSS(values), 'border-radius: 1px 2px 3px 4px;');
  assert.equal(radiusCSS({ ...values, unit: '%' }), 'border-radius: 1% 2% 3% 4%;');
  for (const patch of [
    { topLeft: -1 },
    { bottomRight: NaN },
    { unit: 'em' },
    { unit: '%', bottomLeft: 101 },
  ])
    assert.throws(() => radiusCSS({ ...values, ...patch }));
});

test('motion curves permit Y overshoot while keeping time control points in CSS bounds', () => {
  const values = { x1: 0.25, y1: -1, x2: 0.75, y2: 2 };
  assert.equal(easingCSS(values), 'cubic-bezier(0.25, -1, 0.75, 2)');
  for (const patch of [{ x1: -0.1 }, { x2: 1.1 }, { y1: -4 }, { y2: Infinity }])
    assert.throws(() => easingCSS({ ...values, ...patch }));
});
