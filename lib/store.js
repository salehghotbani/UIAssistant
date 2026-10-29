import { api } from './browser.js';
export const defaults = {
  color: { r: 108, g: 92, b: 231, a: 1 },
  history: [],
  customPalettes: [],
  savedGradients: [],
  settings: {
    format: 'hex',
    autoCopy: true,
    sampleSize: 1,
    outline: true,
    language: 'en',
    singleClick: false,
  },
  lastSample: null,
};
export async function readStore() {
  let data;
  if (api?.storage?.local) data = await api.storage.local.get(null);
  else {
    try {
      data = JSON.parse(localStorage.getItem('uiassistant') || '{}');
    } catch {
      data = {};
    }
  }
  return {
    ...structuredClone(defaults),
    ...data,
    settings: { ...defaults.settings, ...data.settings, autoCopy: true },
  };
}
export async function writeStore(data) {
  if (api?.storage?.local) await api.storage.local.set(data);
  else localStorage.setItem('uiassistant', JSON.stringify({ ...(await readStore()), ...data }));
}
