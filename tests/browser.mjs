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
  ext = new URL('artifacts/test-extension/', root),
  peer = new URL('artifacts/security-test-peer/', root);
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
await mkdir(peer, { recursive: true });
await writeFile(
  new URL('manifest.json', peer),
  JSON.stringify({
    manifest_version: 3,
    name: 'UIAssistant isolated security test peer',
    version: '1.0',
    background: { service_worker: 'peer.js' },
  }),
);
await writeFile(new URL('peer.js', peer), 'chrome.runtime.onMessage.addListener(() => {});');
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
      `--disable-extensions-except=${fileURLToPath(ext)},${fileURLToPath(peer)}`,
      `--load-extension=${fileURLToPath(ext)},${fileURLToPath(peer)}`,
    ],
    viewport: { width: 1100, height: 800 },
  },
);
const failures = [];
context.on('weberror', (error) => failures.push(error.error().message));
let diagnosticUI;
try {
  const worker =
    context.serviceWorkers().find((w) => w.url().endsWith('/background.js')) ||
    (await context.waitForEvent('serviceworker', {
      predicate: (w) => w.url().endsWith('/background.js'),
      timeout: 20000,
    }));
  const extensionId = new URL(worker.url()).host;
  await worker.evaluate(() => chrome.storage.local.clear());
  await worker.evaluate(() => {
    globalThis.__captureCount = 0;
    const original = chrome.tabs.captureVisibleTab.bind(chrome.tabs);
    chrome.tabs.captureVisibleTab = (...args) => {
      globalThis.__captureCount++;
      return original(...args);
    };
  });
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
  async function toggleLanguage() {
    const previous = await ui.locator('html').getAttribute('lang');
    await ui.locator('#language-btn').click();
    await ui.waitForFunction((previous) => document.documentElement.lang !== previous, previous);
  }

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
  await page.evaluate(() => {
    const fixture = document.createElement('section');
    fixture.id = 'semantics-fixture';
    fixture.style.cssText = 'position:absolute;top:560px;left:20px;background:white;padding:12px;';
    fixture.innerHTML = `<h3 id="heading-jump">Review heading order</h3>
      <img id="missing-alt" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3C/svg%3E" width="24" height="24">
      <img id="decorative-alt" alt="" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3C/svg%3E" width="24" height="24">
      <button id="unnamed-control" style="width:40px;height:28px"></button>
      <button id="named-control" aria-label="Save" style="width:40px;height:28px"></button>
      <label>Visible label <input id="labelled-control"></label>
      <span id="control-label">Reference label</span><input id="referenced-control" aria-labelledby="control-label">
      <input id="unlabelled-control"><div aria-hidden="true"><button id="hidden-control" style="width:40px;height:28px"></button></div>`;
    document.body.append(fixture);
  });
  await ui.locator('[data-tool="semantics"]').click();
  await ui.waitForFunction(() =>
    document.querySelector('#frontend-result').textContent.includes('missing-image-alternative'),
  );
  const semantics = await tool('semantics');
  assert.ok(
    semantics.issues.some(
      (i) => i.label === 'img#missing-alt' && i.type === 'missing-image-alternative',
    ),
  );
  assert.ok(
    semantics.issues.some(
      (i) => i.label === 'button#unnamed-control' && i.type === 'missing-control-name',
    ),
  );
  assert.ok(
    semantics.issues.some(
      (i) => i.label === 'input#unlabelled-control' && i.type === 'missing-control-name',
    ),
  );
  assert.ok(
    semantics.issues.some(
      (i) => i.label.includes('heading-jump') && i.type === 'heading-order-review',
    ),
  );
  for (const id of [
    'decorative-alt',
    'named-control',
    'labelled-control',
    'referenced-control',
    'hidden-control',
  ])
    assert.ok(!semantics.issues.some((i) => i.label.endsWith('#' + id)), id);
  const reportDownload = ui.waitForEvent('download');
  await ui.locator('#frontend-result button[data-icon="export"]').click();
  assert.equal((await reportDownload).suggestedFilename(), 'uiassistant-semantics.json');
  await page.locator('#semantics-fixture').evaluate((el) => el.remove());
  console.log(
    'PASS accessibility basics, valid labels/decorative-image exclusions and JSON report export',
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
  const pageMessage = (message) =>
    worker.evaluate(
      async ({ tabId, message }) =>
        (
          await chrome.scripting.executeScript({
            target: { tabId, frameIds: [0] },
            func: async (message) => {
              try {
                return await chrome.runtime.sendMessage(message);
              } catch (error) {
                return { blocked: true, error: error.message };
              }
            },
            args: [message],
          })
        )[0].result,
      { tabId, message },
    );
  const countCaptures = () => worker.evaluate(() => globalThis.__captureCount);
  const beforeAttack = await countCaptures();
  for (const message of [
    { type: 'CAPTURE' },
    { type: 'CAPTURE', token: 'forged' },
    { type: 'SCREENSHOT_PREPARE', tabId },
    { type: 'START_PICK', tabId },
    { type: 'TOOL_COPY', text: 'unauthorized clipboard' },
  ]) {
    const reply = await pageMessage(message);
    assert.ok(reply.ok === false || reply.blocked);
    assert.ok(!reply.image);
  }
  assert.equal(await countCaptures(), beforeAttack);
  const clipboardBefore = await ui.evaluate(() => navigator.clipboard.readText());
  const offscreenReply = await pageMessage({
    target: 'offscreen',
    text: 'forged offscreen clipboard request',
  });
  assert.ok(offscreenReply?.ok !== true);
  assert.equal(await ui.evaluate(() => navigator.clipboard.readText()), clipboardBefore);
  const deniedStorage = await worker.evaluate(
    async (tabId) =>
      (
        await chrome.scripting.executeScript({
          target: { tabId },
          func: async () => {
            try {
              await chrome.storage.local.get(null);
              return false;
            } catch {
              return true;
            }
          },
        })
      )[0].result,
    tabId,
  );
  assert.equal(deniedStorage, true);
  const peerWorker =
    context.serviceWorkers().find((w) => w.url().endsWith('/peer.js')) ||
    (await context.waitForEvent('serviceworker', {
      predicate: (w) => w.url().endsWith('/peer.js'),
    }));
  const peerReply = await peerWorker.evaluate(async (id) => {
    try {
      return await chrome.runtime.sendMessage(id, { type: 'SCREENSHOT_PREPARE', tabId: 1 });
    } catch {
      return { blocked: true };
    }
  }, extensionId);
  assert.ok(peerReply?.blocked || peerReply?.ok === false);
  assert.equal(await countCaptures(), beforeAttack);
  await ui.locator('[data-view="picker"]').click();
  await ui.locator('#pick-page').click();
  await page.waitForTimeout(650);
  const sampleCount = await countCaptures();
  await page.evaluate(() => {
    window.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 180, clientY: 210 }),
    );
    window.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, button: 0, clientX: 180, clientY: 210 }),
    );
    window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: ' ' }));
  });
  await page.waitForTimeout(650);
  assert.equal(await countCaptures(), sampleCount);
  await page.keyboard.press('Escape');
  const expiredReply = await pageMessage({ type: 'CAPTURE' });
  assert.equal(expiredReply.ok, false);
  console.log(
    'PASS cross-extension denial, forged/page capture denial, trusted storage and synthetic-event resistance',
  );
  await ui.bringToFront();
  await ui.locator('[data-view="screenshots"]').click();
  await ui.locator('#screenshot-prepare').evaluate((el) => el.click());
  assert.ok(await ui.locator('.screenshot-consent').isHidden());
  await ui.locator('#screenshot-prepare').click();
  await ui.locator('.screenshot-consent').waitFor({ state: 'visible' });
  await ui.locator('#screenshot-cancel').click();
  assert.ok(await ui.locator('.screenshot-consent').isHidden());
  assert.equal(await countCaptures(), sampleCount);
  await ui.locator('#screenshot-prepare').click();
  await ui.locator('.screenshot-consent').waitFor({ state: 'visible' });
  assert.ok((await ui.locator('#screenshot-target').textContent()).includes('127.0.0.1:4174'));
  const ticket = await worker.evaluate(
    async () =>
      Object.entries(
        (await chrome.storage.session.get('uiaSecurityGrants')).uiaSecurityGrants,
      ).find(([, g]) => g.kind === 'screenshot')[0],
  );
  const beforeScreenshot = await countCaptures();
  await ui.locator('#screenshot-capture').click();
  await ui.locator('#screenshot-image').waitFor({ state: 'visible' });
  assert.equal(await countCaptures(), beforeScreenshot + 1);
  assert.deepEqual(
    await ui.locator('#screenshot-image').evaluate((el) => [el.naturalWidth, el.naturalHeight]),
    [1100, 800],
  );
  const replay = await ui.evaluate(
    async ({ ticket, tabId }) =>
      chrome.runtime.sendMessage({ type: 'SCREENSHOT_CAPTURE', ticket, tabId }),
    { ticket, tabId },
  );
  assert.equal(replay.ok, false);
  assert.equal(await countCaptures(), beforeScreenshot + 1);
  await ui.bringToFront();
  const pngDownload = ui.waitForEvent('download');
  await ui.locator('#screenshot-save-png').click();
  const pngBytes = await readFile(await (await pngDownload).path());
  assert.deepEqual([...pngBytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const jpgDownload = ui.waitForEvent('download');
  await ui.locator('#screenshot-save-jpeg').click();
  const jpgBytes = await readFile(await (await jpgDownload).path());
  assert.equal(jpgBytes.readUInt16BE(0), 0xffd8);
  assert.equal(
    await worker.evaluate(async () =>
      JSON.stringify(await chrome.storage.local.get(null)).includes('data:image/png'),
    ),
    false,
  );
  await ui.locator('#screenshot-clear').click();
  assert.ok(await ui.locator('#screenshot-image').isHidden());
  await ui.locator('#screenshot-prepare').click();
  await ui.locator('.screenshot-consent').waitFor({ state: 'visible' });
  await page.reload();
  await ui.locator('#screenshot-capture').click();
  await ui.waitForFunction(
    () =>
      document.querySelector('#screenshot-status').textContent.includes('expired') ||
      document.querySelector('#screenshot-status').textContent.includes('navigat'),
  );
  assert.equal(await countCaptures(), beforeScreenshot + 1);
  assert.ok(await ui.locator('#screenshot-image').isHidden());
  await ui.bringToFront();
  await ui.locator('#screenshot-prepare').click();
  await ui.locator('.screenshot-consent').waitFor({ state: 'visible' });
  await ui.locator('#screenshot-capture').click();
  await ui.locator('#screenshot-image').waitFor({ state: 'visible' });
  await ui.bringToFront();
  console.log(
    'PASS confirmed viewport screenshot, PNG/JPEG bytes, no screenshot storage, replay and same-URL navigation denial',
  );
  async function prepareScreenshot(mode) {
    await ui.bringToFront();
    await ui.locator('[data-view="screenshots"]').click();
    await ui.locator('#screenshot-mode').selectOption(mode);
    await ui.locator('#screenshot-prepare').click();
    await ui.locator('.screenshot-consent').waitFor({ state: 'visible' });
    await ui.locator('#screenshot-capture').click();
  }
  async function screenshotPixel(x, y) {
    return ui.locator('#screenshot-image').evaluate(
      (img, { x, y }) => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        return [...ctx.getImageData(x, y, 1, 1).data];
      },
      { x, y },
    );
  }
  await page.evaluate(() => {
    const el = document.createElement('div');
    el.id = 'region-fixture';
    el.style.cssText =
      'position:fixed;left:40px;top:80px;width:300px;height:200px;background:#d61e3c;z-index:100';
    document.body.append(el);
  });
  await worker.evaluate((id) => chrome.tabs.setZoom(id, 1.25), tabId);
  const beforeRegion = await countCaptures();
  await prepareScreenshot('region');
  await page.locator('[data-uiassistant-tool]').waitFor({ state: 'attached' });
  await page.evaluate(() =>
    window.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, clientX: 184, clientY: 192, button: 0 }),
    ),
  );
  assert.equal(await countCaptures(), beforeRegion);
  await page.mouse.move(184, 192);
  await page.mouse.down();
  await page.mouse.move(64, 112, { steps: 5 });
  await page.mouse.up();
  await ui.locator('#screenshot-image').waitFor({ state: 'visible' });
  assert.deepEqual(
    await ui.locator('#screenshot-image').evaluate((img) => [img.naturalWidth, img.naturalHeight]),
    [150, 100],
  );
  assert.deepEqual(await screenshotPixel(75, 50), [214, 30, 60, 255]);
  await ui.locator('#toast').waitFor({ state: 'hidden' });
  await ui.screenshot({ path: fileURLToPath(new URL('artifacts/region-capture.png', root)) });
  assert.equal(await page.locator('[data-uiassistant-tool]').count(), 0);
  await prepareScreenshot('region');
  await page.locator('[data-uiassistant-tool]').waitFor({ state: 'attached' });
  const beforeCancelRegion = await countCaptures();
  await page.keyboard.press('Escape');
  await ui.waitForFunction(() =>
    document.querySelector('#screenshot-status').textContent.includes('cancelled'),
  );
  assert.equal(await countCaptures(), beforeCancelRegion);
  assert.equal(await page.locator('[data-uiassistant-tool]').count(), 0);
  await worker.evaluate((id) => chrome.tabs.setZoom(id, 1), tabId);
  await page.locator('#region-fixture').evaluate((el) => el.remove());
  console.log(
    'PASS reverse mouse selection at 125% zoom, cropped pixel color, synthetic-input denial and region cancellation',
  );
  await page.evaluate(() => {
    document.body.replaceChildren();
    document.body.style.cssText = 'margin:0;width:1460px;height:1900px;background:white;';
    document.documentElement.dir = 'ltr';
    document.documentElement.style.setProperty('scroll-behavior', 'smooth', 'important');
    document.documentElement.style.setProperty('scroll-snap-type', 'y mandatory', 'important');
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 2; col++) {
        const el = document.createElement('div');
        el.style.cssText = `position:absolute;left:${col * 730}px;top:${row * 650}px;width:730px;height:${row === 2 ? 600 : 650}px;background:${colors[row * 2 + col]}`;
        document.body.append(el);
      }
    const fixed = document.createElement('div');
    fixed.id = 'capture-fixed';
    fixed.style.cssText =
      'position:fixed;left:0;top:0;width:100%;height:24px;background:#112233;z-index:10';
    document.body.append(fixed);
    window.scrollTo({ left: 100, top: 300, behavior: 'instant' });
  });
  const originalScroll = await page.evaluate(() => [scrollX, scrollY]);
  const originalStyles = await page.evaluate(() => [
    document.documentElement.getAttribute('style'),
    document.body.getAttribute('style'),
    document.querySelector('#capture-fixed').getAttribute('style'),
  ]);
  await prepareScreenshot('full');
  await ui.locator('#screenshot-image').waitFor({ state: 'visible', timeout: 30000 });
  assert.deepEqual(
    await ui.locator('#screenshot-image').evaluate((img) => [img.naturalWidth, img.naturalHeight]),
    [1460, 1900],
  );
  for (const [x, y, rgb] of [
    [100, 400, [255, 0, 0]],
    [1200, 400, [0, 255, 0]],
    [100, 900, [0, 0, 255]],
    [1200, 900, [255, 255, 0]],
    [100, 1800, [255, 0, 255]],
    [1400, 1850, [0, 255, 255]],
  ])
    assert.deepEqual((await screenshotPixel(x, y)).slice(0, 3), rgb, `tile pixel ${x},${y}`);
  await ui.locator('#toast').waitFor({ state: 'hidden' });
  await ui.screenshot({ path: fileURLToPath(new URL('artifacts/fullpage-capture.png', root)) });
  assert.deepEqual(await page.evaluate(() => [scrollX, scrollY]), originalScroll);
  assert.deepEqual(
    await page.evaluate(() => [
      document.documentElement.getAttribute('style'),
      document.body.getAttribute('style'),
      document.querySelector('#capture-fixed').getAttribute('style'),
    ]),
    originalStyles,
  );
  assert.equal(await page.locator('[data-uiassistant-tool]').count(), 0);
  await prepareScreenshot('full');
  await page.locator('[data-uiassistant-tool]').waitFor({ state: 'attached' });
  await page.keyboard.press('Escape');
  await ui.waitForFunction(() =>
    document.querySelector('#screenshot-status').textContent.includes('cancelled'),
  );
  assert.deepEqual(await page.evaluate(() => [scrollX, scrollY]), originalScroll);
  assert.deepEqual(
    await page.evaluate(() => [
      document.documentElement.getAttribute('style'),
      document.body.getAttribute('style'),
      document.querySelector('#capture-fixed').getAttribute('style'),
    ]),
    originalStyles,
  );
  assert.equal(await page.locator('[data-uiassistant-tool]').count(), 0);
  await page.evaluate(() => (document.body.style.height = '40000px'));
  const beforeLarge = await countCaptures();
  await prepareScreenshot('full');
  await ui.waitForFunction(() =>
    document.querySelector('#screenshot-status').textContent.includes('too large'),
  );
  assert.equal(await countCaptures(), beforeLarge);
  assert.deepEqual(await page.evaluate(() => [scrollX, scrollY]), originalScroll);
  assert.equal(await page.locator('[data-uiassistant-tool]').count(), 0);
  assert.equal(
    await page.evaluate(() => document.documentElement.getAttribute('style')),
    originalStyles[0],
  );
  await page.evaluate(() => (document.body.style.height = '1900px'));
  await prepareScreenshot('full');
  await page.locator('[data-uiassistant-tool]').waitFor({ state: 'attached' });
  await ui.bringToFront();
  await ui.waitForFunction(
    () =>
      document.querySelector('#screenshot-status').textContent.includes('target tab changed') ||
      document.querySelector('#screenshot-status').textContent.includes('cancelled'),
  );
  assert.deepEqual(await page.evaluate(() => [scrollX, scrollY]), originalScroll);
  assert.equal(await page.locator('[data-uiassistant-tool]').count(), 0);
  assert.deepEqual(
    await page.evaluate(() => [
      document.documentElement.getAttribute('style'),
      document.body.getAttribute('style'),
      document.querySelector('#capture-fixed').getAttribute('style'),
    ]),
    originalStyles,
  );
  console.log(
    'PASS oversized-page rejection before capture and inactive-tab abort with restoration',
  );
  await page.reload();
  await ui.locator('#screenshot-mode').selectOption('viewport');
  await prepareScreenshot('viewport');
  await ui.locator('#screenshot-image').waitFor({ state: 'visible' });
  console.log(
    'PASS two-axis full-page stitching, bottom/right pixels, exact style/scroll restoration, and full-page cancellation',
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
  await toggleLanguage();
  assert.equal(await ui.locator('html').getAttribute('dir'), 'rtl');
  await ui.locator('#toast').waitFor({ state: 'hidden' });
  await ui.screenshot({
    path: fileURLToPath(new URL('artifacts/workspace-fa.png', root)),
    fullPage: true,
  });
  await toggleLanguage();
  await ui.locator('[data-view="workshop"]').click();
  assert.equal(await ui.locator('#unit-result').textContent(), '1.5rem');
  await ui.locator('#unit-from').selectOption('rem');
  await ui.locator('#unit-value').fill('1.5');
  await ui.locator('#unit-root').fill('20');
  assert.equal(await ui.locator('#unit-result').textContent(), '30px');
  await ui.locator('#fluid-minSize').fill('18');
  await ui.locator('#fluid-maxSize').fill('42');
  await ui.locator('#fluid-minViewport').fill('360');
  await ui.locator('#fluid-maxViewport').fill('1440');
  await ui.locator('#fluid-root').fill('20');
  await ui.locator('#fluid-preview-width').fill('900');
  assert.equal(
    await ui.locator('.fluid-preview').evaluate((el) => parseFloat(el.style.fontSize)),
    30,
  );
  await ui.locator('#fluid-result + button').click();
  assert.match(
    await ui.evaluate(() => navigator.clipboard.readText()),
    /^font-size: clamp\(0.9rem,/,
  );
  await ui.locator('#fluid-maxViewport').fill('360');
  assert.ok(await ui.locator('#fluid-result + button').isDisabled());
  await ui.locator('#fluid-maxViewport').fill('1440');
  assert.ok(await ui.locator('#fluid-result + button').isEnabled());
  await ui.locator('#shadow-inset').check();
  await ui.locator('#shadow-x').fill('-4');
  assert.match(await ui.locator('#shadow-result').textContent(), /inset -4px/);
  await toggleLanguage();
  await ui.waitForFunction(() =>
    document.querySelector('#view-title').textContent.includes('کارگاه'),
  );
  assert.ok(await ui.locator('#view-workshop').isVisible());
  await toggleLanguage();
  assert.ok(await ui.locator('#view-workshop').isVisible());
  console.log(
    'PASS CSS workshop calculations, preview, real clipboard, validation and navigation across language changes',
  );
  await ui.locator('#toast').waitFor({ state: 'hidden' });
  // Capture the actual popup dimensions as well as the expanded workspace.
  await ui.locator('[data-view="picker"]').click();
  await ui.evaluate(() => document.body.classList.remove('workspace'));
  await ui.setViewportSize({ width: 790, height: 600 });
  await ui.screenshot({ path: fileURLToPath(new URL('artifacts/picker.png', root)) });
  await ui.locator('[data-view="gradients"]').click();
  await ui.locator('[data-preset="0"]').click();
  await ui.screenshot({ path: fileURLToPath(new URL('artifacts/gradients.png', root)) });
  const views = [
    'picker',
    'gradients',
    'analyzer',
    'palettes',
    'history',
    'frontend',
    'workshop',
    'screenshots',
  ];
  async function checkLayout(label) {
    const problems = await ui.evaluate(() => {
      const main = document.querySelector('main');
      const issues = [];
      if (main.scrollWidth > main.clientWidth + 1)
        issues.push(`main overflow ${main.scrollWidth}/${main.clientWidth}`);
      if (document.documentElement.scrollWidth > innerWidth + 1) issues.push('document overflow');
      for (const button of document.querySelectorAll('button')) {
        if (!button.querySelector('svg'))
          issues.push('missing icon: ' + (button.id || button.textContent));
        if (!(button.textContent.trim() || button.getAttribute('aria-label') || button.title))
          issues.push('missing name: ' + button.outerHTML.slice(0, 100));
      }
      const buttons = [...document.querySelectorAll('button')].filter((b) => {
        const r = b.getBoundingClientRect();
        return (
          r.width &&
          r.height &&
          b.checkVisibility() &&
          !b.matches('.stop-handle,.preset-delete') &&
          r.top >= main.getBoundingClientRect().top &&
          r.bottom <= main.getBoundingClientRect().bottom
        );
      });
      for (let i = 0; i < buttons.length; i++)
        for (let j = i + 1; j < buttons.length; j++) {
          const a = buttons[i].getBoundingClientRect(),
            b = buttons[j].getBoundingClientRect();
          if (Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 3) {
            const gap = Math.max(a.left, b.left) - Math.min(a.right, b.right);
            if (gap < 4)
              issues.push(
                `button gap ${gap.toFixed(1)}: ${buttons[i].id || buttons[i].className}/${buttons[j].id || buttons[j].className}`,
              );
          }
        }
      return issues;
    });
    assert.deepEqual(problems, [], label);
  }
  for (const [mode, width, height] of [
    ['popup', 790, 600],
    ['wide', 1100, 800],
    ['compact', 480, 800],
  ]) {
    await ui.evaluate(
      (workspace) => document.body.classList.toggle('workspace', workspace),
      mode !== 'popup',
    );
    await ui.setViewportSize({ width, height });
    for (const language of ['en', 'fa']) {
      if ((await ui.locator('html').getAttribute('lang')) !== language) await toggleLanguage();
      for (const name of views) {
        await ui.locator(`[data-view="${name}"]`).click();
        await ui.waitForTimeout(60);
        await checkLayout(`${mode}/${language}/${name}`);
        if (name === 'gradients') {
          assert.ok(
            await ui
              .locator('.preset-wrapper')
              .first()
              .evaluate(
                (el) =>
                  el.querySelector('.preset-card').getBoundingClientRect().width >=
                  el.getBoundingClientRect().width - 1,
              ),
            'preset fills its grid cell',
          );
        }
        await ui.screenshot({
          path: fileURLToPath(new URL(`artifacts/review-${mode}-${language}-${name}.png`, root)),
        });
        const main = ui.locator('main');
        const scrollHeight = await main.evaluate((el) => el.scrollHeight);
        const step = await main.evaluate((el) => Math.max(100, el.clientHeight - 60));
        for (let y = step; y < scrollHeight; y += step) {
          await main.evaluate((el, y) => {
            el.scrollTop = y;
          }, y);
          await checkLayout(`${mode}/${language}/${name}/scroll-${y}`);
        }
        await ui.screenshot({
          path: fileURLToPath(
            new URL(`artifacts/review-${mode}-${language}-${name}-bottom.png`, root),
          ),
        });
      }
      for (const [trigger, dialog] of [
        ['#settings-btn', '#settings-dialog'],
        ['#import-gradient', '#import-dialog'],
        ['#gradient-adjust', '#adjust-dialog'],
        ['#new-palette', '#name-dialog'],
      ]) {
        await ui
          .locator(`[data-view="${trigger === '#new-palette' ? 'palettes' : 'gradients'}"]`)
          .click();
        await ui.locator(trigger).click();
        const bounds = await ui.locator(dialog).boundingBox();
        assert.ok(
          bounds.x >= 0 &&
            bounds.y >= 0 &&
            bounds.x + bounds.width <= width + 1 &&
            bounds.y + bounds.height <= height + 1,
          `${mode}/${language}/${dialog}`,
        );
        assert.ok(
          await ui.locator(dialog).evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
          `${dialog} content width`,
        );
        await ui.screenshot({
          path: fileURLToPath(
            new URL(`artifacts/review-${mode}-${language}-${dialog.slice(1)}.png`, root),
          ),
        });
        await ui.locator(`${dialog} .dialog-close`).click();
      }
    }
  }
  console.log(
    'PASS every page and dialog in EN/FA at popup, wide and compact sizes: icons, names, button spacing and horizontal overflow',
  );
  await ui.locator('[data-view="frontend"]').click();
  for (const action of ['tokens', 'layout', 'accessibility', 'semantics']) {
    await ui.locator(`[data-tool="${action}"]`).click();
    await ui.waitForFunction(
      () => document.querySelector('#view-frontend [role="status"]').textContent === 'انجام شد',
    );
    await ui.locator('#frontend-result').scrollIntoViewIfNeeded();
    await checkLayout('compact/fa/result-' + action);
  }
  assert.match(await ui.locator('#language-btn path').getAttribute('d'), /^M3 5h12/);
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
