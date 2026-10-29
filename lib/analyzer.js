// This function is self-contained because Chrome serializes it into the page.
export async function pageAnalyzer(action = 'analyze', color = null) {
  const key = '__uiassistant_analysis_v1';
  if (action === 'clear' || action === 'highlight') {
    const state = window[key];
    if (!state) return { count: 0 };
    state.overlay?.remove();
    state.overlay = null;
    if (action === 'clear') return { count: 0 };
    const nodes = [...(state.colors.get(color)?.nodes || [])].filter((n) => n.isConnected);
    if (nodes[0])
      nodes[0].scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' });
    const host = document.createElement('div');
    host.style.cssText =
      'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483646;';
    const shadow = host.attachShadow({ mode: 'closed' });
    for (const node of nodes.slice(0, 100)) {
      const r = node.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const box = document.createElement('div');
      box.style.cssText = `position:fixed;left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px;box-sizing:border-box;border:2px solid #8b5cf6;background:#8b5cf618;`;
      shadow.append(box);
    }
    document.documentElement.append(host);
    state.overlay = host;
    clearTimeout(state.timer);
    state.timer = setTimeout(() => host.remove(), 2500);
    return { count: nodes.length };
  }
  window[key]?.overlay?.remove();
  const colors = new Map(),
    cache = new Map();
  let inspected = 0,
    truncated = false;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  function normalize(value) {
    if (cache.has(value)) return cache.get(value);
    if (!CSS.supports('color', value)) {
      cache.set(value, null);
      return null;
    }
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    const hex =
      a === 0
        ? null
        : '#' +
          [r, g, b, ...(a < 255 ? [a] : [])]
            .map((v) => v.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase();
    cache.set(value, hex);
    return hex;
  }
  const props = [
    'color',
    'background-color',
    'border-top-color',
    'border-right-color',
    'border-bottom-color',
    'border-left-color',
    'outline-color',
    'text-decoration-color',
    'fill',
    'stroke',
  ];
  function collect(el, style, pseudo = false) {
    const values = new Map();
    for (const prop of props) {
      if (
        prop.startsWith('border') &&
        (style.getPropertyValue(prop.replace('color', 'style')) === 'none' ||
          parseFloat(style.getPropertyValue(prop.replace('color', 'width'))) === 0)
      )
        continue;
      if (prop === 'outline-color' && style.outlineStyle === 'none') continue;
      if (prop === 'text-decoration-color' && style.textDecorationLine === 'none') continue;
      if (
        (prop === 'fill' || prop === 'stroke') &&
        el.namespaceURI !== 'http://www.w3.org/2000/svg'
      )
        continue;
      const c = normalize(style.getPropertyValue(prop));
      if (c) values.set(c, prop);
    }
    const extra = [style.backgroundImage, style.boxShadow, style.textShadow].join(' ');
    for (const m of extra.matchAll(
      /(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([^)]*\)|#[\da-f]{3,8}\b/gi,
    )) {
      const c = normalize(m[0]);
      if (c) values.set(c, 'effects');
    }
    for (const [hex, prop] of values) {
      if (!colors.has(hex)) colors.set(hex, { nodes: new Set(), properties: new Set() });
      const item = colors.get(hex);
      item.nodes.add(el);
      item.properties.add(pseudo ? `pseudo ${prop}` : prop);
    }
  }
  const roots = [document];
  while (roots.length && !truncated) {
    const root = roots.shift();
    for (const el of root.querySelectorAll('*')) {
      if (++inspected > 30000) {
        truncated = true;
        break;
      }
      if (el.shadowRoot) roots.push(el.shadowRoot);
      if (el.tagName === 'IFRAME') {
        try {
          if (el.contentDocument) roots.push(el.contentDocument);
        } catch {}
      }
      if (['SCRIPT', 'STYLE', 'LINK', 'META', 'HEAD', 'NOSCRIPT'].includes(el.tagName)) continue;
      const style = el.ownerDocument.defaultView.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || !el.getClientRects().length)
        continue;
      collect(el, style);
      for (const pseudo of ['::before', '::after']) {
        const s = el.ownerDocument.defaultView.getComputedStyle(el, pseudo);
        if (s.content !== 'none' && s.content !== 'normal') collect(el, s, true);
      }
      if (inspected % 800 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  window[key] = { colors };
  return {
    colors: [...colors]
      .map(([hex, c]) => ({ hex, count: c.nodes.size, properties: [...c.properties] }))
      .sort((a, b) => b.count - a.count),
    inspected,
    truncated,
    title: document.title,
    url: location.href,
  };
}
