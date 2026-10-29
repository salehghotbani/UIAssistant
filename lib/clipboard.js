export async function copyText(text, api, environment = globalThis) {
  // Firefox runs a DOM event page, which can write directly with clipboardWrite.
  if (!api.offscreen && environment.navigator?.clipboard?.writeText) {
    await environment.navigator.clipboard.writeText(text);
    return;
  }
  // Chromium's service worker has no DOM or navigator.clipboard.
  await ensureOffscreen(api);
  const result = await api.runtime.sendMessage({ target: 'offscreen', text });
  if (!result?.ok) throw new Error('Clipboard is unavailable. Open UIAssistant to copy the color.');
}

let creating;
async function ensureOffscreen(api) {
  if (!api.offscreen) throw new Error('This browser cannot access the extension clipboard.');
  if ((await api.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })).length) return;
  if (!creating) {
    creating = api.offscreen
      .createDocument({
        url: 'offscreen.html',
        reasons: ['CLIPBOARD'],
        justification: 'Copy the color selected by the user after the popup closes.',
      })
      .finally(() => {
        creating = null;
      });
  }
  await creating;
}
