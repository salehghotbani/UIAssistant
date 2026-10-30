// Bounded RAM-only results: no screenshots in local/session storage or on disk.
export function createPreviewJobs({
  now = Date.now,
  random = () => crypto.randomUUID(),
  ttl = 300000,
  max = 2,
  onRemove = () => {},
} = {}) {
  const jobs = new Map();
  function remove(tabId) {
    const job = jobs.get(tabId);
    if (!job) return;
    jobs.delete(tabId);
    job.cancelled = true;
    job.image = null;
    clearTimeout(job.timer);
    job.port?.disconnect();
    onRemove(tabId);
  }
  function get(tabId) {
    const job = jobs.get(tabId);
    if (job && job.expires <= now()) {
      remove(tabId);
      return null;
    }
    return job || null;
  }
  return {
    create(identity) {
      remove(identity.tabId);
      for (const key of jobs.keys()) get(key);
      if (jobs.size >= max) {
        const oldest = [...jobs.values()].find((job) => job.status !== 'running');
        if (!oldest) throw Error('Finish an existing screenshot first.');
        remove(oldest.tabId);
      }
      const job = {
        ...identity,
        id: random(),
        holdToken: random(),
        status: 'running',
        expires: now() + ttl,
        image: null,
        cancelled: false,
      };
      job.timer = setTimeout(() => remove(identity.tabId), ttl);
      job.timer.unref?.();
      jobs.set(identity.tabId, job);
      return job;
    },
    get,
    remove,
    find(token) {
      return [...jobs.keys()].map(get).find((job) => job?.holdToken === token);
    },
    describe(tabId) {
      const job = get(tabId);
      return job
        ? {
            jobId: job.id,
            status: job.status,
            mode: job.mode,
            expires: job.expires,
            error: job.error || '',
            capturedAt: job.capturedAt,
          }
        : { status: 'idle' };
    },
    image(tabId, id) {
      const job = get(tabId);
      if (!job || job.id !== id || job.status !== 'ready' || !job.image)
        throw Error('Preview expired. Take another screenshot.');
      return { image: job.image, capturedAt: job.capturedAt };
    },
  };
}

// Internal, page-bound port carries only a random hold token, never pixels or commands.
// Chrome 114+ requires actual messages; Firefox event pages keep open ports alive.
export function holdPreview(options) {
  const api = globalThis.browser ?? globalThis.chrome;
  const port = api.runtime.connect({ name: 'uia-preview-hold' });
  let interval,
    timeout,
    notice,
    noticeTimer,
    shown = false;
  const stop = () => {
    clearInterval(interval);
    clearTimeout(timeout);
    clearTimeout(noticeTimer);
    notice?.remove();
    try {
      port.disconnect();
    } catch {}
  };
  const ping = () => {
    try {
      port.postMessage({ token: options.token });
    } catch {
      stop();
    }
  };
  port.onDisconnect.addListener(stop);
  port.onMessage.addListener((message) => {
    if (message.close) {
      stop();
      return;
    }
    if (message.status === 'ready' && !shown) {
      shown = true;
      notice = document.createElement('div');
      notice.dataset.uiassistantTool = '';
      notice.dataset.uiaPreviewNotice = '';
      notice.style.cssText =
        'all:initial;position:fixed;bottom:16px;right:16px;z-index:2147483647;pointer-events:none;';
      const shadow = notice.attachShadow({ mode: 'closed' }),
        text = document.createElement('div');
      text.textContent =
        options.language === 'fa'
          ? 'عکس آماده است؛ آیکون UIAssistant را باز کنید.'
          : 'Screenshot ready. Open the UIAssistant toolbar icon.';
      text.style.cssText =
        'padding:12px 16px;border-radius:9px;background:#292136;color:white;font:13px/1.7 system-ui;border:1px solid #aa8add;';
      shadow.append(text);
      document.documentElement.append(notice);
      noticeTimer = setTimeout(() => notice?.remove(), 6000);
    }
  });
  interval = setInterval(ping, 15000);
  timeout = setTimeout(stop, Math.max(1, options.expires - Date.now()));
  ping();
}
