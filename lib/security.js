// Privilege boundaries shared by the background controller and its tests.
export function isWorkspaceSender(sender, runtime) {
  if (sender?.id !== runtime.id || (sender.frameId !== undefined && sender.frameId !== 0))
    return false;
  if (sender.documentLifecycle && sender.documentLifecycle !== 'active') return false;
  try {
    const actual = new URL(sender.url),
      expected = new URL(runtime.getURL('popup.html'));
    return (
      actual.protocol === expected.protocol &&
      actual.host === expected.host &&
      actual.pathname === expected.pathname
    );
  } catch {
    return false;
  }
}
export function isPageSender(sender, runtime) {
  return (
    sender?.id === runtime.id &&
    sender.frameId === 0 &&
    Number.isInteger(sender.tab?.id) &&
    (!sender.documentLifecycle || sender.documentLifecycle === 'active') &&
    samePage(sender.url, sender.tab.url) &&
    isPageURL(sender.url)
  );
}
export function isPageURL(value) {
  try {
    return ['https:', 'http:', 'file:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
export function samePage(a, b) {
  try {
    const x = new URL(a),
      y = new URL(b);
    x.hash = y.hash = '';
    return x.href === y.href;
  } catch {
    return false;
  }
}
export function assertMessage(message) {
  if (
    !message ||
    typeof message !== 'object' ||
    Array.isArray(message) ||
    typeof message.type !== 'string'
  )
    throw Error('Invalid UIAssistant message.');
}
export function validateSettings(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw Error('Invalid settings.');
  const result = {};
  const formats = ['hex', 'hex8', 'hex-no-hash', 'rgb', 'rgba', 'hsl', 'hsla', 'css'];
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'autoCopy') {
      result.autoCopy = true;
      continue;
    }
    if (
      (key === 'language' && ['en', 'fa'].includes(value)) ||
      (key === 'format' && formats.includes(value)) ||
      (key === 'sampleSize' && [1, 3, 5, 11, 25].includes(value)) ||
      (['outline', 'singleClick'].includes(key) && typeof value === 'boolean')
    )
      result[key] = value;
    else throw Error('Invalid setting: ' + key);
  }
  return result;
}

// In-memory capabilities, persisted ONLY in trusted storage.session so an idle MV3
// worker can restart without exposing grants to a page or keeping them on disk.
export function createGrants({ storage, now = Date.now, random = () => crypto.randomUUID() } = {}) {
  let queue = Promise.resolve();
  let memory = {};
  const key = 'uiaSecurityGrants';
  function transaction(fn) {
    const task = queue.then(async () => {
      const grants = storage ? (await storage.get(key))[key] || {} : memory;
      for (const [token, grant] of Object.entries(grants))
        if (grant.expires <= now()) delete grants[token];
      const result = await fn(grants);
      memory = grants;
      if (storage) await storage.set({ [key]: grants });
      return result;
    });
    queue = task.catch(() => {});
    return task;
  }
  return {
    issue: (kind, identity, ttl = 120000, extra = {}) =>
      transaction((grants) => {
        for (const [token, grant] of Object.entries(grants))
          if (grant.kind === kind && grant.tabId === identity.tabId) delete grants[token];
        if (Object.keys(grants).length >= 32)
          throw Error('Too many active tools. Close a tool and try again.');
        const token = random();
        grants[token] = { ...extra, ...identity, kind, expires: now() + ttl };
        return token;
      }),
    use: (token, kind, check = () => true, consume = false) =>
      transaction((grants) => {
        const grant = typeof token === 'string' ? grants[token] : null;
        if (!grant || grant.kind !== kind || !check(grant))
          throw Error(
            'Tool authorization expired or does not match this page. Start the tool again.',
          );
        if (consume) delete grants[token];
        return structuredClone(grant);
      }),
    revoke: (token) =>
      transaction((grants) => {
        delete grants[token];
      }),
    revokeTab: (tabId) =>
      transaction((grants) => {
        for (const [token, grant] of Object.entries(grants))
          if (grant.tabId === tabId) delete grants[token];
      }),
  };
}

// captureVisibleTab is window-scoped. Validate before AND after it and discard
// the result on tab/navigation races; never return pixels from a changed page.
export function createCaptureService({
  tabs,
  verify,
  now = Date.now,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
}) {
  let queue = Promise.resolve(),
    last = 0;
  return function capture(identity, authorize = async () => {}) {
    const task = queue.then(async () => {
      const check = async () => {
        await authorize();
        if (identity.expires && identity.expires <= now())
          throw Error('Capture authorization expired.');
        const tab = await tabs.get(identity.tabId);
        const [active] = await tabs.query({ active: true, windowId: identity.windowId });
        if (
          tab.windowId !== identity.windowId ||
          active?.id !== identity.tabId ||
          !isPageURL(tab.url) ||
          !samePage(tab.url, identity.url)
        )
          throw Error('The target tab changed. Select the page again.');
        await verify(identity);
      };
      await check();
      const delay = Math.max(0, 550 - (now() - last));
      if (delay) await sleep(delay);
      await check();
      last = now();
      const image = await tabs.captureVisibleTab(identity.windowId, { format: 'png' });
      await check();
      return image;
    });
    queue = task.catch(() => {});
    return task;
  };
}
