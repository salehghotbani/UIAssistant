(() => {
  const api = globalThis.browser ?? globalThis.chrome;
  if (window.__uiassistant_sampler_v1) return;
  window.__uiassistant_sampler_v1 = true;
  let session = null;
  const send = async (message) => {
    const result = await api.runtime.sendMessage(message);
    if (!result?.ok) throw new Error(result?.error || 'UIAssistant could not complete the action.');
    return result;
  };
  const waitFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  async function loadImage(url) {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    return { canvas, ctx };
  }
  function finish() {
    if (!session) return;
    for (const [type, handler] of session.events) window.removeEventListener(type, handler, true);
    session.host.remove();
    session.cursor.remove();
    session = null;
  }
  function hex(c) {
    return (
      '#' +
      c
        .map((n) => Math.round(n).toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()
    );
  }
  function elementAt(s) {
    s.host.style.visibility = 'hidden';
    let el = document.elementFromPoint(s.x, s.y);
    s.host.style.visibility = 'visible';
    while (el?.shadowRoot) {
      const inner = el.shadowRoot.elementFromPoint(s.x, s.y);
      if (!inner || inner === el) break;
      el = inner;
    }
    return el;
  }
  function area(s, x = s.x, y = s.y, region = null) {
    const sx = s.canvas.width / innerWidth,
      sy = s.canvas.height / innerHeight;
    let left, top, w, h;
    if (region) {
      left = Math.floor(region.x * sx);
      top = Math.floor(region.y * sy);
      w = Math.max(1, Math.round(region.width * sx));
      h = Math.max(1, Math.round(region.height * sy));
    } else {
      left = Math.round(x * sx) - Math.floor(s.size / 2);
      top = Math.round(y * sy) - Math.floor(s.size / 2);
      w = h = s.size;
    }
    left = Math.max(0, Math.min(s.canvas.width - 1, left));
    top = Math.max(0, Math.min(s.canvas.height - 1, top));
    w = Math.min(w, s.canvas.width - left);
    h = Math.min(h, s.canvas.height - top);
    const data = s.ctx.getImageData(left, top, w, h).data;
    let r = 0,
      g = 0,
      b = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    return hex([r, g, b].map((n) => n / (data.length / 4)));
  }
  function draw(s) {
    if (session !== s) return;
    s.cross.style.left = s.x - 6 + 'px';
    s.cross.style.top = s.y - 6 + 'px';
    const value = area(s);
    s.label.textContent = value;
    s.swatch.style.background = value;
    const sx = s.canvas.width / innerWidth,
      sy = s.canvas.height / innerHeight;
    s.magctx.imageSmoothingEnabled = false;
    s.magctx.clearRect(0, 0, 110, 110);
    s.magctx.drawImage(s.canvas, s.x * sx - 5, s.y * sy - 5, 11, 11, 0, 0, 110, 110);
    s.hud.style.left = Math.min(innerWidth - 270, Math.max(8, s.x + 22)) + 'px';
    s.hud.style.top = Math.min(innerHeight - 190, Math.max(8, s.y + 22)) + 'px';
    const el = elementAt(s);
    if (el && el !== s.host) {
      const r = el.getBoundingClientRect();
      s.info.textContent = `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${[
        ...el.classList,
      ]
        .slice(0, 2)
        .map((c) => '.' + c)
        .join('')} · ${Math.round(r.width)} × ${Math.round(r.height)}`;
      if (s.settings.outline) {
        s.outline.style.cssText = `position:fixed;left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px;border:1px solid #a78bfa;box-sizing:border-box;`;
      }
    }
    if (s.start) {
      const r = {
        x: Math.min(s.start.x, s.x),
        y: Math.min(s.start.y, s.y),
        width: Math.abs(s.x - s.start.x),
        height: Math.abs(s.y - s.start.y),
      };
      s.region = r;
      s.selection.style.cssText = `position:fixed;left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px;border:1px dashed white;background:#8b5cf633;`;
    }
    s.sizeLabel.textContent = `${s.size} × ${s.size} px`;
  }
  async function refresh(s) {
    s.host.style.visibility = 'hidden';
    await waitFrame();
    try {
      const result = await send({ type: 'CAPTURE' });
      const image = await loadImage(result.image);
      if (session === s) Object.assign(s, image);
    } finally {
      if (session === s) s.host.style.visibility = 'visible';
    }
  }
  async function commit(s, region = null) {
    if (s.busy) return;
    s.busy = true;
    try {
      await refresh(s);
      if (session !== s) return;
      const color = area(s, s.x, s.y, region);
      const location = {
        x: s.x / innerWidth,
        y: s.y / innerHeight,
        viewport: { width: innerWidth, height: innerHeight },
        scrollX,
        scrollY,
        size: s.size,
        region: region
          ? {
              x: region.x / innerWidth,
              y: region.y / innerHeight,
              width: region.width / innerWidth,
              height: region.height / innerHeight,
            }
          : null,
      };
      const result = await send({ type: 'PICKED', color, location });
      finish();
      notify(
        result.copyError ||
          `${color} ${s.fa ? 'ذخیره شد' : 'saved'}${s.settings.autoCopy && !result.copyError ? ' · Copied' : ''}`,
        s.fa,
      );
    } catch (e) {
      s.busy = false;
      if (session === s) {
        s.info.textContent = e.message;
        s.host.style.visibility = 'visible';
      }
    }
  }
  function notify(text, fa = false) {
    const host = document.createElement('div');
    host.style.cssText =
      'all:initial;position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:2147483647;';
    const shadow = host.attachShadow({ mode: 'closed' });
    const box = document.createElement('div');
    box.style.cssText =
      'display:flex;align-items:center;gap:16px;background:#22232c;color:white;padding:14px 18px;border:1px solid #454554;border-radius:12px;font:13px system-ui;box-shadow:0 8px 35px #0005;';
    const label = document.createElement('span');
    label.textContent = text;
    const button = document.createElement('button');
    button.textContent = fa ? 'باز کردن UIAssistant' : 'Open UIAssistant';
    button.style.cssText =
      'border:0;border-radius:6px;background:#a78bfa;color:#171420;padding:7px 10px;cursor:pointer;font:inherit';
    button.onclick = () => {
      send({ type: 'OPEN_WORKSPACE' }).catch(() => {});
      host.remove();
    };
    box.append(label, button);
    shadow.append(box);
    document.documentElement.append(host);
    setTimeout(() => host.remove(), 6500);
  }
  async function start(message) {
    finish();
    const fa = message.settings.language === 'fa';
    const host = document.createElement('div');
    host.style.cssText =
      'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.replaceChildren(
      DOMPurify.sanitize(
        `<style>*{box-sizing:border-box}.hud{position:fixed;width:252px;background:#202129;color:#f5f4fb;border:1px solid #53515e;border-radius:13px;padding:12px;font:12px/1.5 system-ui;box-shadow:0 15px 50px #0006}.top{display:flex;gap:12px;align-items:center}canvas{width:90px;height:90px;border-radius:5px;image-rendering:pixelated}.mag{position:relative}.mag:after{content:'';position:absolute;left:40px;top:40px;width:10px;height:10px;border:1px solid white;box-shadow:0 0 0 1px #222}.swatch{width:27px;height:27px;border:1px solid #fff4;border-radius:6px}strong{display:block;font:600 16px ui-monospace,monospace;margin:4px 0}.info{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#c3bdcf;padding-top:9px}.help{color:#a8a2b6;font-size:10px;margin-top:6px}.cross{position:fixed;width:13px;height:13px;border:1px solid #fff;box-shadow:0 0 0 1px #222;border-radius:50%}</style><div class="outline"></div><div class="selection"></div><div class="cross"></div><div class="hud"><div class="top"><div class="mag"><canvas width="110" height="110"></canvas></div><div><div class="swatch"></div><strong></strong><span class="size"></span></div></div><div class="info"></div><div class="help">${fa ? 'کلیک: انتخاب · کشیدن: میانگین ناحیه' : 'Click to pick · Drag for area average'}<br>↑ ↓ ← → · Enter · +/- · Space: refresh · Esc</div></div>`,
        { ADD_TAGS: ['use'], ADD_ATTR: ['href'], RETURN_DOM_FRAGMENT: true, FORCE_BODY: true },
      ),
    );
    const cursor = document.createElement('style');
    cursor.textContent = 'html,html *{cursor:crosshair!important}';
    document.documentElement.append(cursor, host);
    const image = await loadImage(message.image);
    const s = {
      ...image,
      host,
      cursor,
      shadow,
      fa,
      settings: message.settings,
      size: message.settings.sampleSize,
      x: innerWidth / 2,
      y: innerHeight / 2,
      events: [],
      hud: shadow.querySelector('.hud'),
      label: shadow.querySelector('strong'),
      swatch: shadow.querySelector('.swatch'),
      info: shadow.querySelector('.info'),
      sizeLabel: shadow.querySelector('.size'),
      outline: shadow.querySelector('.outline'),
      selection: shadow.querySelector('.selection'),
      cross: shadow.querySelector('.cross'),
      magctx: shadow.querySelector('canvas').getContext('2d'),
    };
    session = s;
    // A transparent shield lets the top-frame sampler receive pointer events over embedded frames.
    for (const frame of document.querySelectorAll('iframe')) {
      const r = frame.getBoundingClientRect();
      const shield = document.createElement('div');
      shield.style.cssText = `position:fixed;left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px;pointer-events:auto;`;
      shadow.prepend(shield);
    }
    function on(type, fn) {
      s.events.push([type, fn]);
      window.addEventListener(type, fn, true);
    }
    function move(e) {
      if (s.busy) return;
      s.x = Math.min(innerWidth - 1, Math.max(0, e.clientX));
      s.y = Math.min(innerHeight - 1, Math.max(0, e.clientY));
      s.cross.style.left = s.x - 6 + 'px';
      s.cross.style.top = s.y - 6 + 'px';
      draw(s);
    }
    on('pointermove', move);
    on('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      move(e);
      s.start = { x: s.x, y: s.y };
    });
    on('pointerup', (e) => {
      if (e.button !== 0 || !s.start) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      move(e);
      if (message.mode === 'area' && (!s.region || s.region.width < 2 || s.region.height < 2)) {
        s.info.textContent = fa
          ? 'برای انتخاب ناحیه، کلیک و درگ کنید.'
          : 'Click and drag to select an area.';
        s.start = null;
        return;
      }
      commit(s, s.region && s.region.width > 2 && s.region.height > 2 ? s.region : null);
    });
    on('click', (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    });
    on('keydown', (e) => {
      if (
        ![
          'Escape',
          'Enter',
          ' ',
          'ArrowLeft',
          'ArrowRight',
          'ArrowUp',
          'ArrowDown',
          '+',
          '-',
          '=',
        ].includes(e.key)
      )
        return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === 'Escape') return finish();
      if (s.busy) return;
      if (e.key === 'Enter') return commit(s);
      if (e.key === ' ') {
        s.busy = true;
        refresh(s)
          .then(() => draw(s))
          .catch((err) => (s.info.textContent = err.message))
          .finally(() => (s.busy = false));
        return;
      }
      const step = e.shiftKey ? 10 : 1;
      if (e.key.startsWith('Arrow')) {
        s.x = Math.max(
          0,
          Math.min(
            innerWidth - 1,
            s.x + (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0),
          ),
        );
        s.y = Math.max(
          0,
          Math.min(
            innerHeight - 1,
            s.y + (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0),
          ),
        );
      } else {
        const sizes = [1, 3, 5, 11, 25];
        s.size = sizes[Math.max(0, Math.min(4, sizes.indexOf(s.size) + (e.key === '-' ? -1 : 1)))];
      }
      draw(s);
    });
    on('scroll', () => {
      finish();
      notify(
        fa ? 'صفحه جابه‌جا شد؛ دوباره نمونه‌گیری کنید.' : 'Page moved. Start the picker again.',
        fa,
      );
    });
    on('resize', () => {
      finish();
      notify(
        fa
          ? 'اندازهٔ صفحه تغییر کرد؛ دوباره انتخاب کنید.'
          : 'Viewport changed. Start the picker again.',
        fa,
      );
    });
    draw(s);
    return {};
  }
  api.runtime.onMessage.addListener((message, sender, respond) => {
    if (!message.type?.startsWith('UIA_')) return;
    if (message.type === 'UIA_HIDE') {
      finish();
      respond({ ok: true });
      return;
    }
    const run = async () => {
      if (message.type === 'UIA_START') return start(message);
      if (message.type === 'UIA_RESAMPLE') {
        const last = message.last;
        if (
          Math.abs(last.viewport.width - innerWidth) > 1 ||
          Math.abs(last.viewport.height - innerHeight) > 1 ||
          Math.abs(last.scrollX - scrollX) > 1 ||
          Math.abs(last.scrollY - scrollY) > 1
        )
          throw new Error(
            'Restore the original scroll position, window size and zoom before resampling.',
          );
        const image = await loadImage(message.image),
          s = { ...image, x: last.x * innerWidth, y: last.y * innerHeight, size: last.size };
        const r = last.region
          ? {
              x: last.region.x * innerWidth,
              y: last.region.y * innerHeight,
              width: last.region.width * innerWidth,
              height: last.region.height * innerHeight,
            }
          : null;
        const value = area(s, s.x, s.y, r);
        const result = await send({ type: 'PICKED', color: value, location: last });
        notify(
          result.copyError || `${value} · ${message.settings.autoCopy ? 'Copied' : 'Saved'}`,
          message.settings.language === 'fa',
        );
        return { color: result.color };
      }
    };
    run()
      .then((result) => respond({ ok: true, ...result }))
      .catch((e) => {
        finish();
        respond({ ok: false, error: e.message });
      });
    return true;
  });
})();
