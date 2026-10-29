// Firefox's native namespace returns promises; Chromium exposes the same APIs on chrome.
export const api = globalThis.browser ?? globalThis.chrome;
