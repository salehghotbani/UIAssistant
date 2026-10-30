// Serialized in the top-frame isolated world. Returns geometry only, never pixels.
export async function captureContainerPage(action, options = {}) {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    return { ok: false, error: error.message || 'Scrollable capture failed.' };
  }
  async function run() {
    const key = '__uiaContainerCapture';
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
    const ancestor = (node) => node.parentElement || node.getRootNode().host;
    function restore(s) {
      if (!s || s.restored) return;
      s.restored = true;
      clearTimeout(s.timer);
      s.abort.abort();
      s.host.remove();
      s.marker?.remove();
      for (const [el, left, top] of s.scrolls) {
        el.scrollLeft = left;
        el.scrollTop = top;
      }
      window.scrollTo({ left: s.windowX, top: s.windowY, behavior: 'instant' });
      for (const [el, property, value, priority, hadStyle] of [
        ...s.styles,
        ...s.hidden,
      ].reverse()) {
        if (value) el.style.setProperty(property, value, priority);
        else el.style.removeProperty(property);
        if (!hadStyle && el.getAttribute('style') === '') el.removeAttribute('style');
      }
      s.style?.remove();
      if (globalThis[key] === s) delete globalThis[key];
    }
    function set(s, el, property, value, list = s.styles) {
      if (!list.some(([node, p]) => node === el && p === property))
        list.push([
          el,
          property,
          el.style.getPropertyValue(property),
          el.style.getPropertyPriority(property),
          el.hasAttribute('style'),
        ]);
      el.style.setProperty(property, value, 'important');
    }
    function clippedRect(el, rect) {
      let left = Math.max(0, rect.left),
        top = Math.max(0, rect.top),
        right = Math.min(document.documentElement.clientWidth, rect.right),
        bottom = Math.min(document.documentElement.clientHeight, rect.bottom);
      for (let node = el; node; node = ancestor(node)) {
        const css = getComputedStyle(node),
          r = node.getBoundingClientRect(),
          sx = r.width / node.offsetWidth || 1,
          sy = r.height / node.offsetHeight || 1;
        if (node === el || ['auto', 'scroll', 'hidden', 'clip'].includes(css.overflowX)) {
          left = Math.max(left, r.left + node.clientLeft * sx);
          right = Math.min(right, r.left + (node.clientLeft + node.clientWidth) * sx);
        }
        if (node === el || ['auto', 'scroll', 'hidden', 'clip'].includes(css.overflowY)) {
          top = Math.max(top, r.top + node.clientTop * sy);
          bottom = Math.min(bottom, r.top + (node.clientTop + node.clientHeight) * sy);
        }
      }
      return {
        left,
        top,
        right,
        bottom,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
      };
    }
    function metrics(s) {
      const el = s.el;
      if (!el?.isConnected) throw Error('The selected element was removed.');
      const r = el.getBoundingClientRect(),
        sx = r.width / el.offsetWidth,
        sy = r.height / el.offsetHeight;
      const box = clippedRect(el, {
        left: r.left + el.clientLeft * sx,
        top: r.top + el.clientTop * sy,
        right: r.left + (el.clientLeft + el.clientWidth) * sx,
        bottom: r.top + (el.clientTop + el.clientHeight) * sy,
      });
      return {
        width: el.scrollWidth,
        height: el.scrollHeight,
        viewportWidth: Math.floor(box.width / sx),
        viewportHeight: Math.floor(box.height / sy),
        innerWidth,
        innerHeight,
        scale: devicePixelRatio,
        elementScaleX: sx,
        elementScaleY: sy,
        x: el.scrollLeft,
        y: el.scrollTop,
        crop: s.marker?.getBoundingClientRect().toJSON(),
      };
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
    if (action === 'choose') {
      if (document.hidden) throw Error('Keep the page visible while capturing.');
      if (globalThis[key]) throw Error('A scrollable capture is already running.');
      const s = {
        id: options.id,
        abort: new AbortController(),
        styles: [],
        hidden: [],
        scrolls: [],
        windowX: scrollX,
        windowY: scrollY,
        cancelled: false,
      };
      globalThis[key] = s;
      const fa = options.language === 'fa';
      s.host = document.createElement('div');
      s.host.dataset.uiassistantTool = '';
      s.host.style.cssText =
        'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
      const shadow = s.host.attachShadow({ mode: 'closed' });
      const shield = document.createElement('div');
      shield.style.cssText = 'position:fixed;inset:0;pointer-events:auto;cursor:crosshair;';
      const outline = document.createElement('div');
      outline.style.cssText =
        'position:fixed;pointer-events:none;border:2px solid #a78bfa;background:#9d70ff18;display:none;';
      const panel = document.createElement('div');
      panel.style.cssText =
        'position:fixed;top:12px;left:50%;transform:translateX(-50%);max-width:calc(100vw - 24px);padding:12px 16px;background:#292136;color:white;border:1px solid #ad8be4;border-radius:10px;font:13px/1.7 system-ui;pointer-events:none;';
      panel.textContent = fa
        ? 'روی ناحیهٔ اسکرول‌دار کلیک کنید · Alt: والد · Esc: لغو'
        : 'Click a scrollable element · Alt: parent · Esc: cancel';
      s.label = panel;
      shadow.append(shield, outline, panel);
      document.documentElement.append(s.host);
      s.timer = setTimeout(() => {
        s.reject?.(Error('Screenshot timed out.'));
        restore(s);
      }, 120000);
      document.addEventListener(
        'visibilitychange',
        () => {
          if (document.hidden) {
            s.cancelled = true;
            s.reject?.(Error('Screenshot cancelled: page hidden.'));
          }
        },
        { signal: s.abort.signal },
      );
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
      function target(event) {
        s.host.style.visibility = 'hidden';
        let el = document.elementFromPoint(event.clientX, event.clientY);
        s.host.style.visibility = 'visible';
        while (el?.shadowRoot) {
          const child = el.shadowRoot.elementFromPoint(event.clientX, event.clientY);
          if (!child || child === el) break;
          el = child;
        }
        const candidates = [];
        for (; el; el = ancestor(el)) {
          if (el === document.body || el === document.documentElement) continue;
          const css = getComputedStyle(el);
          if (
            (el.scrollHeight > el.clientHeight + 1 &&
              ['auto', 'scroll', 'overlay'].includes(css.overflowY)) ||
            (el.scrollWidth > el.clientWidth + 1 &&
              ['auto', 'scroll', 'overlay'].includes(css.overflowX))
          )
            candidates.push(el);
        }
        return candidates[event.altKey ? Math.min(1, candidates.length - 1) : 0];
      }
      shield.onpointermove = (event) => {
        if (!event.isTrusted) return;
        const el = target(event);
        if (!el) {
          outline.style.display = 'none';
          return;
        }
        const r = el.getBoundingClientRect();
        Object.assign(outline.style, {
          display: 'block',
          left: r.left + 'px',
          top: r.top + 'px',
          width: r.width + 'px',
          height: r.height + 'px',
        });
        panel.textContent = `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} · ${el.scrollWidth} × ${el.scrollHeight} · Alt · Esc`;
      };
      try {
        return await new Promise((resolve, reject) => {
          s.reject = reject;
          shield.onclick = (event) => {
            if (!event.isTrusted) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            const el = target(event);
            if (!el) return;
            s.el = el;
            for (let node = el; node; node = ancestor(node)) {
              s.scrolls.push([node, node.scrollLeft, node.scrollTop]);
            }
            s.reject = null;
            shield.remove();
            outline.remove();
            panel.textContent = fa
              ? 'در حال ثبت ناحیه · Esc برای لغو'
              : 'Capturing scrollable element · Esc to cancel';
            resolve({ selected: true });
          };
        });
      } catch (error) {
        restore(s);
        throw error;
      }
    }
    const s = globalThis[key];
    if (!s || s.id !== options.id || s.cancelled) throw Error('Screenshot cancelled or expired.');
    if (action === 'begin') {
      for (const [el] of s.scrolls) {
        for (const [p, v] of [
          ['scroll-behavior', 'auto'],
          ['scroll-snap-type', 'none'],
          ['overflow-anchor', 'none'],
        ])
          set(s, el, p, v);
        const transform = getComputedStyle(el).transform;
        if (transform !== 'none') {
          const matrix = new DOMMatrixReadOnly(transform);
          if (
            !matrix.is2D ||
            Math.abs(matrix.b) > 0.001 ||
            Math.abs(matrix.c) > 0.001 ||
            matrix.a <= 0 ||
            matrix.d <= 0
          )
            throw Error('Rotated or skewed scroll areas are not supported.');
        }
      }
      if (getComputedStyle(s.el).position === 'static') set(s, s.el, 'position', 'relative');
      s.style = document.createElement('style');
      s.style.textContent =
        '*{animation-play-state:paused!important;transition:none!important;caret-color:transparent!important}';
      document.documentElement.append(s.style);
      s.el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      await frame();
      return metrics(s);
    }
    if (action === 'move') {
      s.marker?.remove();
      const marker = document.createElement('div');
      s.marker = marker;
      const offset =
        getComputedStyle(s.el).direction === 'rtl' ? s.el.scrollWidth - s.el.clientWidth : 0;
      marker.style.cssText = `all:initial;position:absolute!important;left:${options.contentX - offset}px!important;top:${options.contentY}px!important;width:${options.width}px!important;height:${options.height}px!important;visibility:hidden!important;pointer-events:none!important;margin:0!important;padding:0!important;border:0!important;`;
      s.el.append(marker);
      marker.scrollIntoView({ block: 'start', inline: 'start', behavior: 'instant' });
      await frame();
      await new Promise((r) => setTimeout(r, 180));
      if (s.cancelled) throw Error('Screenshot cancelled.');
      const r = marker.getBoundingClientRect(),
        visible = clippedRect(s.el, r);
      if (visible.width < r.width - 1 || visible.height < r.height - 1)
        throw Error('The scroll area is clipped. Reveal it or zoom out and try again.');
      s.label.textContent = `${options.index + 1} / ${options.total} · Esc`;
      s.host.style.visibility = 'hidden';
      await frame();
      return metrics(s);
    }
    if (action === 'check') return metrics(s);
    if (action === 'next') {
      if (options.hideFixed) {
        for (const el of s.el.querySelectorAll('*')) {
          if (el === s.marker) continue;
          const css = getComputedStyle(el),
            r = el.getBoundingClientRect();
          if (
            ['fixed', 'sticky'].includes(css.position) &&
            r.bottom > 0 &&
            r.top < innerHeight &&
            r.right > 0 &&
            r.left < innerWidth
          )
            set(s, el, 'visibility', 'hidden', s.hidden);
        }
      }
      s.host.style.visibility = 'visible';
      return {};
    }
    throw Error('Unknown scrollable capture operation.');
  }
}
