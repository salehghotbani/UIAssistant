import { copyText } from './lib/clipboard.js';
import { api } from './lib/browser.js';
import { parseColor, formatColor } from './lib/color.js';
import { readStore, writeStore } from './lib/store.js';
import { pageAnalyzer } from './lib/analyzer.js';
import { pageTools } from './lib/page-tools.js';
import { captureScreenshot } from './lib/screenshot-capture.js';
import { createPreviewJobs, holdPreview } from './lib/preview-jobs.js';
import { capturePage } from './lib/capture-page.js';
import { captureContainerPage } from './lib/capture-container.js';
import {
  assertMessage,
  isWorkspaceSender,
  isPageSender,
  isPageURL,
  samePage,
  validateSettings,
  createGrants,
  createCaptureService,
} from './lib/security.js';

const grants = createGrants({ storage: api.storage.session });
const securityReady = (async () => {
  for (const area of [api.storage.local, api.storage.session]) {
    if (!area?.setAccessLevel) continue;
    try {
      await area.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
    } catch {
      await area.setAccessLevel('TRUSTED_CONTEXTS');
    }
  }
})();
securityReady.catch(() => {});
let storeQueue = Promise.resolve();
const screenshotJobs = new Map();
const previews = createPreviewJobs({
  onRemove: (tabId) => api.action.setBadgeText({ tabId, text: '' }).catch(() => {}),
});
async function performScreenshot(identity, job) {
  const tabId = identity.tabId;
  screenshotJobs.set(tabId, job);
  job.operationId = crypto.randomUUID();
  try {
    await verifyDocument(identity);
    await api.scripting.executeScript({
      target: { tabId },
      func: pageTools,
      args: ['capture-cleanup'],
    });
    await api.scripting.executeScript({ target: { tabId }, func: pageAnalyzer, args: ['clear'] });
    await api.tabs.sendMessage(tabId, { type: 'UIA_HIDE' }, { frameId: 0 });
    await new Promise((r) => setTimeout(r, 80));
    if (job.cancelled) throw Error('Screenshot cancelled.');
    const image =
      identity.mode === 'viewport'
        ? await capture(identity)
        : await captureScreenshot({
            identity,
            mode: identity.mode,
            hideFixed: identity.hideFixed,
            language: identity.language,
            api,
            capture,
            verify: verifyDocument,
            isOwnerAlive: async () => !job.cancelled,
            operationId: job.operationId,
          });
    if (job.cancelled) throw Error('Screenshot cancelled.');
    return { image, capturedAt: Date.now() };
  } finally {
    if (screenshotJobs.get(tabId) === job) screenshotJobs.delete(tabId);
  }
}
function serialized(fn) {
  const task = storeQueue.then(fn);
  storeQueue = task.catch(() => {});
  return task;
}
async function copy(text) {
  return copyText(text, api);
}
async function verifyDocument(identity) {
  const [result] = await api.scripting.executeScript({
    target: { tabId: identity.tabId, frameIds: [0] },
    func: () => globalThis.__uiaDocumentIdentity,
  });
  if (
    result.result !== identity.nonce ||
    (identity.documentId && result.documentId && result.documentId !== identity.documentId)
  )
    throw Error('The page navigated. Start the tool again.');
}
const capture = createCaptureService({ tabs: api.tabs, verify: verifyDocument });
const ownerKey = (sender) => sender.documentId || `${sender.tab?.id ?? 'popup'}:${sender.url}`;
function matchesPage(grant, sender) {
  return (
    grant.tabId === sender.tab.id &&
    samePage(grant.url, sender.url) &&
    (!grant.documentId || !sender.documentId || grant.documentId === sender.documentId)
  );
}
async function pageGrant(message, sender, kind, consume = false) {
  const grant = await grants.use(message.token, kind, (g) => matchesPage(g, sender), consume);
  await verifyDocument(grant);
  return grant;
}
async function record(color, source = 'picker', lastSample) {
  const c = typeof color === 'string' ? parseColor(color) : parseColor(formatColor(color, 'rgba'));
  if (!c) throw new Error('Invalid color.');
  return serialized(async () => {
    const state = await readStore(),
      value = formatColor(c);
    const history = [
      { color: value, at: Date.now(), source },
      ...state.history.filter((x) => x.color !== value),
    ].slice(0, 200);
    await writeStore({ color: c, history, ...(lastSample ? { lastSample } : {}), lastError: null });
    let copyError = null;
    if (state.settings.autoCopy) {
      try {
        await copy(formatColor(c, state.settings.format));
      } catch (e) {
        copyError = e.message;
      }
    }
    return { color: c, copyError };
  });
}
async function pageReady(tabId) {
  await securityReady;
  if (!Number.isInteger(tabId) || tabId < 0) throw Error('Select a website tab first.');
  const tab = await api.tabs.get(tabId);
  if (!isPageURL(tab.url))
    throw new Error(
      'Open a regular website first. Browser settings and extension pages cannot be inspected.',
    );
  await api.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    files: ['vendor/purify.min.js', 'content.js'],
  });
  const [document] = await api.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    func: (candidate) => ({
      nonce: (globalThis.__uiaDocumentIdentity ||= candidate),
      url: location.href,
    }),
    args: [crypto.randomUUID()],
  });
  if (!samePage(document.result.url, tab.url)) throw Error('The page navigated. Start again.');
  return { ...tab, tabId, nonce: document.result.nonce, documentId: document.documentId };
}
async function start(tabId, mode = 'pixel') {
  if (screenshotJobs.has(tabId)) throw Error('Finish or cancel the current screenshot first.');
  if (!['pixel', 'area'].includes(mode)) throw Error('Invalid sampling mode.');
  const identity = await pageReady(tabId);
  await api.scripting.executeScript({ target: { tabId }, func: pageTools, args: ['cancel'] });
  await api.scripting.executeScript({ target: { tabId }, func: pageAnalyzer, args: ['clear'] });
  await api.tabs.sendMessage(tabId, { type: 'UIA_HIDE' });
  const token = await grants.issue('sample', identity, 120000);
  const image = await capture(identity, () => grants.use(token, 'sample')),
    state = await readStore();
  return api.tabs.sendMessage(
    tabId,
    {
      type: 'UIA_START',
      image,
      mode,
      settings: state.settings,
      token,
      nonce: identity.nonce,
    },
    { frameId: 0 },
  );
}
async function resample(tabId) {
  if (screenshotJobs.has(tabId)) throw Error('Finish or cancel the current screenshot first.');
  const state = await readStore(),
    last = state.lastSample;
  if (!last) throw new Error('Pick a page color first to save a sample location.');
  const tab = await pageReady(tabId);
  await api.scripting.executeScript({ target: { tabId }, func: pageTools, args: ['cancel'] });
  if (tab.url !== last.url)
    throw new Error('Return to the same page before resampling the last location.');
  await api.scripting.executeScript({ target: { tabId }, func: pageAnalyzer, args: ['clear'] });
  await api.tabs.sendMessage(tabId, { type: 'UIA_HIDE' });
  const token = await grants.issue('sample', tab, 30000);
  const image = await capture(tab, () => grants.use(token, 'sample'));
  return api.tabs.sendMessage(
    tabId,
    {
      type: 'UIA_RESAMPLE',
      image,
      last,
      settings: state.settings,
      token,
      nonce: tab.nonce,
    },
    { frameId: 0 },
  );
}
async function handle(message, sender) {
  await securityReady;
  const fromWorkspace = isWorkspaceSender(sender, api.runtime);
  const tabId = fromWorkspace ? message.tabId : sender.tab?.id;
  switch (message.type) {
    case 'SCREENSHOT_PREPARE': {
      if (screenshotJobs.has(tabId)) throw Error('A screenshot is already running in this tab.');
      const mode = message.mode || 'viewport';
      if (!['viewport', 'full', 'region', 'container'].includes(mode))
        throw Error('Invalid screenshot mode.');
      const identity = await pageReady(tabId);
      const ticket = await grants.issue('screenshot', identity, 30000, {
        owner: ownerKey(sender),
        mode,
        hideFixed: message.hideFixed !== false,
        language: message.language === 'fa' ? 'fa' : 'en',
      });
      return { ticket, title: identity.title || '', url: identity.url };
    }
    case 'SCREENSHOT_START':
    case 'SCREENSHOT_CAPTURE': {
      if (screenshotJobs.has(tabId)) throw Error('A screenshot is already running in this tab.');
      const identity = await grants.use(
        message.ticket,
        'screenshot',
        (g) => g.owner === ownerKey(sender) && g.tabId === tabId,
        true,
      );
      if (message.type === 'SCREENSHOT_CAPTURE')
        return performScreenshot(identity, { cancelled: false });
      const job = previews.create(identity);
      try {
        await api.scripting.executeScript({
          target: { tabId, frameIds: [0] },
          func: holdPreview,
          args: [{ token: job.holdToken, expires: job.expires, language: identity.language }],
        });
      } catch (error) {
        previews.remove(tabId);
        throw error;
      }
      job.done = performScreenshot(identity, job)
        .then((result) => {
          if (previews.get(tabId) !== job || job.cancelled) return;
          job.image = result.image;
          job.capturedAt = result.capturedAt;
          job.status = 'ready';
          api.action.setBadgeText({ tabId, text: '✓' }).catch(() => {});
          try {
            job.port?.postMessage({ status: 'ready' });
          } catch {}
        })
        .catch((error) => {
          if (previews.get(tabId) !== job) return;
          job.error = error.message;
          job.status = 'error';
          api.action.setBadgeText({ tabId, text: '!' }).catch(() => {});
        });
      return previews.describe(tabId);
    }
    case 'SCREENSHOT_STATUS':
      return previews.describe(tabId);
    case 'SCREENSHOT_PREVIEW':
      await api.action.setBadgeText({ tabId, text: '' });
      return previews.image(tabId, message.jobId);
    case 'SCREENSHOT_DISCARD': {
      const job = previews.get(tabId);
      if (job && message.jobId && job.id !== message.jobId)
        throw Error('The preview changed. Reopen the popup.');
      previews.remove(tabId);
      if (job?.operationId && job.status === 'running') {
        try {
          await verifyDocument(job);
          await api.scripting.executeScript({
            target: { tabId, frameIds: [0] },
            func: job.mode === 'container' ? captureContainerPage : capturePage,
            args: ['cancel', { id: job.operationId }],
          });
          await Promise.race([job.done, new Promise((resolve) => setTimeout(resolve, 700))]);
        } catch {}
      }
      return {};
    }
    case 'SCREENSHOT_CANCEL':
      await grants.use(message.ticket, 'screenshot', (g) => g.owner === ownerKey(sender), true);
      return {};
    case 'FRONTEND_TOOL': {
      if (screenshotJobs.has(tabId)) throw Error('Finish or cancel the current screenshot first.');
      if (
        ![
          'inspect',
          'typography',
          'measure',
          'layout',
          'accessibility',
          'semantics',
          'tokens',
          'highlight',
          'reference',
          'direction',
          'restore',
          'cancel',
        ].includes(message.action)
      )
        throw Error('Unknown frontend tool.');
      const identity = await pageReady(tabId);
      await api.tabs.sendMessage(tabId, { type: 'UIA_HIDE' });
      const token = ['inspect', 'typography', 'measure'].includes(message.action)
        ? await grants.issue('tool', identity, 300000, { action: message.action })
        : undefined;
      return (
        await api.scripting.executeScript({
          target: { tabId },
          func: pageTools,
          args: [message.action, { ...message.options, authorization: token }],
        })
      )[0].result;
    }
    case 'TOOL_RESULT': {
      const grant = await pageGrant(message, sender, 'tool');
      if (message.result?.kind !== grant.action || JSON.stringify(message.result).length > 200000)
        throw Error('Invalid tool result.');
      await writeStore({ toolResult: message.result });
      return {};
    }
    case 'TOOL_COPY':
      await pageGrant(message, sender, 'tool');
      await copy(String(message.text).slice(0, 100000));
      return {};
    case 'START_PICK':
      return start(tabId, message.mode);
    case 'CAPTURE': {
      const identity = await pageGrant(message, sender, 'sample');
      return {
        image: await capture(identity, () =>
          grants.use(message.token, 'sample', (g) => matchesPage(g, sender)),
        ),
      };
    }
    case 'END_SAMPLE':
      await pageGrant(message, sender, 'sample', true);
      return {};
    case 'PICKED': {
      const identity = await pageGrant(message, sender, 'sample', true);
      if (JSON.stringify(message.location).length > 4000) throw Error('Invalid sample location.');
      const result = await record(message.color, 'page', {
        ...message.location,
        url: sender.tab.url,
        tabId,
      });
      const openToken = await grants.issue('notification', identity, 10000);
      return { ...result, openToken };
    }
    case 'SET_COLOR':
      return record(message.color, message.source);
    case 'RESAMPLE':
      return resample(tabId);
    case 'ANALYZE': {
      await pageReady(tabId);
      return (
        await api.scripting.executeScript({
          target: { tabId },
          func: pageAnalyzer,
          args: ['analyze'],
        })
      )[0].result;
    }
    case 'HIGHLIGHT':
    case 'CLEAR_HIGHLIGHT':
      return (
        await api.scripting.executeScript({
          target: { tabId },
          func: pageAnalyzer,
          args: [message.type === 'HIGHLIGHT' ? 'highlight' : 'clear', message.color],
        })
      )[0].result;
    case 'COPY':
      await copy(String(message.text).slice(0, 100000));
      return {};
    case 'SETTINGS':
      return serialized(async () => {
        const state = await readStore();
        const settings = {
          ...state.settings,
          ...validateSettings(message.settings),
          autoCopy: true,
        };
        await writeStore({ settings });
        await api.action.setPopup({ popup: settings.singleClick ? '' : 'popup.html' });
        return { settings };
      });
    case 'OPEN_WORKSPACE':
      if (!fromWorkspace) await pageGrant(message, sender, 'notification', true);
      {
        const url = new URL(api.runtime.getURL('popup.html'));
        url.searchParams.set('tab', tabId);
        if (fromWorkspace && message.view === 'screenshots') {
          url.searchParams.set('view', 'screenshots');
          if (['full', 'region'].includes(message.mode)) url.searchParams.set('mode', message.mode);
        }
        await api.tabs.create({ url: url.href });
      }
      return {};
    default:
      throw new Error('Unknown UIAssistant action.');
  }
}
api.runtime.onMessage.addListener((message, sender, respond) => {
  try {
    assertMessage(message);
  } catch {
    return;
  }
  if (message.target === 'offscreen') return;
  const fromWorkspace = isWorkspaceSender(sender, api.runtime);
  if (
    !fromWorkspace &&
    (!isPageSender(sender, api.runtime) ||
      !['CAPTURE', 'PICKED', 'END_SAMPLE', 'OPEN_WORKSPACE', 'TOOL_RESULT', 'TOOL_COPY'].includes(
        message.type,
      ))
  ) {
    respond({ ok: false, error: 'Unauthorized UIAssistant sender or action.' });
    return;
  }
  handle(message, sender)
    .then((data) => respond({ ok: true, ...data }))
    .catch((e) => respond({ ok: false, error: e.message }));
  return true;
});
async function reportError(error) {
  await writeStore({ lastError: error.message });
  await api.action.setBadgeText({ text: '!' });
  await api.action.setBadgeBackgroundColor({ color: '#DC5470' });
}
api.commands.onCommand.addListener(async (command) => {
  try {
    const [tab] = await api.tabs.query({ active: true, lastFocusedWindow: true });
    if (command === 'pick-color') await start(tab.id);
    if (command === 'resample') await resample(tab.id);
  } catch (e) {
    await reportError(e);
  }
});
api.action.onClicked.addListener((tab) => start(tab.id).catch(reportError));
api.runtime.onInstalled.addListener(async () => {
  await securityReady;
  const state = await readStore();
  await api.action.setPopup({ popup: state.settings.singleClick ? '' : 'popup.html' });
});
api.tabs.onRemoved.addListener((tabId) => {
  grants.revokeTab(tabId).catch(() => {});
  previews.remove(tabId);
  const job = screenshotJobs.get(tabId);
  if (job) job.cancelled = true;
});
api.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status === 'loading' || change.url) {
    grants.revokeTab(tabId).catch(() => {});
    previews.remove(tabId);
    const job = screenshotJobs.get(tabId);
    if (job) job.cancelled = true;
  }
});
api.runtime.onConnect.addListener((port) => {
  if (port.name !== 'uia-preview-hold' || !isPageSender(port.sender, api.runtime)) {
    port.disconnect();
    return;
  }
  let attached = null;
  const timer = setTimeout(() => {
    if (!attached) port.disconnect();
  }, 2000);
  port.onMessage.addListener((message) => {
    const job = typeof message?.token === 'string' ? previews.find(message.token) : null;
    if (
      !job ||
      !matchesPage(job, port.sender) ||
      (attached && attached !== job) ||
      (job.port && job.port !== port)
    ) {
      port.disconnect();
      return;
    }
    attached = job;
    job.port = port;
    clearTimeout(timer);
    port.postMessage({ status: job.status, expires: job.expires });
  });
  port.onDisconnect.addListener(() => {
    clearTimeout(timer);
    if (attached?.port === port) {
      attached.port = null;
      if (previews.get(attached.tabId) === attached) previews.remove(attached.tabId);
    }
  });
});
