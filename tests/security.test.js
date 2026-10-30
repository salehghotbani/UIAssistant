import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertMessage,
  isWorkspaceSender,
  isPageSender,
  validateSettings,
  createGrants,
  createCaptureService,
} from '../lib/security.js';

const runtime = { id: 'own-id', getURL: (path) => 'chrome-extension://own-id/' + path };
const ui = {
  id: 'own-id',
  url: runtime.getURL('popup.html?tab=7'),
  frameId: 0,
  documentId: 'ui-document',
};
const page = {
  id: 'own-id',
  url: 'https://example.test/private',
  frameId: 0,
  documentId: 'page-document',
  tab: { id: 7, url: 'https://example.test/private' },
};

test('only the exact top-level workspace is privileged; extension ID alone is insufficient', () => {
  assert.equal(isWorkspaceSender(ui, runtime), true);
  for (const patch of [
    { id: 'other-extension' },
    { frameId: 1 },
    { documentLifecycle: 'prerender' },
    { url: 'https://evil.test/?chrome-extension://own-id/popup.html' },
    { url: 'chrome-extension://own-id.evil/popup.html' },
    { url: runtime.getURL('offscreen.html') },
    { url: runtime.getURL('popup.html/extra') },
    { url: 'not a URL' },
  ])
    assert.equal(isWorkspaceSender({ ...ui, ...patch }, runtime), false, JSON.stringify(patch));
});
test('page senders are limited to the same top-frame regular page', () => {
  assert.equal(isPageSender(page, runtime), true);
  for (const patch of [
    { id: 'other' },
    { frameId: 2 },
    { frameId: undefined },
    { url: 'https://other.test/' },
    { documentLifecycle: 'cached' },
    { tab: {} },
  ])
    assert.equal(isPageSender({ ...page, ...patch }, runtime), false);
});
test('malformed messages and settings are rejected without prototype or unknown-key merging', () => {
  for (const value of [null, undefined, 1, [], {}, { type: 1 }])
    assert.throws(() => assertMessage(value));
  assert.deepEqual(validateSettings({ language: 'fa', autoCopy: false, sampleSize: 5 }), {
    language: 'fa',
    autoCopy: true,
    sampleSize: 5,
  });
  for (const patch of [
    { bad: true },
    { sampleSize: 1000 },
    { language: 'xx' },
    { singleClick: 'true' },
    JSON.parse('{"__proto__":{"polluted":true}}'),
  ])
    assert.throws(() => validateSettings(patch));
  assert.equal({}.polluted, undefined);
});
test('capture capabilities are scoped, single-use when consumed, and expire', async () => {
  let now = 1000,
    serial = 0;
  const grants = createGrants({ now: () => now, random: () => String(++serial) });
  const token = await grants.issue('screenshot', { tabId: 7, documentId: 'a' }, 30, {
    owner: 'ui-a',
  });
  await assert.rejects(grants.use(token, 'sample'));
  await assert.rejects(grants.use(token, 'screenshot', (g) => g.owner === 'ui-b'));
  await assert.rejects(grants.use(token, 'screenshot', (g) => g.tabId === 8));
  assert.equal((await grants.use(token, 'screenshot', () => true, true)).documentId, 'a');
  await assert.rejects(grants.use(token, 'screenshot'));
  const stale = await grants.issue('sample', { tabId: 7 }, 30);
  now = 1030;
  await assert.rejects(grants.use(stale, 'sample'));
});
test('grants survive worker recreation in session storage, and tab revocation invalidates them', async () => {
  let data = {},
    serial = 0;
  const storage = {
    get: async () => structuredClone(data),
    set: async (patch) => {
      data = structuredClone(patch);
    },
  };
  const options = { storage, random: () => String(++serial) };
  const first = createGrants(options);
  const old = await first.issue('sample', { tabId: 7 });
  const token = await first.issue('sample', { tabId: 7 });
  await assert.rejects(first.use(old, 'sample'));
  const resumed = createGrants(options);
  assert.equal((await resumed.use(token, 'sample')).tabId, 7);
  await resumed.revokeTab(7);
  await assert.rejects(resumed.use(token, 'sample'));
});

function captureFixture() {
  const state = {
    active: 7,
    tab: { id: 7, windowId: 2, url: 'https://example.test/private' },
    calls: 0,
    valid: true,
    after: () => {},
  };
  const tabs = {
    get: async () => ({ ...state.tab }),
    query: async () => [{ id: state.active }],
    captureVisibleTab: async () => {
      state.calls++;
      state.after();
      return 'private-pixels';
    },
  };
  const identity = { tabId: 7, windowId: 2, url: state.tab.url };
  const capture = createCaptureService({
    tabs,
    now: () => 2000,
    sleep: async () => {},
    verify: async () => {
      if (!state.valid) throw Error('Document changed');
    },
  });
  return { state, identity, capture };
}
test('capture refuses inactive tabs, privileged URLs and invalid document identities before the API call', async () => {
  for (const change of [
    (s) => (s.active = 8),
    (s) => (s.tab.url = 'chrome://settings/'),
    (s) => (s.valid = false),
    (s) => (s.tab.windowId = 3),
  ]) {
    const { state, identity, capture } = captureFixture();
    change(state);
    await assert.rejects(capture(identity));
    assert.equal(state.calls, 0);
  }
});
test('pixels are discarded when tabs, URLs or documents change during the API call', async () => {
  for (const change of [
    (s) => (s.active = 8),
    (s) => (s.tab.url = 'https://other.test/'),
    (s) => (s.valid = false),
  ]) {
    const { state, identity, capture } = captureFixture();
    state.after = () => change(state);
    await assert.rejects(capture(identity));
    assert.equal(state.calls, 1);
  }
});
test('revoked or expired authorization cannot capture; failed requests do not poison the queue', async () => {
  const { state, identity, capture } = captureFixture();
  await assert.rejects(
    capture(identity, async () => {
      throw Error('Revoked');
    }),
  );
  await assert.rejects(capture({ ...identity, expires: 1999 }));
  assert.equal(state.calls, 0);
  assert.equal(await capture(identity), 'private-pixels');
  assert.equal(state.calls, 1);
});
test('queued capture rechecks authorization after its rate-limit wait', async () => {
  let revoked = false,
    calls = 0;
  const tabs = {
    get: async () => ({ windowId: 2, url: 'https://example.test/' }),
    query: async () => [{ id: 7 }],
    captureVisibleTab: async () => {
      calls++;
      return 'pixels';
    },
  };
  const capture = createCaptureService({
    tabs,
    verify: async () => {},
    now: () => 2000,
    sleep: async () => {
      revoked = true;
    },
  });
  const identity = { tabId: 7, windowId: 2, url: 'https://example.test/' };
  await capture(identity);
  await assert.rejects(
    capture(identity, async () => {
      if (revoked) throw Error('Revoked');
    }),
  );
  assert.equal(calls, 1);
});
