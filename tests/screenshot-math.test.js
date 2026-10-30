import test from 'node:test';
import assert from 'node:assert/strict';
import { planTiles, validateOutput, regionPixels } from '../lib/screenshot-math.js';

test('full-page tiles cover a two-axis document exactly without overlapping output', () => {
  const tiles = planTiles(2300, 1900, 1000, 800);
  assert.equal(tiles.length, 9);
  assert.equal(
    tiles.reduce((n, t) => n + t.width * t.height, 0),
    2300 * 1900,
  );
  assert.deepEqual(tiles.at(-1), {
    x: 2000,
    y: 1600,
    width: 300,
    height: 300,
    scrollX: 1300,
    scrollY: 1100,
  });
  for (let i = 0; i < tiles.length; i++)
    for (let j = i + 1; j < tiles.length; j++) {
      const a = tiles[i],
        b = tiles[j];
      assert.ok(
        Math.min(a.x + a.width, b.x + b.width) <= Math.max(a.x, b.x) ||
          Math.min(a.y + a.height, b.y + b.height) <= Math.max(a.y, b.y),
      );
    }
});
test('the last vertical tile crops its overlapping viewport instead of duplicating rows', () => {
  assert.deepEqual(planTiles(1000, 1700, 1000, 800).at(-1), {
    x: 0,
    y: 1600,
    width: 1000,
    height: 100,
    scrollX: 0,
    scrollY: 900,
  });
  assert.equal(planTiles(800, 600, 1000, 800).length, 1);
});
test('planning fails before unbounded scrolling for invalid or oversized documents', () => {
  for (const values of [
    [1, 0, 800, 600],
    [Infinity, 10, 800, 600],
    [100, 10, 0, 600],
    [1000, 40000, 1000, 600],
    [1000, 32700, 1000, 200],
  ])
    assert.throws(() => planTiles(...values));
});
test('pixel limits include retina dimensions and canvas-side limits', () => {
  validateOutput(2000, 12000);
  for (const values of [
    [2000, 12001],
    [32761, 1],
    [1, 0],
    [1.5, 2],
    [NaN, 2],
  ])
    assert.throws(() => validateOutput(...values));
});
test('a selected rectangle maps CSS coordinates to image pixels at non-default scale', () => {
  assert.deepEqual(
    regionPixels(
      { x: 10, y: 20, width: 200, height: 100 },
      { width: 800, height: 600 },
      { width: 1200, height: 900 },
    ),
    { x: 15, y: 30, width: 300, height: 150 },
  );
  assert.deepEqual(
    regionPixels(
      { x: 600, y: 500, width: 200, height: 100 },
      { width: 800, height: 600 },
      { width: 1600, height: 1200 },
    ),
    { x: 1200, y: 1000, width: 400, height: 200 },
  );
});
test('region requests cannot read outside the selected viewport or allocate huge images', () => {
  for (const rect of [
    { x: -1, y: 0, width: 20, height: 20 },
    { x: 790, y: 0, width: 20, height: 20 },
    { x: 0, y: 0, width: 1, height: 20 },
    { x: NaN, y: 0, width: 20, height: 20 },
  ])
    assert.throws(() =>
      regionPixels(rect, { width: 800, height: 600 }, { width: 800, height: 600 }),
    );
  assert.throws(() =>
    regionPixels(
      { x: 0, y: 0, width: 800, height: 600 },
      { width: 800, height: 600 },
      { width: 8000, height: 6000 },
    ),
  );
});
