import { initFrontendTools } from './lib/tools-ui.js';
import DOMPurify from './vendor/purify.es.mjs';
import { api } from './lib/browser.js';
import {
  parseColor,
  formatColor,
  hex,
  rgba,
  hsvToRgb,
  rgbToHsv,
  contrast,
  clamp,
} from './lib/color.js';
import {
  defaultGradient,
  gradientCSS,
  gradientCode,
  gradientStops,
  parseGradient,
  adjustGradient,
  imageGradient,
} from './lib/gradient.js';
import { palettes, gradientPresets } from './lib/palettes.js';
import { readStore, writeStore } from './lib/store.js';
import { en, fa } from './lib/i18n.js';
import { gradientSVG, rasterGradient } from './lib/gradient-export.js';

const $ = (selector) => document.querySelector(selector),
  $$ = (selector) => [...document.querySelectorAll(selector)];
const icon = (name) => `<svg><use href="#i-${name}"/></svg>`;
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const isExtension = !!api?.runtime?.id;
const fallbackText = new Map();
$$('[data-i18n]').forEach((el) => fallbackText.set(el.dataset.i18n, el.innerHTML));
let state = await readStore(),
  color = state.color,
  hsv = rgbToHsv(color),
  view = 'picker',
  gradient = state.gradient || defaultGradient(),
  analysis = null,
  activePalette = palettes[0].id,
  targetTab = null,
  toastTimer,
  gradientTimer;
const t = (key) =>
  (state.settings.language === 'fa' ? fa[key] : en[key]) ?? en[key] ?? fallbackText.get(key) ?? key;
function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => ($('#toast').hidden = true), 4000);
}
function safe(fn) {
  return async (...args) => {
    try {
      await fn(...args);
    } catch (e) {
      toast(e.message);
    }
  };
}
function on(selector, event, fn) {
  $(selector).addEventListener(event, safe(fn));
}
async function send(message) {
  if (!isExtension) {
    if (message.type === 'SET_COLOR') {
      const value = formatColor(message.color);
      state.history = [
        { color: value, at: Date.now(), source: message.source || 'picker' },
        ...state.history.filter((c) => c.color !== value),
      ].slice(0, 200);
      await writeStore({ color: message.color, history: state.history });
      if (state.settings.autoCopy)
        await navigator.clipboard.writeText(formatColor(message.color, state.settings.format));
      return { color: message.color };
    }
    if (message.type === 'SETTINGS') {
      state.settings = { ...state.settings, ...message.settings, autoCopy: true };
      await writeStore({ settings: state.settings });
      return { settings: state.settings };
    }
    if (message.type === 'COPY') {
      await navigator.clipboard.writeText(message.text);
      return {};
    }
    throw new Error(t('extensionRequired'));
  }
  const result = await api.runtime.sendMessage({ ...message, tabId: targetTab });
  if (!result?.ok) throw new Error(result?.error || 'UIAssistant could not complete the action.');
  return result;
}
function translate() {
  const lang = state.settings.language;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
  $$('[data-i18n]').forEach((el) => {
    if (el.dataset.i18n === 'tagline')
      el.replaceChildren(
        DOMPurify.sanitize(t('tagline'), {
          ADD_TAGS: ['use'],
          ADD_ATTR: ['href'],
          RETURN_DOM_FRAGMENT: true,
        }),
      );
    else el.textContent = t(el.dataset.i18n);
  });
  $$('[data-placeholder]').forEach((el) => (el.placeholder = t(el.dataset.placeholder)));
  $$('[data-title]').forEach((el) => {
    el.title = t(el.dataset.title);
    el.setAttribute('aria-label', el.title);
  });
  $('#language-btn').textContent = lang === 'fa' ? 'EN' : 'فا';
  setView(view);
  renderRecent();
  renderHistory();
  renderPalettes();
  renderGradient();
  if (analysis) renderAnalysis();
}
function setView(next) {
  view = next;
  $$('.view').forEach((el) => (el.hidden = el.id !== `view-${view}`));
  $$('.nav-item').forEach((el) => {
    const active = el.dataset.view === view;
    el.classList.toggle('active', active);
    el.setAttribute('aria-current', active ? 'page' : 'false');
  });
  $('#view-title').textContent = t(view);
  $('#view-title').insertAdjacentHTML('beforeend', '<span class="title-dot">.</span>');
  $('#main').scrollTop = 0;
}
$$('[data-view]').forEach((el) => el.addEventListener('click', () => setView(el.dataset.view)));
$$('[data-go]').forEach((el) => el.addEventListener('click', () => setView(el.dataset.go)));
function updateColorBase(next, { preserveHsv = false } = {}) {
  color = next;
  state.color = color;
  if (!preserveHsv) {
    const updated = rgbToHsv(color);
    hsv = { ...updated, h: updated.s === 0 ? hsv.h : updated.h };
  }
  $('#spectrum').style.backgroundColor = `hsl(${hsv.h}, 100%, 50%)`;
  $('#spectrum-cursor').style.left = hsv.s + '%';
  $('#spectrum-cursor').style.top = 100 - hsv.v + '%';
  $('#spectrum').setAttribute('aria-valuenow', Math.round(hsv.s));
  $('#spectrum').setAttribute(
    'aria-valuetext',
    `${Math.round(hsv.s)}% saturation, ${Math.round(hsv.v)}% brightness`,
  );
  $('#hue').value = hsv.h;
  $('#alpha').value = Math.round(color.a * 100);
  $('#alpha').style.background =
    `linear-gradient(to right, transparent, ${hex({ ...color, a: 1 })})`;
  $('#alpha-caption').textContent = Math.round(color.a * 100) + '%';
  $('#current-preview').style.background = formatColor(color, 'rgba');
  $('#current-preview').style.color =
    contrast(color, rgba(255, 255, 255)) > 2.5 ? '#fff' : '#26202e';
  $('#preview-label').textContent = hex(color);
  $('#hex').value = hex(color);
  ['r', 'g', 'b'].forEach((c) => ($('#' + c).value = color[c]));
  ['h', 's', 'v'].forEach((c) => ($('#' + c).value = Math.round(hsv[c])));
  $('#formatted-color').textContent = formatColor(color, state.settings.format);
  const composite = rgba(
    color.r * color.a + 255 * (1 - color.a),
    color.g * color.a + 255 * (1 - color.a),
    color.b * color.a + 255 * (1 - color.a),
  );
  const ratio = contrast(composite, rgba(255, 255, 255));
  $('#contrast').textContent = ratio.toFixed(2) + ':1';
  $('#contrast-badge').textContent = ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : '—';
}
async function commitColor(source = 'picker') {
  const result = await send({ type: 'SET_COLOR', color, source });
  state = await readStore();
  renderRecent();
  renderHistory();
  if (result.copyError) throw new Error(result.copyError);
}
async function choose(value, source = 'palette') {
  const c = resolveColor(value);
  if (!c) return;
  updateColor(c);
  await commitColor(source);
  setView('picker');
  toast(state.settings.autoCopy ? t('copied') : t('saved'));
}
function resolveColor(value) {
  if (/\b(?:var|env)\s*\(|^(?:currentcolor|inherit|initial|unset|revert)$/i.test(value.trim()))
    return null;
  const parsed = parseColor(value);
  if (parsed) return parsed;
  if (!CSS.supports('color', value)) return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = value;
  ctx.fillRect(0, 0, 1, 1);
  return rgba(
    ...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3),
    ctx.getImageData(0, 0, 1, 1).data[3] / 255,
  );
}
function updateHsv() {
  updateColor(hsvToRgb(hsv.h, hsv.s, hsv.v, color.a), { preserveHsv: true });
}
function updateColor(...args) {
  updateColorBase(...args);
  renderPlane();
}
function planeColor(x, y, mode = $('#plane-mode').value) {
  if (mode === 'h') return hsvToRgb(hsv.h, x * 100, (1 - y) * 100, color.a);
  if (mode === 's') return hsvToRgb(x * 360, hsv.s, (1 - y) * 100, color.a);
  if (mode === 'v') return hsvToRgb(x * 360, (1 - y) * 100, hsv.v, color.a);
  if (mode === 'r') return rgba(color.r, (1 - y) * 255, x * 255, color.a);
  if (mode === 'g') return rgba((1 - y) * 255, color.g, x * 255, color.a);
  return rgba(x * 255, (1 - y) * 255, color.b, color.a);
}
function renderPlane() {
  const mode = $('#plane-mode').value,
    canvas = $('#plane-canvas'),
    slider = $('#hue');
  canvas.hidden = mode === 'h';
  slider.classList.toggle('hue-range', mode === 'h');
  slider.max = mode === 'h' ? 360 : 'sv'.includes(mode) ? 100 : 255;
  slider.value = 'hsv'.includes(mode) ? hsv[mode] : color[mode];
  slider.setAttribute('aria-label', $('#plane-mode').selectedOptions[0].textContent);
  if (mode !== 'h') {
    const ctx = canvas.getContext('2d'),
      image = ctx.createImageData(128, 128);
    for (let y = 0; y < 128; y++)
      for (let x = 0; x < 128; x++) {
        const c = planeColor(x / 127, y / 127, mode),
          i = (y * 128 + x) * 4;
        image.data.set([c.r, c.g, c.b, 255], i);
      }
    ctx.putImageData(image, 0, 0);
    const ends = [0, Number(slider.max)].map((value) =>
      'hsv'.includes(mode)
        ? hsvToRgb(hsv.h, mode === 's' ? value : hsv.s, mode === 'v' ? value : hsv.v)
        : { ...color, [mode]: value },
    );
    slider.style.background = `linear-gradient(to right,${hex({ ...ends[0], a: 1 })},${hex({ ...ends[1], a: 1 })})`;
  }
  const x =
    mode === 'h'
      ? hsv.s / 100
      : 'sv'.includes(mode)
        ? hsv.h / 360
        : mode === 'b'
          ? color.r / 255
          : color.b / 255;
  const y =
    1 -
    ('hs'.includes(mode)
      ? hsv.v / 100
      : mode === 'v'
        ? hsv.s / 100
        : mode === 'g'
          ? color.r / 255
          : color.g / 255);
  $('#spectrum-cursor').style.left = x * 100 + '%';
  $('#spectrum-cursor').style.top = y * 100 + '%';
}
let draggingSpectrum = false;
function spectrumAt(event) {
  const rect = $('#spectrum').getBoundingClientRect(),
    x = clamp((event.clientX - rect.left) / rect.width),
    y = clamp((event.clientY - rect.top) / rect.height);
  if ($('#plane-mode').value === 'h') {
    hsv.s = x * 100;
    hsv.v = (1 - y) * 100;
    updateHsv();
  } else updateColor(planeColor(x, y));
}
on('#spectrum', 'pointerdown', (e) => {
  draggingSpectrum = true;
  $('#spectrum').setPointerCapture(e.pointerId);
  spectrumAt(e);
});
on('#spectrum', 'pointermove', (e) => {
  if (draggingSpectrum) spectrumAt(e);
});
on('#spectrum', 'pointerup', async () => {
  draggingSpectrum = false;
  await commitColor();
});
on('#spectrum', 'keydown', async (e) => {
  if (!e.key.startsWith('Arrow')) return;
  e.preventDefault();
  const step = (e.shiftKey ? 10 : 1) / 100,
    x = parseFloat($('#spectrum-cursor').style.left) / 100,
    y = parseFloat($('#spectrum-cursor').style.top) / 100;
  updateColor(
    planeColor(
      clamp(x + (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0)),
      clamp(y + (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0)),
    ),
  );
  await commitColor();
});
on('#plane-mode', 'change', renderPlane);
on('#hue', 'input', (e) => {
  const mode = $('#plane-mode').value;
  if ('hsv'.includes(mode)) {
    hsv[mode] = Number(e.target.value);
    updateHsv();
  } else updateColor({ ...color, [mode]: Math.round(Number(e.target.value)) });
});
on('#hue', 'change', () => commitColor());
on('#alpha', 'input', (e) =>
  updateColor({ ...color, a: Number(e.target.value) / 100 }, { preserveHsv: true }),
);
on('#alpha', 'change', () => commitColor());
on('#hex', 'change', async (e) => {
  const next = resolveColor(e.target.value);
  if (!next) {
    updateColor(color);
    throw new Error(t('colorInvalid'));
  }
  updateColor(next);
  await commitColor();
});
for (const c of ['r', 'g', 'b'])
  on('#' + c, 'change', async (e) => {
    updateColor(
      rgba(...['r', 'g', 'b'].map((k) => (k === c ? e.target.value : color[k])), color.a),
    );
    await commitColor();
  });
for (const c of ['h', 's', 'v'])
  on('#' + c, 'change', async (e) => {
    hsv[c] = clamp(e.target.value, 0, c === 'h' ? 360 : 100);
    updateHsv();
    await commitColor();
  });
async function copy(text) {
  await send({ type: 'COPY', text });
  toast(t('copied'));
}
on('#copy-hex', 'click', () => copy(hex(color)));
on('#copy-color', 'click', () => copy(formatColor(color, state.settings.format)));
on('#copy-format', 'change', async (e) => {
  await settings({ format: e.target.value });
  updateColor(color);
});
on('#sample-size', 'change', (e) => settings({ sampleSize: Number(e.target.value) }));
async function startPick(mode = 'pixel') {
  if (targetTab && document.body.classList.contains('workspace'))
    await api.tabs.update(targetTab, { active: true });
  await send({ type: 'START_PICK', mode });
  if (!document.body.classList.contains('workspace')) window.close();
  else toast(t('pickWorking'));
}
on('#pick-page', 'click', () => startPick());
on('#pick-area', 'click', () => startPick('area'));
on('#resample', 'click', async () => {
  if (targetTab && document.body.classList.contains('workspace'))
    await api.tabs.update(targetTab, { active: true });
  await send({ type: 'RESAMPLE' });
  state = await readStore();
  updateColor(state.color);
  renderRecent();
  toast(t('saved'));
});
on('#pick-screen', 'click', async () => {
  if (!window.EyeDropper) throw new Error(t('screenUnavailable'));
  try {
    const result = await new EyeDropper().open();
    updateColor(parseColor(result.sRGBHex));
    await commitColor('screen');
    toast(state.settings.autoCopy ? t('copied') : t('saved'));
  } catch (e) {
    if (e.name !== 'AbortError') throw e;
  }
});
function renderRecent() {
  const box = $('#recent-colors');
  box.replaceChildren();
  if (!state.history.length) {
    const p = document.createElement('p');
    p.className = 'empty-recent';
    p.append(t('emptyRecent') + ' ');
    const b = document.createElement('button');
    b.className = 'quiet';
    b.textContent = t('tryPalette');
    b.onclick = () => setView('palettes');
    p.append(b);
    box.append(p);
    return;
  }
  for (const item of state.history.slice(0, 12)) {
    const b = document.createElement('button');
    b.className = 'color-chip';
    b.style.background = item.color;
    b.title = item.color;
    b.setAttribute('aria-label', item.color);
    b.onclick = safe(() => choose(item.color, 'history'));
    box.append(b);
  }
}
async function settings(patch) {
  const result = await send({ type: 'SETTINGS', settings: patch });
  state.settings = result.settings;
  return result.settings;
}
on('#settings-btn', 'click', () => {
  $('#setting-autocopy').checked = true;
  $('#setting-autocopy').disabled = true;
  $('#setting-outline').checked = state.settings.outline;
  $('#setting-singleclick').checked = state.settings.singleClick;
  $('#setting-language').value = state.settings.language;
  $('#settings-dialog').showModal();
});
$$('.dialog-close').forEach((el) =>
  el.addEventListener('click', () => el.closest('dialog').close()),
);
$$('dialog').forEach((dialog) =>
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        dialog.close();
    }
  }),
);
for (const [id, key] of [
  ['outline', 'outline'],
  ['singleclick', 'singleClick'],
])
  on('#setting-' + id, 'change', (e) => settings({ [key]: e.target.checked }));
on('#setting-language', 'change', async (e) => {
  await settings({ language: e.target.value });
  translate();
});
on('#language-btn', 'click', async () => {
  await settings({ language: state.settings.language === 'fa' ? 'en' : 'fa' });
  translate();
});
on('#expand-btn', 'click', async () => {
  await send({ type: 'OPEN_WORKSPACE' });
  if (!document.body.classList.contains('workspace')) window.close();
});
function askName(title, initial = '') {
  return new Promise((resolve) => {
    const dialog = $('#name-dialog');
    $('#name-title').textContent = title;
    $('#name-input').value = initial;
    dialog.returnValue = '';
    dialog.addEventListener(
      'close',
      () => resolve(dialog.returnValue === 'save' ? $('#name-input').value.trim() : null),
      { once: true },
    );
    dialog.showModal();
    $('#name-input').focus();
  });
}
on('#name-form', 'submit', (e) => {
  e.preventDefault();
  if ($('#name-input').value.trim()) $('#name-dialog').close('save');
});
function download(filename, data, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
const slug = (name) => name.replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 70) || 'palette';
function allPalettes() {
  return [...palettes, ...state.customPalettes];
}
function renderPalettes() {
  const select = $('#palette-select');
  select.replaceChildren(
    DOMPurify.sanitize(
      `<optgroup label="${esc(t('builtin'))}">${palettes.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</optgroup><optgroup label="${esc(t('custom'))}">${state.customPalettes.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</optgroup>`,
      { ADD_TAGS: ['use'], ADD_ATTR: ['href'], RETURN_DOM_FRAGMENT: true },
    ),
  );
  const p = allPalettes().find((p) => p.id === activePalette) || palettes[0];
  activePalette = p.id;
  select.value = activePalette;
  $('#palette-name').textContent = p.name;
  $('#palette-count').textContent = p.colors.length + ' ' + t('colors');
  $('#delete-palette').disabled = palettes.some((b) => b.id === p.id);
  const grid = $('#palette-colors');
  grid.replaceChildren(
    DOMPurify.sanitize(
      p.colors.length
        ? p.colors
            .map(
              (c) =>
                `<button class="palette-swatch" title="${esc(c)}" data-color="${esc(c)}"><span class="paint" style="background:${esc(c)}"></span><code>${esc(c)}</code></button>`,
            )
            .join('')
        : `<div class="empty-state">${esc(t('emptyPalette'))}</div>`,
      { ADD_TAGS: ['use'], ADD_ATTR: ['href'], RETURN_DOM_FRAGMENT: true },
    ),
  );
  grid
    .querySelectorAll('[data-color]')
    .forEach((b) => (b.onclick = safe(() => choose(b.dataset.color))));
}
on('#palette-select', 'change', (e) => {
  activePalette = e.target.value;
  renderPalettes();
});
async function createPalette(name, colors = []) {
  const p = { id: crypto.randomUUID(), name, colors: [...new Set(colors)].slice(0, 512) };
  state.customPalettes.push(p);
  await writeStore({ customPalettes: state.customPalettes });
  activePalette = p.id;
  renderPalettes();
  return p;
}
on('#new-palette', 'click', async () => {
  const name = await askName(t('paletteName'));
  if (name) await createPalette(name, [hex(color)]);
});
on('#favorite', 'click', async () => {
  let p = state.customPalettes.find((p) => p.id === activePalette) || state.customPalettes[0];
  if (!p) {
    const name = await askName(t('paletteName'), 'My palette');
    if (!name) return;
    p = await createPalette(name);
  }
  if (!p.colors.includes(hex(color))) p.colors.push(hex(color));
  await writeStore({ customPalettes: state.customPalettes });
  activePalette = p.id;
  renderPalettes();
  toast(t('paletteSaved'));
});
on('#delete-palette', 'click', async () => {
  state.customPalettes = state.customPalettes.filter((p) => p.id !== activePalette);
  await writeStore({ customPalettes: state.customPalettes });
  activePalette = palettes[0].id;
  renderPalettes();
  toast(t('paletteRemoved'));
});
on('#export-palette', 'click', () => {
  const p = allPalettes().find((p) => p.id === activePalette);
  download(slug(p.name) + '.json', JSON.stringify({ name: p.name, colors: p.colors }, null, 2));
  download(
    slug(p.name) + '.css',
    `:root {\n${p.colors.map((c, i) => `  --color-${i + 1}: ${c};`).join('\n')}\n}`,
    'text/css',
  );
});
on('#import-palette', 'click', () => $('#palette-file').click());
on('#palette-file', 'change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 1024 * 1024) throw new Error(t('fileInvalid'));
    let p;
    if (file.name.endsWith('.gpl')) {
      const text = await file.text();
      if (!text.startsWith('GIMP Palette')) throw new Error(t('fileInvalid'));
      p = {
        name: text.match(/^Name:\s*(.*)$/m)?.[1] || file.name.replace('.gpl', ''),
        colors: text.split('\n').flatMap((line) => {
          const m = line.match(/^\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/);
          return m ? [hex(rgba(...m.slice(1).map(Number)))] : [];
        }),
      };
    } else p = JSON.parse(await file.text());
    if (
      !p ||
      typeof p.name !== 'string' ||
      !Array.isArray(p.colors) ||
      !p.colors.length ||
      p.colors.length > 512 ||
      p.colors.some((c) => typeof c !== 'string' || !parseColor(c))
    )
      throw new Error(t('fileInvalid'));
    await createPalette(
      p.name.slice(0, 60),
      p.colors.map((c) => hex(parseColor(c))),
    );
    toast(t('imported'));
  } finally {
    e.target.value = '';
  }
});
function renderHistory() {
  const query = $('#history-search').value.toLowerCase();
  const filtered = state.history.filter((item) => item.color.toLowerCase().includes(query));
  $('#history-list').replaceChildren(
    DOMPurify.sanitize(
      filtered.length
        ? filtered
            .map(
              (item, i) =>
                `<button class="history-item" data-index="${i}"><span class="paint" style="background:${esc(item.color)}"></span><span><code>${esc(item.color)}</code><small>${esc(new Date(item.at).toLocaleString(state.settings.language === 'fa' ? 'fa-IR' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }))} · ${esc(t('source' + (item.source || 'picker').replace(/^./, (c) => c.toUpperCase())))}</small></span></button>`,
            )
            .join('')
        : `<div class="empty-state">${esc(t(state.history.length ? 'noMatches' : 'emptyHistory'))}</div>`,
      { ADD_TAGS: ['use'], ADD_ATTR: ['href'], RETURN_DOM_FRAGMENT: true },
    ),
  );
  $$('#history-list button').forEach(
    (b) => (b.onclick = safe(() => choose(filtered[b.dataset.index].color, 'history'))),
  );
}
on('#history-search', 'input', renderHistory);
on('#clear-history', 'click', async () => {
  state.history = [];
  await writeStore({ history: [] });
  renderRecent();
  renderHistory();
  toast(t('historyCleared'));
});
on('#export-history', 'click', () =>
  download('uiassistant-history.json', JSON.stringify(state.history, null, 2)),
);
on('#analyze-page', 'click', async () => {
  const button = $('#analyze-page');
  button.disabled = true;
  const label = button.querySelector('span');
  label.textContent = t('analyzing');
  try {
    analysis = await send({ type: 'ANALYZE' });
    $('#analysis-results').hidden = false;
    $('.analyzer-hero').hidden = true;
    renderAnalysis();
  } finally {
    button.disabled = false;
    label.textContent = t('analyzePage');
  }
});
function renderAnalysis() {
  $('#analysis-title').textContent = analysis.title || new URL(analysis.url).hostname;
  $('#analysis-title').title = analysis.url;
  $('#analysis-summary').textContent =
    state.settings.language === 'fa'
      ? `${analysis.colors.length} رنگ از ${analysis.inspected.toLocaleString('fa-IR')} عنصر${analysis.truncated ? ' · سقف ۳۰٬۰۰۰ عنصر' : ''}`
      : `${analysis.colors.length} colors across ${analysis.inspected.toLocaleString()} elements${analysis.truncated ? ' · 30,000 element limit reached' : ''}`;
  const q = $('#analysis-search').value.toLowerCase();
  let list = analysis.colors.filter((c) =>
    (c.hex + ' ' + c.properties.join(' ')).toLowerCase().includes(q),
  );
  if ($('#analysis-sort').value === 'hex')
    list = [...list].sort((a, b) => a.hex.localeCompare(b.hex));
  $('#analysis-colors').replaceChildren(
    DOMPurify.sanitize(
      list.length
        ? list
            .map(
              (item, i) =>
                `<div class="analysis-row"><button class="analysis-swatch" data-pick="${i}" style="background:${item.hex}" aria-label="${item.hex}"></button><div><code>${item.hex}</code><small>${esc(item.properties.join(', '))}</small></div><span class="count">${item.count}×</span><button class="icon-btn" data-locate="${i}" title="${esc(t('locate'))}">${icon('page')}</button><button class="icon-btn" data-copy="${i}" aria-label="Copy ${item.hex}">${icon('copy')}</button></div>`,
            )
            .join('')
        : `<div class="empty-state">${esc(t('noMatches'))}</div>`,
      { ADD_TAGS: ['use'], ADD_ATTR: ['href'], RETURN_DOM_FRAGMENT: true },
    ),
  );
  $$('[data-pick]').forEach(
    (b) => (b.onclick = safe(() => choose(list[b.dataset.pick].hex, 'page'))),
  );
  $$('[data-locate]').forEach(
    (b) => (b.onclick = safe(() => send({ type: 'HIGHLIGHT', color: list[b.dataset.locate].hex }))),
  );
  $$('[data-copy]').forEach((b) => (b.onclick = safe(() => copy(list[b.dataset.copy].hex))));
}
on('#analysis-search', 'input', () => {
  if (analysis) renderAnalysis();
});
on('#analysis-sort', 'change', () => {
  if (analysis) renderAnalysis();
});
on('#save-analysis', 'click', async () => {
  if (!analysis) return;
  const name = await askName(t('paletteName'), analysis.title.slice(0, 60));
  if (name) {
    await createPalette(
      name,
      analysis.colors.map((c) => c.hex),
    );
    toast(t('paletteSaved'));
  }
});
on('#export-analysis', 'click', () =>
  download(
    'uiassistant-page-palette.json',
    JSON.stringify({ name: analysis.title, colors: analysis.colors.map((c) => c.hex) }, null, 2),
  ),
);
function persistGradient() {
  clearTimeout(gradientTimer);
  gradientTimer = setTimeout(() => writeStore({ gradient }), 250);
}
function codeOptions() {
  return {
    format: $('#gradient-format').value,
    compatibility: $('#gradient-compat').checked,
    scss: $('#gradient-scss').checked,
  };
}
function renderGradient(full = true) {
  shapeLabel.hidden = gradient.type !== 'radial';
  $('#gradient-shape').value = gradient.shape || 'ellipse';
  const css = gradientCSS(gradient, $('#gradient-format').value);
  $('#gradient-paint').style.background = css;
  $('#gradient-code').textContent = gradientCode(gradient, codeOptions());
  $('#color-rail').style.background = css;
  $('#gradient-type').value = gradient.type;
  $('#gradient-angle').value = gradient.angle;
  $('#gradient-angle').disabled = gradient.type === 'radial';
  $('#gradient-repeat').checked = gradient.repeating;
  if (full) {
    $('#color-rail').replaceChildren(
      DOMPurify.sanitize(
        gradient.stops
          .map(
            (stop, i) =>
              `<button class="stop-handle" data-stop="${i}" style="left:${stop.position}%;background:${esc(stop.color)}" aria-label="${esc(t('color'))} ${i + 1}: ${stop.position}%" title="${stop.position}%" role="slider" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${stop.position}" tabindex="0"></button>`,
          )
          .join(''),
        { ADD_TAGS: ['use'], ADD_ATTR: ['href'], RETURN_DOM_FRAGMENT: true },
      ),
    );
    $('#gradient-stops').replaceChildren(
      DOMPurify.sanitize(
        gradient.stops
          .map(
            (stop, i) =>
              `<div class="stop-row"><input type="color" value="${hex(parseColor(stop.color), false)}" data-color-stop="${i}" aria-label="Color ${i + 1}"><input type="text" value="${esc(stop.color)}" data-text-stop="${i}" aria-label="Color value ${i + 1}"><label>${esc(t('opacity'))}<input type="number" min="0" max="100" value="${Math.round(parseColor(stop.color).a * 100)}" data-alpha-stop="${i}">%</label><label class="position-label">${esc(t('position'))}<input type="number" min="0" max="100" step="0.1" value="${stop.position}" data-position-stop="${i}">%</label><button class="icon-btn" data-delete-stop="${i}" aria-label="${esc(t('delete'))}" ${gradient.stops.length <= 2 ? 'disabled' : ''}>${icon('close')}</button></div>`,
          )
          .join(''),
        { ADD_TAGS: ['use'], ADD_ATTR: ['href'], RETURN_DOM_FRAGMENT: true },
      ),
    );
    $('#opacity-stops').replaceChildren(
      DOMPurify.sanitize(
        gradient.opacity
          .map(
            (stop, i) =>
              `<div class="stop-row"><input type="range" min="0" max="100" value="${Math.round(stop.alpha * 100)}" data-opacity-range="${i}" aria-label="Opacity ${i + 1}"><label>${esc(t('opacity'))}<input type="number" min="0" max="100" value="${Math.round(stop.alpha * 100)}" data-opacity-value="${i}">%</label><label class="position-label">${esc(t('position'))}<input type="number" min="0" max="100" value="${stop.position}" data-opacity-position="${i}">%</label><button class="icon-btn" data-delete-opacity="${i}" aria-label="${esc(t('delete'))}" ${gradient.opacity.length <= 2 ? 'disabled' : ''}>${icon('close')}</button></div>`,
          )
          .join(''),
        { ADD_TAGS: ['use'], ADD_ATTR: ['href'], RETURN_DOM_FRAGMENT: true },
      ),
    );
    $$('[data-color-stop]').forEach((el) => {
      el.oninput = () => {
        const old = parseColor(gradient.stops[el.dataset.colorStop].color);
        gradient.stops[el.dataset.colorStop].color = hex({ ...parseColor(el.value), a: old.a });
        renderGradient(false);
      };
      el.onchange = () => renderGradient();
    });
    const binds = [
      [
        'textStop',
        (value) => {
          const c = resolveColor(value);
          if (!c) throw new Error(t('colorInvalid'));
          return hex(c);
        },
        'color',
        'stops',
      ],
      ['positionStop', (v) => clamp(v, 0, 100), 'position', 'stops'],
      [
        'alphaStop',
        (v, i) => hex({ ...parseColor(gradient.stops[i].color), a: clamp(v / 100) }),
        'color',
        'stops',
      ],
      ['opacityValue', (v) => clamp(v / 100), 'alpha', 'opacity'],
      ['opacityPosition', (v) => clamp(v, 0, 100), 'position', 'opacity'],
    ];
    for (const [data, convert, key, list] of binds)
      $$('[data-' + data.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()) + ']').forEach(
        (el) =>
          (el.onchange = safe(() => {
            const i = Number(el.dataset[data]);
            try {
              gradient[list][i][key] = convert(el.value, i);
            } finally {
              renderGradient();
            }
          })),
      );
    $$('[data-delete-stop]').forEach(
      (el) =>
        (el.onclick = () => {
          gradient.stops.splice(Number(el.dataset.deleteStop), 1);
          renderGradient();
        }),
    );
    $$('[data-delete-opacity]').forEach(
      (el) =>
        (el.onclick = () => {
          gradient.opacity.splice(Number(el.dataset.deleteOpacity), 1);
          renderGradient();
        }),
    );
    $$('[data-opacity-range]').forEach((el) => {
      el.oninput = () => {
        gradient.opacity[el.dataset.opacityRange].alpha = Number(el.value) / 100;
        renderGradient(false);
      };
      el.onchange = () => renderGradient();
    });
    $$('[data-stop]').forEach((handle) => {
      const i = Number(handle.dataset.stop);
      handle.onpointerdown = (e) => {
        e.preventDefault();
        const rect = $('#color-rail').getBoundingClientRect();
        const move = (event) => {
          gradient.stops[i].position =
            Math.round(clamp((event.clientX - rect.left) / rect.width) * 1000) / 10;
          handle.style.left = gradient.stops[i].position + '%';
          handle.setAttribute('aria-valuenow', gradient.stops[i].position);
          renderGradient(false);
        };
        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          renderGradient();
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up, { once: true });
      };
      handle.onkeydown = (e) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
        e.preventDefault();
        gradient.stops[i].position =
          e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? 100
              : clamp(
                  gradient.stops[i].position +
                    (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 10 : 1),
                  0,
                  100,
                );
        renderGradient();
        $(`[data-stop="${i}"]`).focus();
      };
    });
    renderPresets();
  }
  persistGradient();
}
on('#gradient-type', 'change', (e) => {
  gradient.type = e.target.value;
  renderGradient();
});
on('#gradient-angle', 'input', (e) => {
  gradient.angle = clamp(e.target.value, -360, 360);
  renderGradient(false);
});
on('#gradient-repeat', 'change', (e) => {
  gradient.repeating = e.target.checked;
  renderGradient();
});
on('#gradient-reverse', 'click', () => {
  gradient.stops = gradient.stops.map((s) => ({ ...s, position: 100 - s.position })).reverse();
  gradient.opacity = gradient.opacity.map((s) => ({ ...s, position: 100 - s.position })).reverse();
  renderGradient();
});
on('#add-stop', 'click', () => {
  if (gradient.stops.length >= 64) throw new Error(t('maxStops'));
  gradient.stops.push({ color: hex(color), position: 50 });
  renderGradient();
});
on('#add-opacity', 'click', () => {
  if (gradient.opacity.length >= 64) throw new Error(t('maxStops'));
  gradient.opacity.push({ alpha: 0.5, position: 50 });
  renderGradient();
});
for (const id of ['gradient-compat', 'gradient-scss', 'gradient-format'])
  on('#' + id, 'change', () => renderGradient(false));
on('#copy-gradient', 'click', () => copy(gradientCode(gradient, codeOptions())));
function renderPresets() {
  const builtin = gradientPresets.map((p) => ({
    name: p.name,
    gradient: {
      type: 'linear',
      angle: p.angle,
      repeating: false,
      stops: p.colors.map((color, i) => ({ color, position: (i / (p.colors.length - 1)) * 100 })),
      opacity: [
        { alpha: 1, position: 0 },
        { alpha: 1, position: 100 },
      ],
    },
  }));
  const list = [...builtin, ...state.savedGradients];
  $('#gradient-presets').replaceChildren(
    DOMPurify.sanitize(
      list
        .map(
          (p, i) =>
            `<div class="preset-wrapper"><button class="preset-card" data-preset="${i}"><span class="preset-paint" style="background:${esc(gradientCSS(p.gradient))}"></span><span>${esc(p.name)}</span></button>${i >= builtin.length ? `<button class="icon-btn preset-delete" data-delete-preset="${i - builtin.length}" aria-label="Delete preset">${icon('close')}</button>` : ''}</div>`,
        )
        .join(''),
      { ADD_TAGS: ['use'], ADD_ATTR: ['href'], RETURN_DOM_FRAGMENT: true },
    ),
  );
  $$('[data-preset]').forEach(
    (el) =>
      (el.onclick = () => {
        gradient = structuredClone(list[el.dataset.preset].gradient);
        renderGradient();
      }),
  );
  $$('[data-delete-preset]').forEach(
    (el) =>
      (el.onclick = safe(async () => {
        state.savedGradients.splice(el.dataset.deletePreset, 1);
        await writeStore({ savedGradients: state.savedGradients });
        renderPresets();
      })),
  );
}
on('#save-gradient', 'click', async () => {
  const name = await askName(t('presetName'));
  if (name) {
    state.savedGradients.push({ name, gradient: structuredClone(gradient) });
    await writeStore({ savedGradients: state.savedGradients });
    renderPresets();
    toast(t('saved'));
  }
});
on('#import-gradient', 'click', () => $('#import-dialog').showModal());
on('#apply-import', 'click', () => {
  gradient = parseGradient($('#import-css').value, resolveColor);
  renderGradient();
  $('#import-dialog').close();
  toast(t('imported'));
});
on('#gradient-file', 'change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 16 * 1024 * 1024) throw new Error('Use an image smaller than 16 MB.');
    const img = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 2048 / Math.max(img.width, img.height));
    canvas.width = Math.max(2, Math.round(img.width * scale));
    canvas.height = Math.max(2, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    img.close();
    gradient = imageGradient(
      ctx.getImageData(0, 0, canvas.width, canvas.height).data,
      canvas.width,
      canvas.height,
      $('#import-vertical').checked,
    );
    renderGradient();
    $('#import-dialog').close();
    toast(t('imported'));
  } finally {
    e.target.value = '';
  }
});
function adjusted() {
  return adjustGradient(
    gradient,
    Number($('#adjust-h').value),
    Number($('#adjust-s').value),
    Number($('#adjust-l').value),
  );
}
on('#gradient-adjust', 'click', () => {
  ['h', 's', 'l'].forEach((c) => {
    $('#adjust-' + c).value = 0;
    $('#adjust-' + c + '-value').value = 0;
  });
  $('#adjust-preview').style.background = gradientCSS(gradient);
  $('#adjust-dialog').showModal();
});
for (const c of ['h', 's', 'l'])
  on('#adjust-' + c, 'input', (e) => {
    $('#adjust-' + c + '-value').value = e.target.value;
    $('#adjust-preview').style.background = gradientCSS(adjusted());
  });
on('#apply-adjust', 'click', () => {
  gradient = adjusted();
  renderGradient();
  $('#adjust-dialog').close();
});
function exportSize() {
  return [
    clamp($('#preview-width').value, 16, 4096),
    clamp($('#preview-height').value, 16, 4096),
  ].map(Math.round);
}
const shapeLabel = document.createElement('label');
shapeLabel.replaceChildren(
  DOMPurify.sanitize(
    '<span data-i18n="shape">Shape</span><select id="gradient-shape" aria-label="Radial gradient shape"><option value="ellipse" data-i18n="ellipse">Ellipse</option><option value="circle" data-i18n="circle">Circle</option></select>',
    { ADD_TAGS: ['use'], ADD_ATTR: ['href'], RETURN_DOM_FRAGMENT: true },
  ),
);
$('#gradient-type').parentElement.after(shapeLabel);
on('#gradient-shape', 'change', (e) => {
  gradient.shape = e.target.value;
  renderGradient();
});
const rescan = document.createElement('button');
rescan.className = 'icon-btn';
rescan.replaceChildren(
  DOMPurify.sanitize(icon('refresh'), {
    ADD_TAGS: ['use'],
    ADD_ATTR: ['href'],
    RETURN_DOM_FRAGMENT: true,
  }),
);
rescan.dataset.title = 'analyzePage';
rescan.onclick = () => $('#analyze-page').click();
$('.analysis-meta').append(rescan);
const legacyExport = document.createElement('button');
legacyExport.className = 'quiet';
legacyExport.textContent = 'IE9 SVG';
legacyExport.title = 'Copy an SVG data URI fallback for IE9';
legacyExport.onclick = safe(() =>
  copy(
    `background-image: url("data:image/svg+xml,${encodeURIComponent(svgGradient())}");\nbackground-size: 100% 100%;`,
  ),
);
$('.export-row').append(legacyExport);
const shareGradient = document.createElement('button');
shareGradient.className = 'text-btn';
shareGradient.dataset.i18n = 'share';
shareGradient.textContent = 'Link';
shareGradient.title = 'Copy a gradient permalink for this installation';
shareGradient.onclick = safe(() => {
  const url = new URL(location.href);
  url.search = '?workspace=1';
  url.hash = 'gradient=' + encodeURIComponent(gradientCSS(gradient));
  return copy(url.href);
});
$('#import-gradient').before(shareGradient);
function svgGradient() {
  return gradientSVG(gradient, ...exportSize());
}
on('#export-svg', 'click', () =>
  download('uiassistant-gradient.svg', svgGradient(), 'image/svg+xml'),
);
on('#export-png', 'click', async () => {
  const [w, h] = exportSize(),
    canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').putImageData(new ImageData(rasterGradient(gradient, w, h), w, h), 0, 0);
  const blob = await new Promise((r) => canvas.toBlob(r));
  download('uiassistant-gradient.png', blob, 'image/png');
});

if (isExtension) {
  const source = Number(new URL(location.href).searchParams.get('tab'));
  if (source) targetTab = source;
  else targetTab = (await api.tabs.query({ active: true, currentWindow: true }))[0]?.id;
  await api.action.setBadgeText({ text: '' });
  if (state.lastError) {
    toast(state.lastError);
    await writeStore({ lastError: null });
  }
  api.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local') return;
    state = await readStore();
    if (changes.color) updateColor(state.color);
    if (changes.history) {
      renderRecent();
      renderHistory();
    }
  });
}
if (
  new URL(location.href).searchParams.has('tab') ||
  new URL(location.href).searchParams.has('workspace') ||
  !isExtension
)
  document.body.classList.add('workspace');
if (location.hash.startsWith('#gradient=')) {
  try {
    gradient = parseGradient(decodeURIComponent(location.hash.slice(10)), resolveColor);
    setView('gradients');
  } catch (e) {
    toast(e.message);
  }
}
$('#copy-format').value = state.settings.format;
$('#sample-size').value = state.settings.sampleSize;
translate();
updateColor(color);
if (!window.EyeDropper) {
  $('#pick-screen').disabled = true;
  $('#pick-screen').title = t('screenUnavailable');
}
initFrontendTools({
  send,
  toast,
  download,
  getLanguage: () => state.settings.language,
  activate: async () => {
    if (targetTab) await api.tabs.update(targetTab, { active: true });
  },
});
document.documentElement.dataset.ready = 'true';
