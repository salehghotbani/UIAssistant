// Self-contained: serialized into the top-frame isolated world. Receives no pixels.
export async function capturePage(action, options = {}) {
  // Rejected executeScript promises are not reported consistently by all browsers.
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    return { ok: false, error: error.message || 'Screenshot page operation failed.' };
  }
  async function run() {
    const key = '__uiaCapturePage';
    const frame = () =>
      new Promise((resolve) => {
        const timer = setTimeout(resolve, 150);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            clearTimeout(timer);
            resolve();
          }),
        );
      });
    const metrics = () => {
      const root = document.scrollingElement || document.documentElement;
      const width = Math.max(root.scrollWidth, root.clientWidth),
        height = Math.max(root.scrollHeight, root.clientHeight);
      const rtl = getComputedStyle(root).direction === 'rtl';
      return {
        width,
        height,
        viewportWidth: root.clientWidth,
        viewportHeight: root.clientHeight,
        innerWidth,
        innerHeight,
        x: scrollX + (rtl ? Math.max(0, width - root.clientWidth) : 0),
        y: scrollY,
        rawX: scrollX,
        rawY: scrollY,
        rtl,
        scale: devicePixelRatio,
      };
    };
    function restore(s) {
      if (!s || s.restored) return;
      s.restored = true;
      clearTimeout(s.timer);
      s.abort.abort();
      s.host?.remove();
      for (const [el, value, priority, hadStyle] of s.hidden) {
        if (value) el.style.setProperty('visibility', value, priority);
        else el.style.removeProperty('visibility');
        if (!hadStyle && el.getAttribute('style') === '') el.removeAttribute('style');
      }
      if (s.original)
        window.scrollTo({ left: s.original.x, top: s.original.y, behavior: 'instant' });
      for (const [el, property, value, priority, hadStyle] of [...(s.styles || [])].reverse()) {
        if (value) el.style.setProperty(property, value, priority);
        else el.style.removeProperty(property);
        if (!hadStyle && el.getAttribute('style') === '') el.removeAttribute('style');
      }
      s.style?.remove();
      if (globalThis[key] === s) delete globalThis[key];
    }
    if (action === 'restore' || action === 'cancel') {
      const s = globalThis[key];
      if (s?.id === options.id) {
        if (action === 'cancel') {
          s.cancelled = true;
          s.reject?.(Error('Screenshot cancelled.'));
        }
        restore(s);
      }
      return {};
    }
    if (action === 'begin' || action === 'select') {
      if (document.hidden) throw Error('Keep the page visible while capturing.');
      if (globalThis[key]) throw Error('A screenshot is already running in this page.');
      const fa = options.language === 'fa';
      const s = {
        id: options.id,
        abort: new AbortController(),
        hidden: [],
        cancelled: false,
        original: action === 'begin' ? { x: scrollX, y: scrollY } : null,
      };
      globalThis[key] = s;
      const host = document.createElement('div');
      s.host = host;
      host.dataset.uiassistantTool = '';
      host.style.cssText =
        'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
      const shadow = host.attachShadow({ mode: 'closed' });
      const css = document.createElement('style');
      css.textContent =
        '*{box-sizing:border-box}button{display:inline-flex;align-items:center;gap:7px;border:1px solid #bda9ef;background:#7b55dc;color:white;border-radius:6px;padding:8px 12px;font:12px system-ui;cursor:pointer;margin:4px}button:focus-visible{outline:2px solid white;outline-offset:3px}svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8}';
      shadow.append(css);
      const panel = document.createElement('div');
      panel.style.cssText =
        'position:fixed;top:14px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:12px;max-width:calc(100vw - 28px);padding:10px 14px;border:1px solid #a994d1;border-radius:10px;background:#25212f;color:white;font:13px/1.7 system-ui;pointer-events:none;';
      const text = document.createElement('span');
      text.textContent = fa ? 'گرفتن عکس · Esc برای لغو' : 'Taking screenshot · Esc to cancel';
      s.label = text;
      const close = document.createElement('button');
      close.style.pointerEvents = 'auto';
      close.textContent = fa ? 'لغو' : 'Cancel';
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS(icon.namespaceURI, 'path');
      path.setAttribute('d', 'm6 6 12 12M6 18 18 6');
      icon.append(path);
      close.prepend(icon);
      panel.append(text, close);
      shadow.append(panel);
      document.documentElement.append(host);
      s.timer = setTimeout(() => {
        s.cancelled = true;
        s.reject?.(Error('Screenshot timed out.'));
        restore(s);
      }, 120000);
      close.onclick = (event) => {
        if (event.isTrusted) {
          s.cancelled = true;
          s.reject?.(Error('Screenshot cancelled.'));
        }
      };
      window.addEventListener(
        'keydown',
        (event) => {
          if (event.isTrusted && event.key === 'Escape') {
            event.preventDefault();
            event.stopImmediatePropagation();
            s.cancelled = true;
            s.reject?.(Error('Screenshot cancelled.'));
          }
        },
        { capture: true, signal: s.abort.signal },
      );
      document.addEventListener(
        'visibilitychange',
        () => {
          if (document.hidden) {
            s.cancelled = true;
            s.reject?.(Error('Screenshot cancelled: the page is no longer visible.'));
          }
        },
        { signal: s.abort.signal },
      );
      if (action === 'select') {
        const before = metrics();
        const shield = document.createElement('div');
        shield.style.cssText =
          'position:fixed;inset:0;pointer-events:auto;cursor:crosshair;background:#14101b30;touch-action:none;';
        shadow.prepend(shield);
        const box = document.createElement('div');
        box.style.cssText =
          'position:fixed;display:none;pointer-events:none;border:2px solid #a78bfa;background:#ffffff22;box-shadow:0 0 0 99999px #16101f35;';
        shadow.append(box);
        text.textContent = fa
          ? 'کلیک و کشیدن برای انتخاب ناحیه · Esc برای لغو'
          : 'Drag to select an area · Esc to cancel';
        let start = null;
        try {
          return await new Promise((resolve, reject) => {
            s.reject = reject;
            const point = (e) => ({
              x: Math.max(0, Math.min(before.viewportWidth, e.clientX)),
              y: Math.max(0, Math.min(before.viewportHeight, e.clientY)),
            });
            const rect = (p) => ({
              x: Math.min(start.x, p.x),
              y: Math.min(start.y, p.y),
              width: Math.abs(p.x - start.x),
              height: Math.abs(p.y - start.y),
            });
            shield.onpointerdown = (event) => {
              if (!event.isTrusted || event.button !== 0) return;
              event.preventDefault();
              event.stopImmediatePropagation();
              start = point(event);
              shield.setPointerCapture(event.pointerId);
            };
            shield.onpointermove = (event) => {
              if (!event.isTrusted || !start) return;
              const r = rect(point(event));
              Object.assign(box.style, {
                display: 'block',
                left: r.x + 'px',
                top: r.y + 'px',
                width: r.width + 'px',
                height: r.height + 'px',
              });
              text.textContent = `${Math.round(r.width)} × ${Math.round(r.height)} px · Esc`;
            };
            shield.onpointerup = (event) => {
              if (!event.isTrusted || !start || event.button !== 0) return;
              event.preventDefault();
              event.stopImmediatePropagation();
              const r = rect(point(event));
              if (r.width < 2 || r.height < 2) {
                start = null;
                return;
              }
              const after = metrics();
              if (
                after.rawX !== before.rawX ||
                after.rawY !== before.rawY ||
                after.innerWidth !== before.innerWidth ||
                after.innerHeight !== before.innerHeight ||
                after.scale !== before.scale
              )
                return reject(Error('The page moved or resized. Select again.'));
              resolve({ rect: r, metrics: before });
            };
            shield.onpointercancel = () => {
              start = null;
              box.style.display = 'none';
            };
            window.addEventListener(
              'resize',
              () => reject(Error('Viewport changed. Select again.')),
              { signal: s.abort.signal },
            );
            window.addEventListener('scroll', () => reject(Error('Page scrolled. Select again.')), {
              capture: true,
              signal: s.abort.signal,
            });
          });
        } finally {
          restore(s);
          await frame();
        }
      }
      s.style = document.createElement('style');
      s.style.textContent =
        'html,body{scroll-behavior:auto!important;scroll-snap-type:none!important;overflow-anchor:none!important}*{scroll-behavior:auto!important;scroll-snap-type:none!important;animation-play-state:paused!important;transition:none!important;caret-color:transparent!important}';
      document.documentElement.append(s.style);
      s.styles = [];
      for (const el of new Set(
        [document.documentElement, document.body, document.scrollingElement].filter(Boolean),
      ))
        for (const [property, value] of [
          ['scroll-behavior', 'auto'],
          ['scroll-snap-type', 'none'],
          ['overflow-anchor', 'none'],
        ]) {
          s.styles.push([
            el,
            property,
            el.style.getPropertyValue(property),
            el.style.getPropertyPriority(property),
            el.hasAttribute('style'),
          ]);
          el.style.setProperty(property, value, 'important');
        }
      return metrics();
    }
    const s = globalThis[key];
    if (!s || s.id !== options.id || s.cancelled) throw Error('Screenshot cancelled or expired.');
    if (action === 'check') return metrics();
    if (action === 'move') {
      const m = metrics();
      window.scrollTo({
        left: options.x - (m.rtl ? Math.max(0, m.width - m.viewportWidth) : 0),
        top: options.y,
        behavior: 'instant',
      });
      await frame();
      await new Promise((r) => setTimeout(r, 180));
      if (s.cancelled) throw Error('Screenshot cancelled.');
      s.label.textContent = `${options.index + 1} / ${options.total} · Esc`;
      s.host.style.visibility = 'hidden';
      await frame();
      return metrics();
    }
    if (action === 'next') {
      if (options.hideFixed) {
        for (const el of document.querySelectorAll('*')) {
          if (el === s.host || el.closest('[data-uiassistant-tool]')) continue;
          const css = getComputedStyle(el),
            r = el.getBoundingClientRect();
          if (
            ['fixed', 'sticky'].includes(css.position) &&
            r.width &&
            r.height &&
            r.bottom > 0 &&
            r.top < innerHeight &&
            r.right > 0 &&
            r.left < innerWidth &&
            !s.hidden.some(([node]) => node === el)
          ) {
            s.hidden.push([
              el,
              el.style.getPropertyValue('visibility'),
              el.style.getPropertyPriority('visibility'),
              el.hasAttribute('style'),
            ]);
            el.style.setProperty('visibility', 'hidden', 'important');
          }
        }
      }
      s.host.style.visibility = 'visible';
      return {};
    }
    throw Error('Unknown screenshot page operation.');
  }
}
