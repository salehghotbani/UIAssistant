// Code-native brand graphics and actual integration screenshots; no remote assets.
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url),
  out = new URL('docs/publishing/assets/', root);
await mkdir(out, { recursive: true });
const svg = await readFile(new URL('icons/mark.svg', root));
const icon = 'data:image/svg+xml;base64,' + svg.toString('base64');
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
});
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [name, size] of [
    ['edge-logo-300.png', 300],
    ['firefox-icon-64.png', 64],
  ]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<body style="margin:0;background:transparent"><img src="${icon}" width="${size}" height="${size}"></body>`,
    );
    await page.locator('img').evaluate((el) => el.decode());
    await page.screenshot({ path: fileURLToPath(new URL(name, out)), omitBackground: true });
  }
  await copyFile(new URL('icons/128.png', root), new URL('store-icon-128.png', out));
  for (const [width, height, name] of [
    [440, 280, 'promo-small-440x280.png'],
    [1400, 560, 'promo-marquee-1400x560.png'],
  ]) {
    await page.setViewportSize({ width, height });
    await page.setContent(
      `<!doctype html><style>*{box-sizing:border-box}body{margin:0;height:100vh;background:linear-gradient(125deg,#211735,#443070);color:#fff;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:space-between;padding:8%;gap:5%}small{font-size:${width > 500 ? 22 : 12}px;letter-spacing:.16em;color:#b9f7df}h1{font-size:${width > 500 ? 86 : 34}px;margin:18px 0}p{font-size:${width > 500 ? 28 : 16}px;line-height:1.7;color:#eee5fb;margin:0}img{width:25%;flex-shrink:0}</style><div><small>FRONTEND TOOLKIT</small><h1>UIAssistant</h1><p>Inspect. Create. Capture.<br>Works locally in your browser.</p></div><img src="${icon}" alt="">`,
    );
    await page.locator('img').evaluate((el) => el.decode());
    await page.screenshot({ path: fileURLToPath(new URL(name, out)) });
  }
} finally {
  await browser.close();
}
for (const language of ['en', 'fa'])
  for (const name of ['picker', 'gradients', 'frontend', 'workshop', 'screenshots']) {
    const data = await readFile(new URL(`artifacts/store-${language}-${name}.png`, root));
    if (data.readUInt32BE(16) !== 1280 || data.readUInt32BE(20) !== 800)
      throw Error('Store screenshots must be real 1280×800 integration captures.');
    await writeFile(new URL(`${language}-${name}-1280x800.png`, out), data);
  }
console.log('Store icons, promotional graphics and ten actual localized screenshots prepared.');
