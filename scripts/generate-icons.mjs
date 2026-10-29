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
export async function generateIcons(root) {
  await mkdir(new URL('../icons/', root), { recursive: true });
  for (const size of [16, 32, 48, 128]) {
    const raw = Buffer.alloc((size * 4 + 1) * size);
    const aa = 4;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        let total = [0, 0, 0, 0];
        for (let sy = 0; sy < aa; sy++)
          for (let sx = 0; sx < aa; sx++) {
            const px = (x + (sx + 0.5) / aa) / size,
              py = (y + (sy + 0.5) / aa) / size;
            const dx = Math.max(0.19 - px, px - 0.81, 0),
              dy = Math.max(0.19 - py, py - 0.81, 0);
            const inside = dx * dx + dy * dy <= 0.17 * 0.17;
            let color = inside ? [33 + px * 9, 32 + py * 8, 44 + py * 15, 255] : [0, 0, 0, 0];
            const u =
              (px >= 0.24 && px <= 0.35 && py >= 0.31 && py <= 0.59) ||
              (px >= 0.54 && px <= 0.65 && py >= 0.31 && py <= 0.59) ||
              ((px - 0.445) ** 2 + (py - 0.59) ** 2 <= 0.205 ** 2 &&
                (px - 0.445) ** 2 + (py - 0.59) ** 2 >= 0.095 ** 2 &&
                py >= 0.59);
            if (inside && u) color = [197, 176, 249, 255];
            if (inside && px >= 0.73 && px <= 0.82 && py >= 0.43 && py <= 0.77)
              color = [197, 176, 249, 255];
            if (inside && (px - 0.775) ** 2 + (py - 0.29) ** 2 < 0.055 ** 2)
              color = [195, 223, 167, 255];
            total = total.map((n, i) => n + color[i]);
          }
        const offset = y * (size * 4 + 1) + 1 + x * 4;
        total.forEach((n, i) => (raw[offset + i] = Math.round(n / (aa * aa))));
      }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(size);
    header.writeUInt32BE(size, 4);
    header[8] = 8;
    header[9] = 6;
    const png = Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', header),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ]);
    await writeFile(new URL(`../icons/${size}.png`, root), png);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await generateIcons(import.meta.url);
