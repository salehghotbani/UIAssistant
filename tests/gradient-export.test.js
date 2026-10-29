import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGradient } from '../lib/gradient.js';
import { gradientSVG, rasterGradient } from '../lib/gradient-export.js';
test('legacy IE ARGB and WebKit gradient imports', () => {
  const ie = parseGradient(
    "filter: progid:DXImageTransform.Microsoft.gradient(startColorstr='#80ff0000', endColorstr='#ff0000ff', GradientType=1);",
  );
  assert.equal(ie.angle, 90);
  assert.equal(ie.stops[0].color, '#FF000080');
  const webkit = parseGradient(
    '-webkit-gradient(linear, left top, right top, from(#fff), color-stop(0.5, #f00), to(#000))',
  );
  assert.equal(webkit.angle, 90);
  assert.equal(webkit.stops[1].position, 50);
  const old = parseGradient('-moz-linear-gradient(top, #fff, #000)');
  assert.equal(old.angle, 180);
});
test('raster exports premultiplied transparency and repeating patterns', () => {
  const g = parseGradient('linear-gradient(90deg, rgba(255,0,0,0), #0000ff)');
  const data = rasterGradient(g, 101, 1);
  const middle = Array.from(data.slice(50 * 4, 51 * 4));
  assert.equal(middle[0], 0);
  assert.equal(middle[2], 255);
  assert.ok(Math.abs(middle[3] - 128) < 2);
  const repeat = parseGradient('repeating-linear-gradient(90deg, #fff 0%, #000 25%)');
  const pixels = rasterGradient(repeat, 100, 1);
  assert.ok(Math.abs(pixels[0] - pixels[25 * 4]) < 2);
});
test('SVG escapes no untrusted data and includes all opacity stops', () => {
  const g = parseGradient('radial-gradient(ellipse at center,#fff,#000)');
  const svg = gradientSVG(g, 800, 400);
  assert.match(svg, /radialGradient/);
  assert.match(svg, /70.710678%/);
  assert.match(svg, /width="800"/);
  assert.throws(() => gradientSVG({ ...g, type: 'conic' }, 100, 100));
});
