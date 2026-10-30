import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { copyText } from '../lib/clipboard.js';
import { firefoxManifest } from '../scripts/manifests.mjs';

test('Firefox manifest uses an event page and declares no data collection', async () => {
  const source = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url)));
  const firefox = firefoxManifest(source);
  assert.deepEqual(firefox.background, { scripts: ['background.js'], type: 'module' });
  assert.ok(!firefox.permissions.includes('offscreen'));
  assert.ok(firefox.permissions.includes('clipboardWrite'));
  assert.deepEqual(firefox.browser_specific_settings.gecko.data_collection_permissions.required, [
    'none',
  ]);
  assert.ok(source.background.service_worker);
  assert.ok(source.permissions.includes('offscreen'));
});

test('store metadata identifies the requested publisher and localizes without contact email', async () => {
  const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url)));
  assert.equal(manifest.author, 'saleh ghotbani');
  assert.equal(manifest.default_locale, 'en');
  for (const locale of ['en', 'fa']) {
    const messages = JSON.parse(
      await readFile(new URL(`../_locales/${locale}/messages.json`, import.meta.url)),
    );
    assert.ok(messages.extensionDescription.message.length <= 132);
    assert.ok(messages.extensionTitle.message.includes('UIAssistant'));
    assert.ok(!messages.extensionDescription.message.includes('@'));
  }
});

test('Firefox clipboard uses its background DOM without Chromium APIs', async () => {
  const values = [];
  await copyText(
    '#6C5CE7',
    {},
    { navigator: { clipboard: { writeText: async (value) => values.push(value) } } },
  );
  assert.deepEqual(values, ['#6C5CE7']);
  await assert.rejects(
    copyText(
      '#fff',
      {},
      {
        navigator: {
          clipboard: {
            writeText: async () => {
              throw Error('denied');
            },
          },
        },
      },
    ),
    /denied/,
  );
});

test('Chromium clipboard creates an offscreen document and propagates failures', async () => {
  const created = [],
    messages = [];
  const api = {
    offscreen: { createDocument: async (options) => created.push(options) },
    runtime: {
      getContexts: async () => [],
      sendMessage: async (m) => {
        messages.push(m);
        return { ok: true };
      },
    },
  };
  await copyText('rgb(1, 2, 3)', api, {});
  assert.equal(created[0].reasons[0], 'CLIPBOARD');
  assert.deepEqual(messages[0], { target: 'offscreen', text: 'rgb(1, 2, 3)' });
  api.runtime.getContexts = async () => [{}];
  api.runtime.sendMessage = async () => ({ ok: false });
  await assert.rejects(copyText('#fff', api, {}), /Clipboard is unavailable/);
});

test('native Firefox namespace takes priority and old auto-copy opt-out is migrated', async () => {
  globalThis.browser = {
    storage: { local: { get: async () => ({ settings: { autoCopy: false, format: 'rgb' } }) } },
  };
  globalThis.chrome = {};
  const { api } = await import('../lib/browser.js');
  assert.equal(api, globalThis.browser);
  const { readStore } = await import('../lib/store.js');
  const state = await readStore();
  assert.equal(state.settings.autoCopy, true);
  assert.equal(state.settings.format, 'rgb');
});
