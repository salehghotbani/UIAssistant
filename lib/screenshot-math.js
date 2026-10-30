export const CAPTURE_LIMITS = Object.freeze({
  tiles: 64,
  pixels: 24000000,
  side: 32760,
  bytes: 24 * 1024 * 1024,
  duration: 120000,
});
export function planTiles(width, height, viewportWidth, viewportHeight) {
  for (const n of [width, height, viewportWidth, viewportHeight])
    if (!Number.isFinite(n) || n <= 0) throw Error('Invalid page dimensions.');
  width = Math.ceil(width);
  height = Math.ceil(height);
  viewportWidth = Math.floor(viewportWidth);
  viewportHeight = Math.floor(viewportHeight);
  if (
    !viewportWidth ||
    !viewportHeight ||
    width > CAPTURE_LIMITS.side ||
    height > CAPTURE_LIMITS.side
  )
    throw Error('This page is too large. Capture a region instead.');
  if (Math.ceil(width / viewportWidth) * Math.ceil(height / viewportHeight) > CAPTURE_LIMITS.tiles)
    throw Error('Full-page capture is limited to 64 tiles. Capture a smaller page or region.');
  const tiles = [];
  for (let y = 0; y < height; y += viewportHeight)
    for (let x = 0; x < width; x += viewportWidth)
      tiles.push({
        x,
        y,
        width: Math.min(viewportWidth, width - x),
        height: Math.min(viewportHeight, height - y),
        scrollX: Math.min(x, Math.max(0, width - viewportWidth)),
        scrollY: Math.min(y, Math.max(0, height - viewportHeight)),
      });
  return tiles;
}
export function validateOutput(width, height) {
  if (
    ![width, height].every((n) => Number.isInteger(n) && n > 0 && n <= CAPTURE_LIMITS.side) ||
    width * height > CAPTURE_LIMITS.pixels
  )
    throw Error('Image exceeds the 24 megapixel / 32,760 pixel limit. Capture a smaller region.');
}
export function regionPixels(rect, viewport, image) {
  if (
    !rect ||
    !viewport ||
    !image ||
    ![
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      viewport.width,
      viewport.height,
      image.width,
      image.height,
    ].every(Number.isFinite) ||
    rect.x < 0 ||
    rect.y < 0 ||
    rect.width < 2 ||
    rect.height < 2 ||
    viewport.width <= 0 ||
    viewport.height <= 0 ||
    rect.x + rect.width > viewport.width + 0.5 ||
    rect.y + rect.height > viewport.height + 0.5
  )
    throw Error('Invalid selected region. Select inside the visible page.');
  const sx = image.width / viewport.width,
    sy = image.height / viewport.height;
  const x = Math.max(0, Math.round(rect.x * sx)),
    y = Math.max(0, Math.round(rect.y * sy));
  const right = Math.min(image.width, Math.round((rect.x + rect.width) * sx));
  const bottom = Math.min(image.height, Math.round((rect.y + rect.height) * sy));
  validateOutput(right - x, bottom - y);
  return { x, y, width: right - x, height: bottom - y };
}
