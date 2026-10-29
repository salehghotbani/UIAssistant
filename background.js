import { copyText } from './lib/clipboard.js';
import { api } from './lib/browser.js';
import { parseColor, formatColor } from './lib/color.js';
import { readStore, writeStore } from './lib/store.js';
import { pageAnalyzer } from './lib/analyzer.js';
import { pageTools } from './lib/page-tools.js';

let storeQueue = Promise.resolve(),
  captureQueue = Promise.resolve(),
  lastCapture = 0;
function serialized(fn) {
  const task = storeQueue.then(fn);
  storeQueue = task.catch(() => {});
  return task;
}
async function copy(text) {
  return copyText(text, api);
}
async function capture(tabId) {
  const task = captureQueue.then(async () => {
    const tab = await api.tabs.get(tabId);
    const [active] = await api.tabs.query({ active: true, windowId: tab.windowId });
    if (active?.id !== tabId)
      throw new Error('Keep the sampled page active while picking a color.');
    const delay = Math.max(0, 550 - (Date.now() - lastCapture));
    if (delay) await new Promise((r) => setTimeout(r, delay));
    // Recheck after the rate-limit wait; never capture a newly selected tab.
    const [current] = await api.tabs.query({ active: true, windowId: tab.windowId });
    if (current?.id !== tabId) throw new Error('The active tab changed. Start picking again.');
    lastCapture = Date.now();
    return api.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  });
  captureQueue = task.catch(() => {});
  return task;
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
  const tab = await api.tabs.get(tabId);
  if (!tab.url || !/^https?:|^file:/.test(tab.url))
    throw new Error(
      'Open a regular website first. Browser settings and extension pages cannot be inspected.',
    );
  await api.scripting.executeScript({
    target: { tabId },
    files: ['vendor/purify.min.js', 'content.js'],
  });
  return tab;
}
async function start(tabId, mode = 'pixel') {
  await pageReady(tabId);
  await api.scripting.executeScript({ target: { tabId }, func: pageTools, args: ['cancel'] });
  await api.scripting.executeScript({ target: { tabId }, func: pageAnalyzer, args: ['clear'] });
  await api.tabs.sendMessage(tabId, { type: 'UIA_HIDE' });
  const image = await capture(tabId),
    state = await readStore();
  return api.tabs.sendMessage(tabId, {
    type: 'UIA_START',
    image,
    mode,
    settings: state.settings,
  });
}
async function resample(tabId) {
  const state = await readStore(),
    last = state.lastSample;
  if (!last) throw new Error('Pick a page color first to save a sample location.');
  const tab = await pageReady(tabId);
  await api.scripting.executeScript({ target: { tabId }, func: pageTools, args: ['cancel'] });
  if (tab.url !== last.url)
    throw new Error('Return to the same page before resampling the last location.');
  await api.scripting.executeScript({ target: { tabId }, func: pageAnalyzer, args: ['clear'] });
  await api.tabs.sendMessage(tabId, { type: 'UIA_HIDE' });
  const image = await capture(tabId);
  return api.tabs.sendMessage(tabId, {
    type: 'UIA_RESAMPLE',
    image,
    last,
    settings: state.settings,
  });
}
async function handle(message, sender) {
  const tabId = sender.url?.startsWith(api.runtime.getURL('')) ? message.tabId : sender.tab?.id;
  switch (message.type) {
    case 'FRONTEND_TOOL': {
      await pageReady(tabId);
      await api.tabs.sendMessage(tabId, { type: 'UIA_HIDE' });
      return (
        await api.scripting.executeScript({
          target: { tabId },
          func: pageTools,
          args: [message.action, message.options || {}],
        })
      )[0].result;
    }
    case 'TOOL_RESULT':
      await writeStore({ toolResult: message.result });
      return {};
    case 'TOOL_COPY':
      await copy(String(message.text).slice(0, 100000));
      return {};
    case 'START_PICK':
      return start(tabId, message.mode);
    case 'CAPTURE':
      if (!sender.tab) throw new Error('A page sample is required.');
      return { image: await capture(tabId) };
    case 'PICKED':
      return record(message.color, 'page', { ...message.location, url: sender.tab.url, tabId });
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
        const settings = { ...state.settings, ...message.settings, autoCopy: true };
        await writeStore({ settings });
        await api.action.setPopup({ popup: settings.singleClick ? '' : 'popup.html' });
        return { settings };
      });
    case 'OPEN_WORKSPACE':
      await api.tabs.create({ url: api.runtime.getURL('popup.html') + `?tab=${tabId}` });
      return {};
    default:
      throw new Error('Unknown UIAssistant action.');
  }
}
api.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.target === 'offscreen') return;
  if (sender.id !== api.runtime.id) return;
  // Only our own extension pages can change settings, analyze or request copies.
  const fromExtension = sender.url?.startsWith(api.runtime.getURL(''));
  if (
    !fromExtension &&
    !['CAPTURE', 'PICKED', 'OPEN_WORKSPACE', 'TOOL_RESULT', 'TOOL_COPY'].includes(message.type)
  )
    return;
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
  const state = await readStore();
  await api.action.setPopup({ popup: state.settings.singleClick ? '' : 'popup.html' });
});
