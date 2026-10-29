// Integration harness. Requires Playwright and a Chromium browser (not runtime dependencies).
// Only the isolated test copy receives host access, to emulate the activeTab grant in headless mode.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdir, cp, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url),
  { chromium } = require('playwright');
const root = new URL('../', import.meta.url),
  artifacts = new URL('artifacts/', root),
  ext = new URL('artifacts/test-extension/', root);
await mkdir(artifacts, { recursive: true });
await mkdir(ext, { recursive: true });
for (const path of [
  'manifest.json',
  'background.js',
  'content.js',
  'popup.html',
  'popup.js',
  'styles.css',
  'offscreen.html',
  'offscreen.js',
  'lib',
  'icons',
  'vendor',
])
  await cp(new URL(path, root), new URL(path, ext), { recursive: true });
const manifest = JSON.parse(await readFile(new URL('manifest.json', ext), 'utf8'));
manifest.host_permissions = ['<all_urls>'];
manifest.permissions.push('clipboardRead');
await writeFile(new URL('manifest.json', ext), JSON.stringify(manifest));
const server = createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(
    `<!doctype html><html><head><title>UIAssistant test canvas</title><style>body{margin:0;background:#f8f9fb;color:#202128;font:16px system-ui}h1{margin:30px}.target{position:absolute;left:100px;top:150px;width:200px;height:140px;background:#E75480}.target:hover{background:#34C7A0}.half{position:absolute;left:400px;top:150px;width:100px;height:100px;background:linear-gradient(to right,#ff0000 50%,#0000ff 50%)}.hidden{display:none;color:#010203}</style></head><body><h1>Color test canvas</h1><div id="sample" class="target"></div><div class="half"></div><p class="hidden">hidden</p><div id="shadow"></div><script>document.querySelector('#shadow').attachShadow({mode:'open'}).innerHTML='<p style="color:#123456">Shadow text</p>';</script></body></html>`,
  );
});
await new Promise((r) => server.listen(4174, '127.0.0.1', r));
const context = await chromium.launchPersistentContext(
  fileURLToPath(new URL(`artifacts/browser-profile-${Date.now()}/`, root)),
  {
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    executablePath:
      process.env.BROWSER_PATH ||
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    args: [
      `--disable-extensions-except=${fileURLToPath(ext)}`,
      `--load-extension=${fileURLToPath(ext)}`,
    ],
    viewport: { width: 1100, height: 800 },
  },
);
const failures = [];
context.on('weberror', (error) => failures.push(error.error().message));
let diagnosticUI;
try {
  const worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent('serviceworker', { timeout: 20000 }));
  const extensionId = new URL(worker.url()).host;
  await worker.evaluate(() => chrome.storage.local.clear());
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4174');
  await page.bringToFront();
  const tabId = await worker.evaluate(async () => {
    const tabs = await chrome.tabs.query({});
    return tabs.find((t) => t.url?.startsWith('http://127.0.0.1:4174')).id;
  });
  const ui = await context.newPage();
  diagnosticUI = ui;
  await ui.goto(`chrome-extension://${extensionId}/popup.html?tab=${tabId}`);
  await ui.waitForFunction(() => document.documentElement.dataset.ready === 'true');
  await ui.locator('#hex').fill('#E75480');
  await ui.locator('#hex').press('Tab');
  await ui.waitForFunction(
    () => document.querySelector('#formatted-color').textContent === '#E75480',
  );
  assert.equal(await ui.locator('#r').inputValue(), '231');
  await ui.waitForFunction(
    async () => (await navigator.clipboard.readText()) === document.querySelector('#hex').value,
  );
  await ui.locator('#copy-color').click();
  assert.equal(await ui.evaluate(() => navigator.clipboard.readText()), '#E75480');
  console.log('PASS color editing, conversion, persistence and real clipboard');
  await ui.locator('#plane-mode').selectOption('r');
  await ui.locator('#spectrum').click({ position: { x: 50, y: 50 } });
  assert.equal(await ui.locator('#r').inputValue(), '231');
  await ui.locator('#plane-mode').selectOption('h');
  console.log('PASS RGB component plane keeps the selected channel fixed');
  await ui.locator('[data-view="palettes"]').click();
  await ui.locator('[data-color="#6C5CE7"]').click();
  await ui.waitForTimeout(250);
  assert.equal(await ui.locator('#hex').inputValue(), '#6C5CE7');
  await ui.locator('#favorite').click();
  await ui.locator('#name-input').fill('Integration palette');
  await ui.locator('#name-form button[type=submit]').click();
  await ui.waitForTimeout(200);
  await ui.locator('[data-view="palettes"]').click();
  assert.equal(await ui.locator('#palette-name').textContent(), 'Integration palette');
  console.log('PASS built-in and custom palettes');
  await ui.locator('[data-view="gradients"]').click();
  await ui.locator('#import-gradient').click();
  await ui.locator('#import-css').fill('linear-gradient(90deg, rgba(255,0,0,.5), #0000ff)');
  await ui.locator('#apply-import').click();
  assert.equal(await ui.locator('[data-text-stop="0"]').inputValue(), '#FF000080');
  await ui.locator('#add-opacity').click();
  assert.equal(await ui.locator('[data-opacity-value]').count(), 3);
  await ui.locator('#gradient-reverse').click();
  await ui.locator('#gradient-compat').check();
  assert.match(await ui.locator('#gradient-code').textContent(), /-webkit-linear-gradient/);
  console.log('PASS CSS gradient imports, opacity and compatibility output');
  await ui.locator('[data-view="analyzer"]').click();
  await ui.locator('#analyze-page').click();
  await ui.waitForSelector('.analysis-row');
  assert.ok((await ui.locator('#analysis-colors').textContent()).includes('#E75480'));
  assert.ok((await ui.locator('#analysis-colors').textContent()).includes('#123456'));
  assert.ok(!(await ui.locator('#analysis-colors').textContent()).includes('#010203'));
  console.log('PASS page analysis, shadow DOM and hidden-element exclusion');
  await ui.locator('.analysis-row').filter({ hasText: '#E75480' }).locator('[data-locate]').click();
  await ui.locator('[data-view="picker"]').click();
  await ui.locator('#pick-page').click();
  await page.waitForTimeout(600);
  await page.mouse.move(180, 210);
  await page.mouse.click(180, 210);
  await page.waitForTimeout(1600);
  const picked = await worker.evaluate(
    async () => await chrome.storage.local.get(['color', 'history', 'lastSample']),
  );
  assert.deepEqual(picked.color, { r: 52, g: 199, b: 160, a: 1 });
  assert.ok(picked.lastSample);
  assert.equal(await ui.evaluate(() => navigator.clipboard.readText()), '#34C7A0');
  console.log('PASS screenshot sampling preserves dynamic hover color');
  await ui.bringToFront();
  await ui.locator('#pick-area').click();
  await page.waitForTimeout(600);
  await page.mouse.move(400, 150);
  await page.mouse.down();
  await page.mouse.move(500, 250, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(1600);
  const averaged = await worker.evaluate(
    async () => (await chrome.storage.local.get('color')).color,
  );
  assert.ok(
    Math.abs(averaged.r - 128) <= 2 && Math.abs(averaged.b - 128) <= 2 && averaged.g < 2,
    JSON.stringify(averaged),
  );
  console.log('PASS area-average sampling across two real page colors');
  await page.mouse.move(20, 20);
  await ui.bringToFront();
  await ui.locator('#resample').click();
  await page.waitForTimeout(800);
  const resampled = await worker.evaluate(
    async () => (await chrome.storage.local.get('color')).color,
  );
  assert.deepEqual(resampled, averaged);
  console.log('PASS last-location resampling from the expanded workspace');
  await ui.bringToFront();
  await ui.locator('#sample-size').selectOption('5');
  await worker.evaluate((id) => chrome.tabs.setZoom(id, 1.25), tabId);
  await ui.locator('#pick-page').click();
  await page.waitForTimeout(600);
  await page.locator('#sample').click({ position: { x: 50, y: 50 } });
  await page.waitForTimeout(1400);
  const zoomed = await worker.evaluate(async () => (await chrome.storage.local.get('color')).color);
  assert.deepEqual(zoomed, { r: 52, g: 199, b: 160, a: 1 });
  await worker.evaluate((id) => chrome.tabs.setZoom(id, 1), tabId);
  console.log('PASS 5×5 pixel sampling at 125% browser zoom');
  await page.evaluate(() => {
    document.documentElement.setAttribute('dir', 'auto');
    document.documentElement.style.setProperty('direction', 'ltr', 'important');
    const add = (id, text, style) => {
      const el = document.createElement('div');
      el.id = id;
      el.textContent = text;
      el.style.cssText = style;
      document.body.append(el);
    };
    add(
      'overflow-test',
      'overflow',
      'position:absolute;left:1400px;top:400px;width:120px;height:30px',
    );
    add(
      'clip-test',
      'A very long text that must be clipped',
      'position:absolute;left:20px;top:400px;width:50px;height:20px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis',
    );
    add(
      'contrast-test',
      'Low contrast text',
      'position:absolute;left:20px;top:450px;background:white;color:#aaa;font-size:16px',
    );
    add(
      'manual-test',
      'Gradient text',
      'position:absolute;left:20px;top:500px;background:linear-gradient(red,blue);color:white',
    );
  });
  await ui.bringToFront();
  await ui.locator('[data-view="frontend"]').click();
  const tool = async (action, options = {}) =>
    ui.evaluate(
      async ({ action, options, tabId }) =>
        chrome.runtime.sendMessage({ type: 'FRONTEND_TOOL', action, options, tabId }),
      { action, options, tabId },
    );
  const layout = await tool('layout');
  assert.ok(layout.ok);
  assert.ok(layout.issues.some((i) => i.label.includes('overflow-test')));
  assert.ok(layout.issues.some((i) => i.type === 'truncated-text'));
  const accessibility = await tool('accessibility');
  assert.ok(accessibility.issues.some((i) => i.label.includes('contrast-test') && i.suggestion));
  assert.ok(
    accessibility.issues.some(
      (i) => i.label.includes('manual-test') && i.type === 'manual-contrast-check',
    ),
  );
  await ui.locator('[data-tool="tokens"]').click();
  await ui.waitForFunction(() =>
    document.querySelector('#frontend-result').textContent.includes('fontSizes'),
  );
  assert.match(await ui.locator('#frontend-result').textContent(), /rgb\(/);
  console.log(
    'PASS layout findings, real background contrast, manual-review flags and design tokens',
  );
  await ui.locator('[data-tool="inspect"]').click();
  await page.locator('#sample').click();
  await ui.waitForFunction(() =>
    document.querySelector('#frontend-result').textContent.includes('padding-top'),
  );
  await ui.bringToFront();
  await ui.locator('[data-tool="typography"]').click();
  await page.locator('h1').click();
  await ui.waitForFunction(() =>
    document.querySelector('#frontend-result').textContent.includes('font-family'),
  );
  await ui.bringToFront();
  await ui.locator('[data-tool="measure"]').click();
  await page.locator('#sample').click();
  await page.locator('.half').click();
  await ui.waitForFunction(() =>
    document.querySelector('#frontend-result').textContent.includes('100.0px'),
  );
  console.log('PASS interactive element inspector, typography and two-element spacing ruler');
  await ui.bringToFront();
  await tool('restore');
  await ui.locator('#reference-file').setInputFiles(fileURLToPath(new URL('icons/128.png', root)));
  await ui.waitForFunction(
    () => document.querySelector('#view-frontend [role="status"]').textContent === 'Done',
  );
  assert.ok(await page.locator('[data-uiassistant-tool]').count());
  await tool('reference', { x: 40, y: 25, opacity: 0.25, width: 500 });
  await tool('direction', { direction: 'rtl' });
  assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
  await ui.locator('#restore-page').click();
  await page.waitForFunction(() => document.documentElement.getAttribute('dir') === 'auto');
  assert.equal(
    await page.evaluate(() => document.documentElement.style.getPropertyPriority('direction')),
    'important',
  );
  assert.equal(await page.locator('[data-uiassistant-tool]').count(), 0);
  console.log(
    'PASS local reference image, adjustable overlay, RTL preview and exact page restoration',
  );
  await ui.locator('#toast').waitFor({ state: 'hidden' });
  await ui.screenshot({
    path: fileURLToPath(new URL('artifacts/frontend-tools.png', root)),
    fullPage: true,
  });
  await ui.locator('[data-view="picker"]').click();

  await ui.bringToFront();
  await ui.locator('#hex').fill('#6C5CE7');
  await ui.locator('#hex').press('Tab');
  await ui.locator('#language-btn').click();
  assert.equal(await ui.locator('html').getAttribute('dir'), 'rtl');
  await ui.locator('#toast').waitFor({ state: 'hidden' });
  await ui.screenshot({
    path: fileURLToPath(new URL('artifacts/workspace-fa.png', root)),
    fullPage: true,
  });
  await ui.locator('#language-btn').click();
  // Capture the actual popup dimensions as well as the expanded workspace.
  await ui.evaluate(() => document.body.classList.remove('workspace'));
  await ui.setViewportSize({ width: 790, height: 600 });
  await ui.screenshot({ path: fileURLToPath(new URL('artifacts/picker.png', root)) });
  await ui.locator('[data-view="gradients"]').click();
  await ui.locator('[data-preset="0"]').click();
  await ui.screenshot({ path: fileURLToPath(new URL('artifacts/gradients.png', root)) });
  assert.deepEqual(failures, []);
  console.log('PASS English/Persian layouts and no browser runtime errors');
  console.log('Browser integration checks passed. Screenshots saved in artifacts/.');
} catch (e) {
  if (diagnosticUI) {
    console.error('UI error:', await diagnosticUI.locator('#toast').textContent());
    await diagnosticUI.screenshot({
      path: fileURLToPath(new URL('artifacts/failure.png', root)),
      fullPage: true,
    });
  }
  console.error('Runtime errors:', failures);
  throw e;
} finally {
  await context.close();
  await new Promise((r) => server.close(r));
}
