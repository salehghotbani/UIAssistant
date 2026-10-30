import { writeFile, mkdir } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type),
    size = Buffer.alloc(4),
    crc = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, crc]);
}
const corners = [
  [0.24, 0.42, 0.24, 0.24],
  [0.24, 0.24, 0.42, 0.24],
  [0.58, 0.24, 0.76, 0.24],
  [0.76, 0.24, 0.76, 0.42],
  [0.76, 0.58, 0.76, 0.76],
  [0.76, 0.76, 0.58, 0.76],
  [0.42, 0.76, 0.24, 0.76],
  [0.24, 0.76, 0.24, 0.58],
];
const pointer = [
  [0.39, 0.34],
  [0.7, 0.61],
  [0.56, 0.63],
  [0.5, 0.78],
];
function segmentDistance(x, y, [x1, y1, x2, y2]) {
  const t = Math.max(
    0,
    Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / ((x2 - x1) ** 2 + (y2 - y1) ** 2)),
  );
  return Math.hypot(x - x1 - t * (x2 - x1), y - y1 - t * (y2 - y1));
}
function polygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i],
      [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export async function generateIcons(root) {
  await mkdir(new URL('../icons/', root), { recursive: true });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#7c3aed"/><stop offset="1" stop-color="#4338ca"/></linearGradient></defs><rect x="40" y="40" width="920" height="920" rx="200" fill="url(#g)"/><g fill="none" stroke="#fff" stroke-width="65" stroke-linecap="round" stroke-linejoin="round"><path d="M240 420V240H420M580 240H760V420M760 580V760H580M420 760H240V580"/></g><path fill="#9ff4d5" d="M390 340 700 610 560 630 500 780Z"/></svg>\n`;
  await writeFile(new URL('../icons/mark.svg', root), svg);
  for (const size of [16, 32, 48, 128, 256, 512]) {
    const raw = Buffer.alloc((size * 4 + 1) * size),
      aa = 4;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const total = [0, 0, 0, 0];
        for (let sy = 0; sy < aa; sy++)
          for (let sx = 0; sx < aa; sx++) {
            const u = (x + (sx + 0.5) / aa) / size,
              v = (y + (sy + 0.5) / aa) / size;
            // Store listing icon: 96px square artwork inside a transparent 128px image.
            const px = size === 128 ? ((u - 0.125) * 0.92) / 0.75 + 0.04 : u,
              py = size === 128 ? ((v - 0.125) * 0.92) / 0.75 + 0.04 : v;
            const dx = Math.max(0.24 - px, px - 0.76, 0),
              dy = Math.max(0.24 - py, py - 0.76, 0);
            if (dx * dx + dy * dy > 0.2 * 0.2) continue;
            const t = (px + py) / 2;
            let color = [124 + (67 - 124) * t, 58 + (56 - 58) * t, 237 + (202 - 237) * t];
            if (corners.some((line) => segmentDistance(px, py, line) <= 0.0325))
              color = [255, 255, 255];
            if (polygon(px, py, pointer)) color = [159, 244, 213];
            for (let i = 0; i < 3; i++) total[i] += color[i];
            total[3]++;
          }
        const offset = y * (size * 4 + 1) + 1 + x * 4;
        for (let i = 0; i < 3; i++) raw[offset + i] = Math.round(total[i] / Math.max(1, total[3]));
        raw[offset + 3] = Math.round((total[3] / (aa * aa)) * 255);
      }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(size);
    header.writeUInt32BE(size, 4);
    header[8] = 8;
    header[9] = 6;
    await writeFile(
      new URL(`../icons/${size}.png`, root),
      Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        chunk('IHDR', header),
        chunk('IDAT', deflateSync(raw)),
        chunk('IEND', Buffer.alloc(0)),
      ]),
    );
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await generateIcons(import.meta.url);
