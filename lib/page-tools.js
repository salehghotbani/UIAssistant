// Self-contained: scripting.executeScript serializes this function into the target page.
export async function pageTools(action, options = {}) {
  const key = '__uia_frontend_v1';
  const state = (window[key] ||= { nodes: new Map(), serial: 0 });
  const api = globalThis.browser ?? globalThis.chrome;
  const send = (message) => api.runtime.sendMessage(message);
  const fa = options.language === 'fa';
  const text = (en, persian) => (fa ? persian : en);
  function element(tag, label, parent) {
    const node = document.createElement(tag);
    if (label !== undefined) node.textContent = label;
    if (tag === 'button') {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('aria-hidden', 'true');
      svg.style.cssText =
        'width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;flex-shrink:0;';
      const path = document.createElementNS(svg.namespaceURI, 'path');
      path.setAttribute(
        'd',
        /CSS/.test(label || '') ? 'M8 8h12v12H8ZM16 8V4H4v12h4' : 'm6 6 12 12M6 18 18 6',
      );
      svg.append(path);
      node.prepend(svg);
    }
    parent?.append(node);
    return node;
  }
  function stopSelection() {
    if (state.escape) window.removeEventListener('keydown', state.escape, true);
    state.escape = null;
    state.abort?.abort();
    state.abort = null;
    state.selectionHost?.remove();
    state.selectionHost = null;
  }
  function removeReference() {
    if (state.reference) {
      state.reference.host.dispatchEvent(new Event('uia-cleanup'));
      state.reference.host.remove();
      state.reference = null;
    }
  }
  function layer() {
    const host = element('div');
    host.dataset.uiassistantTool = '';
    host.style.cssText =
      'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
    document.documentElement.append(host);
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = element('style', undefined, shadow);
    style.textContent =
      '*{box-sizing:border-box}button{display:inline-flex;align-items:center;justify-content:center;gap:7px;margin-block:4px;margin-inline-end:8px;cursor:pointer;background:#a78bfa;color:#201a2c;border:0;padding:8px 12px;border-radius:7px;font:inherit}button:focus-visible{outline:2px solid white;outline-offset:3px}p{margin:8px 0}pre{white-space:pre-wrap;max-height:240px;overflow:auto;font:11px/1.6 monospace}';
    return { host, shadow };
  }
  function panel(shadow) {
    const p = element('div', undefined, shadow);
    p.style.cssText =
      'pointer-events:auto;position:fixed;right:18px;bottom:18px;width:350px;max-height:80vh;overflow:auto;background:#25212e;color:#faf7ff;padding:18px;border:1px solid #88749f;border-radius:14px;box-shadow:0 10px 50px #0004;font:13px/1.7 system-ui;';
    return p;
  }
  function box(shadow, rect, color = '#9c79ee') {
    const b = element('div', undefined, shadow);
    b.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;border:2px solid ${color};background:${color}18;pointer-events:none;`;
    return b;
  }
  function id(el) {
    for (const [key, node] of state.nodes) if (node === el) return key;
    const key = String(++state.serial);
    state.nodes.set(key, el);
    return key;
  }
  function label(el) {
    return (
      el.tagName.toLowerCase() +
      (el.id ? '#' + el.id : '') +
      [...el.classList]
        .slice(0, 2)
        .map((c) => '.' + c)
        .join('')
    );
  }
  const properties = [
    'width',
    'height',
    'display',
    'position',
    'box-sizing',
    'color',
    'background-color',
    'padding-top',
    'padding-right',
    'padding-bottom',
    'padding-left',
    'margin-top',
    'margin-right',
    'margin-bottom',
    'margin-left',
    'border-top',
    'border-right',
    'border-bottom',
    'border-left',
    'border-radius',
    'box-shadow',
    'font-family',
    'font-size',
    'font-weight',
    'font-style',
    'line-height',
    'letter-spacing',
    'text-align',
  ];
  function inspect(el) {
    const css = getComputedStyle(el),
      r = el.getBoundingClientRect(),
      values = Object.fromEntries(properties.map((p) => [p, css.getPropertyValue(p)]));
    return {
      id: id(el),
      label: label(el),
      rect: { x: r.x, y: r.y, width: r.width, height: r.height },
      values,
      css: properties.map((p) => `  ${p}: ${values[p]};`).join('\n'),
      typography: [
        'font-family',
        'font-size',
        'font-weight',
        'font-style',
        'line-height',
        'letter-spacing',
        'text-align',
      ]
        .map((p) => `${p}: ${values[p]};`)
        .join('\n'),
    };
  }
  if (action === 'cancel') {
    stopSelection();
    state.highlight?.remove();
    return {};
  }
  if (action === 'capture-cleanup') {
    stopSelection();
    removeReference();
    state.highlight?.remove();
    return {};
  }
  if (action === 'restore') {
    stopSelection();
    removeReference();
    state.highlight?.remove();
    if (state.direction) {
      const d = state.direction;
      for (const [p, v, priority] of d.styles) {
        if (v) document.documentElement.style.setProperty(p, v, priority);
        else document.documentElement.style.removeProperty(p);
      }
      if (d.attr === null) document.documentElement.removeAttribute('dir');
      else document.documentElement.setAttribute('dir', d.attr);
      state.direction = null;
    }
    return { restored: true };
  }
  if (action === 'highlight') {
    state.highlight?.remove();
    const node = state.nodes.get(options.id);
    if (!node?.isConnected) throw Error('This element is no longer on the page. Scan again.');
    node.scrollIntoView({ block: 'center', behavior: 'instant' });
    const l = layer();
    box(l.shadow, node.getBoundingClientRect());
    state.highlight = l.host;
    setTimeout(() => l.host.remove(), 2500);
    return {};
  }
  if (action === 'direction') {
    const root = document.documentElement;
    if (!state.direction)
      state.direction = {
        attr: root.getAttribute('dir'),
        styles: ['direction'].map((p) => [
          p,
          root.style.getPropertyValue(p),
          root.style.getPropertyPriority(p),
        ]),
      };
    root.setAttribute('dir', options.direction === 'rtl' ? 'rtl' : 'ltr');
    root.style.setProperty('direction', options.direction === 'rtl' ? 'rtl' : 'ltr', 'important');
    return { direction: root.dir };
  }
  if (action === 'reference') {
    if (options.image) {
      if (
        !/^data:image\/(png|jpeg|webp);base64,/.test(options.image) ||
        options.image.length > 16000000
      )
        throw Error('Use a PNG, JPEG or WebP image smaller than 12 MB.');
      removeReference();
      const l = layer(),
        img = element('img', undefined, l.shadow);
      img.src = options.image;
      img.draggable = false;
      img.style.cssText = 'position:absolute;max-width:none;touch-action:none;';
      state.reference = { ...l, img, x: 0, y: 0, width: innerWidth, opacity: 0.5 };
      const close = element(
        'button',
        text('Remove reference · Esc', 'حذف تصویر مرجع · Esc'),
        l.shadow,
      );
      close.style.cssText = 'position:fixed;top:12px;right:12px;pointer-events:auto;';
      close.onclick = () => {
        removeReference();
      };
      let drag = null;
      img.onpointerdown = (e) => {
        drag = { x: e.clientX - state.reference.x, y: e.clientY - state.reference.y };
        img.setPointerCapture(e.pointerId);
      };
      img.onpointermove = (e) => {
        if (drag && state.reference) {
          state.reference.x = e.clientX - drag.x;
          state.reference.y = e.clientY - drag.y;
          paint();
        }
      };
      img.onpointerup = () => (drag = null);
      const escape = (e) => {
        if (e.key === 'Escape') {
          l.host.remove();
          window.removeEventListener('keydown', escape, true);
          if (state.reference?.host === l.host) state.reference = null;
        }
      };
      window.addEventListener('keydown', escape, true);
      l.host.addEventListener(
        'uia-cleanup',
        () => window.removeEventListener('keydown', escape, true),
        { once: true },
      );
    }
    const ref = state.reference;
    if (!ref) throw Error('Choose a reference image first.');
    for (const k of ['x', 'y', 'width', 'opacity'])
      if (Number.isFinite(options[k])) ref[k] = options[k];
    if (typeof options.drag === 'boolean') ref.drag = options.drag;
    function paint() {
      const r = state.reference;
      if (!r) return;
      Object.assign(r.img.style, {
        left: r.x + 'px',
        top: r.y + 'px',
        width: Math.max(20, Math.min(8000, r.width)) + 'px',
        opacity: String(Math.max(0, Math.min(1, r.opacity))),
        pointerEvents: r.drag ? 'auto' : 'none',
      });
    }
    paint();
    return { reference: true };
  }
  if (['inspect', 'typography', 'measure'].includes(action)) {
    stopSelection();
    const l = layer();
    state.selectionHost = l.host;
    state.abort = new AbortController();
    const signal = state.abort.signal;
    let selected = [];
    let hover;
    const hint = panel(l.shadow);
    element(
      'strong',
      text(
        action === 'measure' ? 'Select two elements' : 'Select an element',
        action === 'measure' ? 'دو عنصر را انتخاب کنید' : 'یک عنصر را انتخاب کنید',
      ),
      hint,
    );
    element('p', text('Esc to cancel · click to inspect', 'کلیک برای بررسی · Esc برای لغو'), hint);
    const close = element('button', text('Close', 'بستن'), hint);
    close.onclick = (event) => {
      if (event.isTrusted) stopSelection();
    };
    function target(e) {
      let el = e.composedPath().find((n) => n instanceof Element);
      return el?.closest('[data-uiassistant-tool]') ? null : el;
    }
    window.addEventListener(
      'pointermove',
      (e) => {
        if (!e.isTrusted) return;
        const el = target(e);
        if (!el) return;
        hover?.remove();
        hover = box(l.shadow, el.getBoundingClientRect());
      },
      { capture: true, signal },
    );
    window.addEventListener(
      'click',
      (e) => {
        if (!e.isTrusted) return;
        const el = target(e);
        if (!el) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        hover?.remove();
        selected.push(el);
        const info = inspect(el);
        hint.replaceChildren();
        if (action === 'measure' && selected.length < 2) {
          box(l.shadow, el.getBoundingClientRect());
          element(
            'p',
            text(
              'First element selected. Choose the second.',
              'عنصر اول انتخاب شد؛ عنصر دوم را انتخاب کنید.',
            ),
            hint,
          );
          return;
        }
        state.abort.abort();
        state.abort = null;
        let result = { kind: action, ...info };
        if (action === 'measure') {
          const a = selected[0].getBoundingClientRect(),
            b = selected[1].getBoundingClientRect(),
            dx = Math.max(0, b.left - a.right, a.left - b.right),
            dy = Math.max(0, b.top - a.bottom, a.top - b.bottom);
          box(l.shadow, a);
          box(l.shadow, b, '#e7bd83');
          const line = element('div', undefined, l.shadow);
          const x1 = a.left + a.width / 2,
            y1 = a.top + a.height / 2,
            x2 = b.left + b.width / 2,
            y2 = b.top + b.height / 2;
          line.style.cssText = `position:fixed;left:${x1}px;top:${y1}px;width:${Math.hypot(x2 - x1, y2 - y1)}px;height:2px;background:#e7bd83;transform-origin:left;transform:rotate(${Math.atan2(y2 - y1, x2 - x1)}rad)`;
          result = {
            kind: action,
            first: inspect(selected[0]),
            second: info,
            horizontalGap: dx,
            verticalGap: dy,
            deltaX: b.left - a.left,
            deltaY: b.top - a.top,
          };
          element('strong', text('Element distances', 'فاصلهٔ عناصر'), hint);
          element('p', `↔ ${dx.toFixed(1)} px · ↕ ${dy.toFixed(1)} px`, hint);
          element('p', `Δx ${result.deltaX.toFixed(1)} · Δy ${result.deltaY.toFixed(1)}`, hint);
        } else {
          box(l.shadow, el.getBoundingClientRect());
          const s = getComputedStyle(el),
            r = el.getBoundingClientRect();
          const pt = parseFloat(s.paddingTop) || 0,
            pl = parseFloat(s.paddingLeft) || 0,
            pr = parseFloat(s.paddingRight) || 0,
            pb = parseFloat(s.paddingBottom) || 0;
          box(
            l.shadow,
            {
              left: r.left + pl,
              top: r.top + pt,
              width: Math.max(0, r.width - pl - pr),
              height: Math.max(0, r.height - pt - pb),
            },
            '#9ccea8',
          );
          box(
            l.shadow,
            {
              left: r.left - (parseFloat(s.marginLeft) || 0),
              top: r.top - (parseFloat(s.marginTop) || 0),
              width: r.width + (parseFloat(s.marginLeft) || 0) + (parseFloat(s.marginRight) || 0),
              height: r.height + (parseFloat(s.marginTop) || 0) + (parseFloat(s.marginBottom) || 0),
            },
            '#e7bd83',
          );
          element('strong', info.label, hint);
          element('p', `${r.width.toFixed(1)} × ${r.height.toFixed(1)} CSS px`, hint);
          element(
            'p',
            text(
              'Purple: border · green: content/padding inset · amber: margin',
              'بنفش: کادر · سبز: محدودهٔ داخلی padding · زرد: margin',
            ),
            hint,
          );
          element('pre', action === 'typography' ? info.typography : info.css, hint);
          const copy = element('button', text('Copy CSS', 'کپی CSS'), hint);
          copy.onclick = async (event) => {
            if (!event.isTrusted) return;
            const res = await send({
              type: 'TOOL_COPY',
              token: options.authorization,
              text: action === 'typography' ? info.typography : `.element {\n${info.css}\n}`,
            });
            copy.replaceChildren(
              copy.querySelector('svg'),
              document.createTextNode(
                res?.ok ? text('Copied', 'کپی شد') : res?.error || 'Copy failed',
              ),
            );
          };
        }
        const done = element('button', text('Close', 'بستن'), hint);
        done.style.marginLeft = '8px';
        done.onclick = stopSelection;
        const escape = (e) => {
          if (e.key === 'Escape') {
            stopSelection();
            window.removeEventListener('keydown', escape, true);
          }
        };
        window.addEventListener('keydown', escape, true);
        state.escape = escape;
        done.addEventListener('click', () => window.removeEventListener('keydown', escape, true), {
          once: true,
        });
        send({ type: 'TOOL_RESULT', result, token: options.authorization }).catch(() => {});
      },
      { capture: true, signal },
    );
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape') stopSelection();
      },
      { capture: true, signal },
    );
    return { started: true };
  }
  const roots = [document],
    nodes = [];
  let truncated = false;
  while (roots.length && !truncated) {
    for (const el of roots.shift().querySelectorAll('*')) {
      if (el.closest('[data-uiassistant-tool]')) continue;
      if (el.shadowRoot) roots.push(el.shadowRoot);
      nodes.push(el);
      if (nodes.length >= 10000) {
        truncated = true;
        break;
      }
    }
  }
  const issues = [],
    groups = {
      colors: new Map(),
      fontSizes: new Map(),
      fontFamilies: new Map(),
      fontWeights: new Map(),
      lineHeights: new Map(),
      spacing: new Map(),
      radii: new Map(),
      shadows: new Map(),
    };
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const cache = new Map();
  function rgb(value) {
    if (cache.has(value)) return cache.get(value);
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data,
      c = [d[0], d[1], d[2], d[3] / 255];
    cache.set(value, c);
    return c;
  }
  const blend = (fg, bg) => fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3]));
  function contrast(a, b) {
    const lum = (c) =>
      c
        .slice(0, 3)
        .map((v) => {
          v /= 255;
          return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        })
        .reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
    const x = lum(a),
      y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  function background(el) {
    let chain = [],
      node = el,
      uncertain = false;
    while (node) {
      const s = getComputedStyle(node);
      if (
        s.backgroundImage !== 'none' ||
        Number(s.opacity) < 1 ||
        s.filter !== 'none' ||
        s.mixBlendMode !== 'normal'
      )
        uncertain = true;
      chain.unshift(rgb(s.backgroundColor));
      node = node.parentElement || node.getRootNode().host;
    }
    if (!chain.some((c) => c[3] === 1)) uncertain = true;
    let color = [255, 255, 255];
    for (const c of chain) color = blend(c, color);
    return { color, uncertain };
  }
  const colorCSS = (c) => 'rgb(' + c.slice(0, 3).map(Math.round).join(', ') + ')';
  function token(group, value) {
    if (value && value !== 'none' && value !== 'normal' && !/^0(?:px)?$/.test(value))
      groups[group].set(value, (groups[group].get(value) || 0) + 1);
  }
  function ariaHidden(el) {
    for (let node = el; node; node = node.parentElement || node.getRootNode().host)
      if (node.getAttribute('aria-hidden') === 'true' || node.inert) return true;
    return false;
  }
  function contentName(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let name = '',
      node;
    while ((node = walker.nextNode()))
      if (!node.parentElement?.closest('[aria-hidden="true"],script,style'))
        name += node.textContent + ' ';
    for (const image of el.querySelectorAll('img[alt],svg > title'))
      if (!ariaHidden(image)) name += (image.getAttribute('alt') || image.textContent) + ' ';
    return name.trim();
  }
  function basicName(el) {
    const refs = (el.getAttribute('aria-labelledby') || '').trim().split(/\s+/).filter(Boolean);
    if (refs.length) {
      const name = refs
        .map((ref) => el.getRootNode().getElementById?.(ref)?.textContent || '')
        .join(' ')
        .trim();
      if (name) return name;
    }
    if (el.getAttribute('aria-label')?.trim()) return el.getAttribute('aria-label').trim();
    const labels = [...(el.labels || [])].map(contentName).join(' ').trim();
    if (labels) return labels;
    if (el.tagName === 'INPUT' && ['submit', 'reset', 'button'].includes(el.type))
      return el.value || (el.type !== 'button' ? el.type : '');
    if (el.tagName === 'INPUT' && el.type === 'image') return el.alt || el.title || '';
    if (el.matches('button,a,[role="button"],[role="link"]'))
      return contentName(el) || el.title || '';
    return el.title || '';
  }
  const headingLevels = new Map();
  const finding = (el, type, en, ps) =>
    issues.push({ id: id(el), label: label(el), type, detail: text(en, ps) });
  if (action === 'semantics' && !document.documentElement.lang.trim())
    finding(
      document.documentElement,
      'missing-page-language',
      'Set a lang attribute on html to identify the page language.',
      'زبان صفحه را با ویژگی lang روی html مشخص کنید.',
    );
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    if (i % 400 === 0) await new Promise((r) => setTimeout(r, 0));
    const s = getComputedStyle(el),
      r = el.getBoundingClientRect();
    if (s.display === 'none' || s.visibility === 'hidden' || !r.width || !r.height) continue;
    if (action === 'semantics' && !ariaHidden(el)) {
      if (
        el.tagName === 'IMG' &&
        !el.hasAttribute('alt') &&
        !['none', 'presentation'].includes(el.getAttribute('role')) &&
        !el.getAttribute('aria-label')?.trim() &&
        !el.getAttribute('aria-labelledby')?.trim()
      )
        finding(
          el,
          'missing-image-alternative',
          'Add descriptive alt text, or alt="" for a decorative image.',
          'برای تصویر معنادار alt توصیفی و برای تصویر تزئینی alt="" بنویسید.',
        );
      if (
        el.matches(
          'input:not([type="hidden"]),select,textarea,button,a[href],[role="button"],[role="link"]',
        ) &&
        !basicName(el)
      )
        finding(
          el,
          'missing-control-name',
          'No basic accessible name found. Add an associated label or meaningful control text; verify in the accessibility tree.',
          'نام قابل‌دسترسی ساده پیدا نشد. برچسب مرتبط یا متن معنادار اضافه کنید و در درخت دسترس‌پذیری بررسی کنید.',
        );
      if (/^H[1-6]$/.test(el.tagName)) {
        const level = Number(el.tagName[1]),
          root = el.getRootNode(),
          previous = headingLevels.get(root) || 0;
        if (
          !contentName(el) &&
          !el.getAttribute('aria-label')?.trim() &&
          !el.getAttribute('aria-labelledby')?.trim()
        )
          finding(
            el,
            'empty-heading',
            'This heading has no text alternative.',
            'این عنوان متن جایگزین ندارد.',
          );
        if (level > previous + 1)
          finding(
            el,
            'heading-order-review',
            `Heading level jumps from ${previous || 'start'} to h${level}; review the outline.`,
            `سطح عنوان از ${previous || 'شروع'} به h${level} می‌رود؛ ساختار عنوان‌ها را بررسی کنید.`,
          );
        headingLevels.set(root, level);
      }
    }
    if (action === 'layout') {
      if (r.right > document.documentElement.clientWidth + 1 || r.left < -1)
        issues.push({
          id: id(el),
          label: label(el),
          type: 'horizontal-overflow',
          detail: `x ${r.left.toFixed(1)}…${r.right.toFixed(1)} / viewport ${document.documentElement.clientWidth}px`,
        });
      if (
        (el.scrollWidth > el.clientWidth + 1 && ['hidden', 'clip'].includes(s.overflowX)) ||
        (el.scrollHeight > el.clientHeight + 1 && ['hidden', 'clip'].includes(s.overflowY))
      )
        issues.push({
          id: id(el),
          label: label(el),
          type: 'clipped-content',
          detail: `content ${el.scrollWidth}×${el.scrollHeight} / box ${el.clientWidth}×${el.clientHeight}`,
        });
      if (
        el.childNodes.length &&
        [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) &&
        (s.textOverflow === 'ellipsis' || s.getPropertyValue('-webkit-line-clamp') !== 'none') &&
        (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
      )
        issues.push({
          id: id(el),
          label: label(el),
          type: 'truncated-text',
          detail: 'Text exceeds the visible box.',
        });
    }
    if (
      action === 'accessibility' &&
      [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    ) {
      const bg = background(el),
        fg = rgb(s.color),
        threshold =
          parseFloat(s.fontSize) >= 24 ||
          (parseFloat(s.fontSize) >= 18.666 && Number(s.fontWeight) >= 700)
            ? 3
            : 4.5;
      if (bg.uncertain) {
        issues.push({
          id: id(el),
          label: label(el),
          type: 'manual-contrast-check',
          detail: 'Image, gradient, opacity or blending requires visual review.',
        });
        continue;
      }
      const ratio = contrast(blend(fg, bg.color), bg.color);
      if (ratio < threshold) {
        let suggestion = null;
        for (let step = 1; step <= 100 && !suggestion; step++)
          for (const end of [0, 255]) {
            const c = fg.slice(0, 3).map((v) => v + ((end - v) * step) / 100);
            if (contrast(c, bg.color) >= threshold) {
              suggestion = colorCSS(c);
              break;
            }
          }
        issues.push({
          id: id(el),
          label: label(el),
          type: 'low-contrast',
          ratio: Number(ratio.toFixed(2)),
          required: threshold,
          background: colorCSS(bg.color),
          foreground: s.color,
          suggestion,
          detail: `${ratio.toFixed(2)}:1 / ${threshold}:1 · ${suggestion || 'review required'}`,
        });
      }
    }
    if (action === 'tokens') {
      for (const p of ['color', 'backgroundColor', 'borderTopColor'])
        if (rgb(s[p])[3] > 0) token('colors', s[p]);
      token('fontSizes', s.fontSize);
      token('fontFamilies', s.fontFamily);
      token('fontWeights', s.fontWeight);
      token('lineHeights', s.lineHeight);
      for (const p of [
        'paddingTop',
        'paddingRight',
        'paddingBottom',
        'paddingLeft',
        'marginTop',
        'marginRight',
        'marginBottom',
        'marginLeft',
        'rowGap',
        'columnGap',
      ])
        token('spacing', s[p]);
      for (const p of [
        'borderTopLeftRadius',
        'borderTopRightRadius',
        'borderBottomLeftRadius',
        'borderBottomRightRadius',
      ])
        token('radii', s[p]);
      token('shadows', s.boxShadow);
    }
  }
  if (action === 'tokens') {
    const tokens = Object.fromEntries(
      Object.entries(groups).map(([k, v]) => [
        k,
        [...v].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count })),
      ]),
    );
    return { kind: action, tokens, inspected: nodes.length, truncated };
  }
  if (!['layout', 'accessibility', 'semantics'].includes(action))
    throw Error('Unknown frontend tool.');
  return {
    kind: action,
    issues: issues.slice(0, 1000),
    totalIssues: issues.length,
    inspected: nodes.length,
    truncated,
    viewport: { width: innerWidth, height: innerHeight },
    note:
      action === 'semantics'
        ? 'Preliminary DOM heuristics, not a full accessible-name computation or WCAG audit. Heading jumps require review. Hidden content and frames are excluded.'
        : 'Computed DOM checks; hidden content, cross-origin frames and image text are not audited.',
  };
}
