// Local, decorative SVG icons. No network assets or icon fonts.
const paths = {
  tools: 'M14 6a4 4 0 0 0-5 5L3 17a2.8 2.8 0 0 0 4 4l6-6a4 4 0 0 0 5-5l-3 3-4-4 3-3Z',
  code: 'm8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18',
  copy: 'M8 8h12v12H8ZM16 8V4H4v12h4',
  palette:
    'M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-4h3a4 4 0 0 0 4-4A10 10 0 0 0 12 3ZM7 10h.01M10 6h.01M16 8h.01',
  import: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  export: 'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5',
  reverse: 'M3 7h17l-4-4m5 14H4l4 4',
  sliders: 'M4 7h6m4 0h6M4 17h10m4 0h2M10 4v6m4 4v6',
  language: 'M3 5h12M9 3v2m3 0c0 7-4 11-8 13m1-10c1 4 4 7 8 8m1 5 4-11 4 11m-6-4h4',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  area: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M7 12h10m-5-5v10',
  link: 'm10 13 4-4M8 16l-2 2a3 3 0 0 1-4-4l5-5a3 3 0 0 1 4 0m2 6a3 3 0 0 0 4 0l5-5a3 3 0 0 0-4-4l-2 2',
  refresh: 'M20 7a9 9 0 1 0 1 8m-1-13v6h-6',
  inspect: 'M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5M9 9h6v6H9Z',
  typography: 'M3 5h18M12 5v16M8 21h8M3 5v4m18-4v4',
  measure: 'm3 16 13-13 5 5L8 21Zm9-9 3 3m-7 1 3 3m-7 1 3 3',
  layout: 'M3 3h18v18H3ZM3 9h18M9 9v12',
  accessibility: 'M12 3v.01M3 8l9 2 9-2m-9 2v6m0-1-5 6m5-6 5 6',
  semantics: 'M5 3h14v18H5ZM8 7h8m-8 5h8m-8 5h4',
  tokens: 'm12 2 10 6-10 6L2 8Zm-10 10 10 6 10-6M2 16l10 6 10-6',
  rtl: 'M20 5H9a4 4 0 0 0 0 8h3m0-8v16m5-16v16M3 17h5m-3-3-3 3 3 3',
  ltr: 'M4 5h11a4 4 0 0 1 0 8h-3m0-8v16M7 5v16m9-4h5m-3-3 3 3-3 3',
  close: 'm6 6 12 12M6 18 18 6',
  gradient: 'M3 4h18v16H3ZM7 4v16m5-16v16m5-16v16',
  check: 'm5 12 4 4L19 6',
  reset: 'M3 11a9 9 0 1 1 3 7M3 4v7h7',
  locate: 'M12 2v4m0 12v4M2 12h4m12 0h4M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z',
};

export function createIcon(name, doc = document) {
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('button-icon');
  const path = doc.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', paths[name] || paths.code);
  svg.append(path);
  return svg;
}

function iconFor(button) {
  if (button.dataset.icon) return button.dataset.icon;
  if (button.dataset.tool) return button.dataset.tool;
  if (button.matches('.palette-swatch,.color-chip,.history-item,.analysis-swatch')) return 'copy';
  if (button.matches('.preset-card,.stop-handle')) return 'gradient';
  const id = button.id;
  if (/import/.test(id)) return 'import';
  if (/export/.test(id)) return 'export';
  if (/copy/.test(id)) return 'copy';
  if (/clear|delete/.test(id)) return 'trash';
  if (/reverse/.test(id)) return 'reverse';
  if (/adjust/.test(id)) return 'sliders';
  if (/apply|save/.test(id) || (button.hasAttribute('type') && button.type === 'submit'))
    return 'check';
  if (/language/.test(id)) return 'language';
  if (/area/.test(id)) return 'area';
  if (/restore/.test(id)) return 'reset';
  if (/palette/.test(id)) return 'palette';
  if (button.dataset.i18n === 'share') return 'link';
  return 'code';
}

export function initButtonIcons(root = document.body) {
  function enhance(button) {
    button.querySelectorAll('svg').forEach((svg) => {
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
    });
    if (!button.querySelector('svg')) button.prepend(createIcon(iconFor(button)));
  }
  root.querySelectorAll('button').forEach(enhance);
  // Rendering and language changes replace button contents; cover those too.
  const observer = new MutationObserver((records) => {
    const pending = new Set();
    for (const record of records) {
      const parent = record.target.nodeType === 1 ? record.target : record.target.parentElement;
      const owner = parent?.closest('button');
      if (owner) pending.add(owner);
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches('button')) pending.add(node);
        node.querySelectorAll('button').forEach((b) => pending.add(b));
      }
    }
    for (const button of pending) if (button.isConnected) enhance(button);
  });
  observer.observe(root, { childList: true, subtree: true });
  return observer;
}
