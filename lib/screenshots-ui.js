import { createIcon } from './icons.js';

export function initScreenshots({
  navigate,
  send,
  activate,
  reveal,
  download,
  toast,
  getLanguage,
}) {
  const labels = [];
  const t = (en, fa) => (getLanguage() === 'fa' ? fa : en);
  function create(tag, parent, en, fa) {
    const el = document.createElement(tag);
    if (en !== undefined) {
      const text = document.createTextNode(t(en, fa ?? en));
      el.append(text);
      labels.push({ text, en, fa: fa ?? en });
    }
    parent?.append(el);
    return el;
  }
  const nav = create('button', document.querySelector('nav'));
  nav.className = 'nav-item';
  nav.dataset.view = 'screenshots';
  nav.append(createIcon('camera'));
  create('span', nav, 'Screenshots', 'عکس از صفحه');
  create('kbd', nav, '08');
  nav.onclick = () => navigate('screenshots');
  const section = create('section', document.querySelector('main'));
  section.id = 'view-screenshots';
  section.className = 'view';
  section.hidden = true;
  create(
    'p',
    section,
    'Capture the viewport, whole page, a mouse-drawn region, or a complete scrollable panel.',
    'از بخش نمایان، تمام صفحه، ناحیهٔ انتخابی یا تمام محتوای پنل اسکرول‌دار عکس بگیرید.',
  ).className = 'hint view-intro';
  const panel = create('div', section);
  panel.className = 'tool-panel';
  const modeLabel = create('label', panel, 'Capture mode', 'نوع عکس');
  modeLabel.className = 'screenshot-mode';
  const mode = create('select', modeLabel);
  mode.id = 'screenshot-mode';
  for (const [value, en, fa] of [
    ['viewport', 'Visible area', 'بخش نمایان'],
    ['full', 'Full page · auto-scroll', 'تمام صفحه · اسکرول خودکار'],
    ['region', 'Select area with mouse', 'انتخاب ناحیه با ماوس'],
    ['container', 'Scrollable element · click to choose', 'ناحیهٔ اسکرول‌دار · انتخاب با کلیک'],
  ]) {
    const option = create('option', mode, en, fa);
    option.value = value;
  }
  const requested = new URL(location.href).searchParams.get('mode');
  if (['full', 'region', 'container'].includes(requested)) mode.value = requested;
  const fixedLabel = create('label', panel);
  fixedLabel.className = 'check-label';
  const hideFixed = create('input', fixedLabel);
  hideFixed.type = 'checkbox';
  hideFixed.checked = true;
  hideFixed.id = 'screenshot-hide-fixed';
  create(
    'span',
    fixedLabel,
    'Show fixed/sticky elements only on their first captured tile',
    'نمایش عناصر fixed/sticky فقط در اولین بخش ثبت‌شدهٔ آن‌ها',
  );
  fixedLabel.hidden = !['full', 'container'].includes(mode.value);
  const actions = create('div', panel);
  actions.className = 'tool-controls';
  function button(parent, id, en, fa, icon, cls = 'secondary') {
    const b = create('button', parent, en, fa);
    b.id = id;
    b.className = cls;
    b.dataset.icon = icon;
    b.prepend(createIcon(icon));
    return b;
  }
  const prepare = button(
    actions,
    'screenshot-prepare',
    'Choose target page',
    'انتخاب صفحهٔ هدف',
    'camera',
    'primary',
  );
  const consent = create('div', panel);
  consent.className = 'screenshot-consent';
  consent.hidden = true;
  create('strong', consent, 'Confirm the page below', 'صفحهٔ زیر را تأیید کنید');
  const target = create('p', consent);
  target.id = 'screenshot-target';
  create(
    'p',
    consent,
    'Confirm within 30 seconds. Full page scrolls automatically. For an area, drag; for a scrollable panel, click it (Alt selects its parent). Esc cancels. Scroll positions and temporary styles are restored.',
    'تأیید تا ۳۰ ثانیه. عکس کامل خودکار اسکرول می‌کند. برای ناحیه کادر بکشید و برای پنل اسکرول‌دار روی آن کلیک کنید (Alt: والد). Esc لغو می‌کند؛ اسکرول و استایل موقت بازگردانی می‌شوند.',
  ).className = 'hint';
  const consentActions = create('div', consent);
  consentActions.className = 'tool-controls';
  const capture = button(
    consentActions,
    'screenshot-capture',
    'Start capture',
    'شروع گرفتن عکس',
    'camera',
    'primary',
  );
  const cancel = button(consentActions, 'screenshot-cancel', 'Cancel', 'لغو', 'close');
  const status = create('p', panel);
  status.role = 'status';
  status.className = 'hint';
  status.id = 'screenshot-status';
  const cancelRunning = button(
    actions,
    'screenshot-stop',
    'Cancel capture',
    'لغو ثبت تصویر',
    'close',
  );
  cancelRunning.hidden = true;
  const preview = create('div', section);
  preview.className = 'screenshot-preview';
  preview.hidden = true;
  const image = create('img', preview);
  image.id = 'screenshot-image';
  image.alt = t('Local screenshot preview', 'پیش‌نمایش محلی تصویر صفحه');
  const meta = create('p', section);
  meta.id = 'screenshot-meta';
  meta.className = 'hint';
  meta.hidden = true;
  const exports = create('div', section);
  exports.className = 'tool-controls';
  exports.hidden = true;
  const png = button(exports, 'screenshot-save-png', 'Save PNG', 'ذخیرهٔ PNG', 'import');
  const jpeg = button(exports, 'screenshot-save-jpeg', 'Save JPEG', 'ذخیرهٔ JPEG', 'import');
  const clear = button(exports, 'screenshot-clear', 'Delete preview', 'حذف پیش‌نمایش', 'trash');
  preview.before(meta, exports);
  create(
    'p',
    section,
    'No new tab is needed. If the browser closes this popup while selecting, reopen the toolbar icon: your result stays in RAM for up to 5 minutes while the source page stays open. No upload or screenshot history. Limits: 64 tiles, 24 megapixels, 2 minutes. Virtualized content may require manual capture.',
    'تب جدا لازم نیست. اگر مرورگر هنگام انتخاب این پنجره را بست، آیکون افزونه را دوباره باز کنید؛ نتیجه تا ۵ دقیقه و تا بازبودن صفحهٔ اصلی فقط در حافظه می‌ماند. بدون آپلود یا تاریخچهٔ عکس. سقف: ۶۴ بخش، ۲۴ مگاپیکسل و ۲ دقیقه. محتوای مجازی ممکن است ثبت دستی بخواهد.',
  ).className = 'privacy-note screenshot-note';
  let ticket = null,
    pixels = null,
    busy = false,
    capturedAt = null,
    timer,
    pollTimer,
    expiryTimer,
    jobId = null,
    loadedJob = null,
    running = false;
  function controls() {
    prepare.disabled = capture.disabled = mode.disabled = hideFixed.disabled = busy || running;
    cancelRunning.hidden = !running;
  }
  function requireClick(event) {
    if (!event.isTrusted || !navigator.userActivation?.isActive)
      throw Error(
        t(
          'Use a real click or keyboard activation in UIAssistant.',
          'از کلیک واقعی یا صفحه‌کلید در UIAssistant استفاده کنید.',
        ),
      );
  }
  async function action(event, fn) {
    if (busy || running) return;
    try {
      requireClick(event);
      busy = true;
      controls();
      await fn();
    } catch (error) {
      status.textContent = error.message;
      toast(error.message);
    } finally {
      busy = false;
      controls();
    }
  }
  function discardTicket() {
    clearTimeout(timer);
    const old = ticket;
    ticket = null;
    consent.hidden = true;
    if (old) send({ type: 'SCREENSHOT_CANCEL', ticket: old }).catch(() => {});
  }
  function clearPreview() {
    clearTimeout(expiryTimer);
    loadedJob = null;
    pixels = null;
    image.removeAttribute('src');
    preview.hidden = exports.hidden = meta.hidden = true;
    meta.textContent = '';
    capturedAt = null;
  }
  mode.onchange = () => {
    discardTicket();
    fixedLabel.hidden = !['full', 'container'].includes(mode.value);
  };
  hideFixed.onchange = discardTicket;
  prepare.onclick = (event) =>
    action(event, async () => {
      discardTicket();
      const result = await send({
        type: 'SCREENSHOT_PREPARE',
        mode: mode.value,
        hideFixed: hideFixed.checked,
        language: getLanguage(),
      });
      ticket = result.ticket;
      target.textContent = (result.title || '') + '\n' + result.url;
      consent.hidden = false;
      status.textContent = '';
      timer = setTimeout(() => {
        discardTicket();
        status.textContent = t(
          'Confirmation expired. Choose the target page again.',
          'مهلت تأیید تمام شد؛ صفحهٔ هدف را دوباره انتخاب کنید.',
        );
      }, 30000);
    });
  cancel.onclick = (event) =>
    action(event, async () => {
      discardTicket();
      status.textContent = '';
    });
  capture.onclick = (event) =>
    action(event, async () => {
      if (!ticket)
        throw Error(t('Choose the target page first.', 'ابتدا صفحهٔ هدف را انتخاب کنید.'));
      const once = ticket;
      ticket = null;
      clearTimeout(timer);
      consent.hidden = true;
      clearPreview();
      status.textContent = t('Capturing…', 'در حال گرفتن عکس…');
      await activate();
      const started = await send({ type: 'SCREENSHOT_START', ticket: once });
      jobId = started.jobId;
      running = true;
      controls();
      await refresh();
    });
  async function showImage(result) {
    if (!/^data:image\/png;base64,/.test(result.image)) throw Error('Invalid screenshot response.');
    image.src = result.image;
    await image.decode();
    pixels = result.image;
    capturedAt = result.capturedAt;
    meta.textContent = `${image.naturalWidth} × ${image.naturalHeight} px`;
    meta.hidden = exports.hidden = preview.hidden = false;
    status.textContent = t(
      'Ready. Review the image before saving.',
      'آماده است؛ پیش از ذخیره تصویر را بررسی کنید.',
    );
  }
  async function refresh(restore = false) {
    clearTimeout(pollTimer);
    try {
      const job = await send({ type: 'SCREENSHOT_STATUS' });
      const wasRunning = running;
      running = job.status === 'running';
      if (job.status === 'idle') {
        if (wasRunning || loadedJob) clearPreview();
        if (wasRunning)
          status.textContent = t(
            'Capture ended. Choose the page again.',
            'عملیات پایان یافت؛ صفحه را دوباره انتخاب کنید.',
          );
        jobId = null;
        running = false;
        controls();
        return;
      }
      jobId = job.jobId;
      if (restore) {
        mode.value = job.mode;
        fixedLabel.hidden = !['full', 'container'].includes(job.mode);
        navigate('screenshots');
      }
      if (running) {
        status.textContent = t(
          'Capturing… Reopen this popup if it closes.',
          'در حال ثبت… اگر این پنجره بسته شد دوباره بازش کنید.',
        );
        pollTimer = setTimeout(() => refresh(), 600);
      } else if (job.status === 'error') {
        status.textContent = job.error;
      } else if (job.status === 'ready' && loadedJob !== jobId) {
        const result = await send({ type: 'SCREENSHOT_PREVIEW', jobId });
        await showImage(result);
        loadedJob = jobId;
        clearTimeout(expiryTimer);
        expiryTimer = setTimeout(
          () => {
            clearPreview();
            loadedJob = null;
            status.textContent = t(
              'Preview expired. Take another screenshot.',
              'مهلت پیش‌نمایش تمام شد؛ دوباره عکس بگیرید.',
            );
          },
          Math.max(1, job.expires - Date.now()),
        );
        await reveal?.();
      }
      controls();
    } catch (error) {
      running = false;
      controls();
      status.textContent = error.message;
    }
  }
  cancelRunning.onclick = async (event) => {
    try {
      requireClick(event);
      await send({ type: 'SCREENSHOT_DISCARD', jobId });
      running = false;
      jobId = null;
      clearPreview();
      controls();
      status.textContent = t('Screenshot cancelled.', 'ثبت تصویر لغو شد.');
    } catch (error) {
      toast(error.message);
    }
  };
  function pngBlob(data) {
    const bytes = Uint8Array.from(atob(data.split(',')[1]), (char) => char.charCodeAt(0));
    return new Blob([bytes], { type: 'image/png' });
  }
  png.onclick = (event) =>
    action(event, async () => {
      if (pixels) download(`uiassistant-${capturedAt}.png`, pngBlob(pixels), 'image/png');
    });
  jpeg.onclick = (event) =>
    action(event, async () => {
      if (!pixels) return;
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) throw Error('JPEG export failed.');
      download(`uiassistant-${capturedAt}.jpg`, blob, 'image/jpeg');
      canvas.width = canvas.height = 0;
    });
  clear.onclick = (event) =>
    action(event, async () => {
      await send({ type: 'SCREENSHOT_DISCARD', jobId });
      loadedJob = null;
      jobId = null;
      clearPreview();
      status.textContent = '';
    });
  document.addEventListener('uia:view', () => {
    if (section.hidden) discardTicket();
  });
  window.addEventListener('pagehide', () => {
    clearTimeout(pollTimer);
    clearTimeout(expiryTimer);
    discardTicket();
    clearPreview();
  });
  new MutationObserver(() => {
    for (const { text, en, fa } of labels) text.data = t(en, fa);
    image.alt = t('Local screenshot preview', 'پیش‌نمایش محلی تصویر صفحه');
    status.textContent = '';
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  return refresh(true);
}
