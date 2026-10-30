import { CAPTURE_LIMITS, planTiles, regionPixels, validateOutput } from './screenshot-math.js';
import { capturePage } from './capture-page.js';
import { captureContainerPage } from './capture-container.js';

function imageBlob(url) {
  if (!url.startsWith('data:image/png;base64,')) throw Error('Invalid capture image.');
  return new Blob(
    [Uint8Array.from(atob(url.slice(url.indexOf(',') + 1)), (c) => c.charCodeAt(0))],
    { type: 'image/png' },
  );
}
async function encode(canvas) {
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  if (blob.size > CAPTURE_LIMITS.bytes)
    throw Error('PNG exceeds the 24 MB limit. Capture a smaller region.');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const parts = [];
  for (let i = 0; i < bytes.length; i += 8192)
    parts.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
  return 'data:image/png;base64,' + btoa(parts.join(''));
}
export async function captureScreenshot({
  identity,
  mode,
  hideFixed,
  language,
  api,
  capture,
  verify,
  isOwnerAlive = async () => true,
  operationId,
}) {
  const id = operationId || crypto.randomUUID(),
    deadline = Date.now() + CAPTURE_LIMITS.duration;
  // Confirmation expires after consumption; the bounded operation has its own deadline.
  const operation = { ...identity, expires: deadline };
  let canvas;
  const page = async (action, options = {}) => {
    await verify(operation);
    const result = (
      await api.scripting.executeScript({
        target: { tabId: operation.tabId, frameIds: [0] },
        func: mode === 'container' ? captureContainerPage : capturePage,
        args: [action, { ...options, id, language }],
      })
    )[0].result;
    if (!result?.ok) throw Error(result?.error || 'Screenshot page operation failed.');
    return result.value;
  };
  const authorize = async () => {
    if (Date.now() >= deadline || !(await isOwnerAlive()))
      throw Error('Screenshot cancelled or timed out.');
  };
  try {
    await authorize();
    if (mode === 'region') {
      const selection = await page('select');
      const checkSelection = async () => {
        await authorize();
        const [current] = await api.scripting.executeScript({
          target: { tabId: operation.tabId, frameIds: [0] },
          func: () => ({
            x: scrollX,
            y: scrollY,
            width: innerWidth,
            height: innerHeight,
            scale: devicePixelRatio,
          }),
        });
        const m = selection.metrics,
          c = current.result;
        if (
          c.x !== m.rawX ||
          c.y !== m.rawY ||
          c.width !== m.innerWidth ||
          c.height !== m.innerHeight ||
          c.scale !== m.scale
        )
          throw Error('The selected page moved or resized. Select again.');
      };
      const bitmap = await createImageBitmap(imageBlob(await capture(operation, checkSelection)));
      try {
        const r = regionPixels(
          selection.rect,
          { width: selection.metrics.innerWidth, height: selection.metrics.innerHeight },
          bitmap,
        );
        canvas = new OffscreenCanvas(r.width, r.height);
        canvas
          .getContext('2d')
          .drawImage(bitmap, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height);
      } finally {
        bitmap.close();
      }
    } else {
      if (mode === 'container') await page('choose');
      const initial = await page('begin');
      const tiles = planTiles(
        initial.width,
        initial.height,
        initial.viewportWidth,
        initial.viewportHeight,
      );
      let scaleX, scaleY;
      const checkSize = (m) => {
        if (
          m.width !== initial.width ||
          m.height !== initial.height ||
          m.innerWidth !== initial.innerWidth ||
          m.innerHeight !== initial.innerHeight ||
          m.scale !== initial.scale
        )
          throw Error('Page dimensions changed. Let the content load and try again.');
      };
      for (let i = 0; i < tiles.length; i++) {
        await authorize();
        const tile = tiles[i],
          moved = await page('move', {
            x: tile.scrollX,
            y: tile.scrollY,
            index: i,
            total: tiles.length,
            contentX: tile.x,
            contentY: tile.y,
            width: tile.width,
            height: tile.height,
          });
        checkSize(moved);
        const checkTile = async () => {
          await authorize();
          const m = await page('check');
          checkSize(m);
          if (Math.abs(m.x - moved.x) > 0.5 || Math.abs(m.y - moved.y) > 0.5)
            throw Error('The page scrolled during capture. Try again.');
        };
        const bitmap = await createImageBitmap(imageBlob(await capture(operation, checkTile)));
        try {
          const vx = bitmap.width / moved.innerWidth,
            vy = bitmap.height / moved.innerHeight;
          const sx = vx * (moved.elementScaleX || 1),
            sy = vy * (moved.elementScaleY || 1);
          if (!canvas) {
            scaleX = sx;
            scaleY = sy;
            const width = Math.round(initial.width * sx),
              height = Math.round(initial.height * sy);
            validateOutput(width, height);
            canvas = new OffscreenCanvas(width, height);
          } else if (Math.abs(sx - scaleX) > 0.001 || Math.abs(sy - scaleY) > 0.001)
            throw Error('Screenshot scale changed. Try again.');
          const dx = Math.round(tile.x * sx),
            dy = Math.round(tile.y * sy),
            dw = Math.round((tile.x + tile.width) * sx) - dx,
            dh = Math.round((tile.y + tile.height) * sy) - dy;
          const sourceX =
              mode === 'container'
                ? Math.round(moved.crop.left * vx)
                : Math.round((tile.x - moved.x) * sx),
            sourceY =
              mode === 'container'
                ? Math.round(moved.crop.top * vy)
                : Math.round((tile.y - moved.y) * sy);
          if (
            sourceX < 0 ||
            sourceY < 0 ||
            sourceX + dw > bitmap.width ||
            sourceY + dh > bitmap.height
          )
            throw Error('The page did not scroll to the expected position.');
          canvas.getContext('2d').drawImage(bitmap, sourceX, sourceY, dw, dh, dx, dy, dw, dh);
        } finally {
          bitmap.close();
        }
        await page('next', { hideFixed });
      }
    }
    await authorize();
    const output = await encode(canvas);
    await authorize();
    if (mode !== 'region') await page('check');
    return output;
  } finally {
    if (canvas) canvas.width = canvas.height = 0;
    try {
      await page('restore');
    } catch {
      /* Navigation destroys the old page; never mutate its replacement. */
    }
  }
}
