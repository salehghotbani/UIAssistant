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
    'Capture the viewport, the whole scrolling page, or an area you draw with your mouse.',
    'از بخش نمایان، تمام طول صفحه، یا ناحیه‌ای که با ماوس مشخص می‌کنید عکس بگیرید.',
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
  ]) {
    const option = create('option', mode, en, fa);
    option.value = value;
  }
  const requested = new URL(location.href).searchParams.get('mode');
  if (['full', 'region'].includes(requested)) mode.value = requested;
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
  fixedLabel.hidden = mode.value !== 'full';
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
    'One operation, confirm within 30 seconds. Full page scrolls automatically and restores your position. For an area, drag on the page; Esc cancels. Temporary tool overlays are removed.',
    'یک عملیات، تأیید تا ۳۰ ثانیه. عکس کامل با اسکرول خودکار و بازگردانی موقعیت است. برای ناحیه، روی صفحه کادر بکشید؛ Esc لغو می‌کند. لایه‌های موقت ابزار حذف می‌شوند.',
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
    'Local only. No upload, automatic download or screenshot history. Full page: up to 64 tiles / 24 megapixels / 2 minutes; keep the tab active. Infinite or virtualized pages and nested scroll areas may need manual capture. This never captures the desktop.',
    'کاملاً محلی؛ بدون آپلود، دانلود خودکار یا تاریخچهٔ عکس. عکس کامل: حداکثر ۶۴ بخش، ۲۴ مگاپیکسل و ۲ دقیقه؛ تب را فعال نگه دارید. صفحات بی‌نهایت، مجازی و نواحی اسکرول داخلی ممکن است نیازمند ثبت دستی باشند. دسکتاپ ثبت نمی‌شود.',
  ).className = 'privacy-note screenshot-note';
  let ticket = null,
    pixels = null,
    busy = false,
    capturedAt = null,
    timer;
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
    if (busy) return;
    try {
      requireClick(event);
      busy = true;
      prepare.disabled = capture.disabled = true;
      mode.disabled = hideFixed.disabled = true;
      await fn();
    } catch (error) {
      status.textContent = error.message;
      toast(error.message);
    } finally {
      busy = false;
      prepare.disabled = capture.disabled = false;
      mode.disabled = hideFixed.disabled = false;
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
    pixels = null;
    image.removeAttribute('src');
    preview.hidden = exports.hidden = meta.hidden = true;
    meta.textContent = '';
    capturedAt = null;
  }
  mode.onchange = () => {
    discardTicket();
    fixedLabel.hidden = mode.value !== 'full';
  };
  hideFixed.onchange = discardTicket;
  prepare.onclick = (event) =>
    action(event, async () => {
      discardTicket();
      if (mode.value !== 'viewport' && !document.body.classList.contains('workspace')) {
        await send({ type: 'OPEN_WORKSPACE', view: 'screenshots', mode: mode.value });
        window.close();
        return;
      }
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
      let result;
      try {
        result = await send({ type: 'SCREENSHOT_CAPTURE', ticket: once });
      } finally {
        await reveal?.();
      }
      if (!/^data:image\/png;base64,/.test(result.image))
        throw Error('Invalid screenshot response.');
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
    });
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
      clearPreview();
      status.textContent = '';
    });
  document.addEventListener('uia:view', () => {
    if (section.hidden) discardTicket();
  });
  window.addEventListener('pagehide', () => {
    discardTicket();
    clearPreview();
  });
  new MutationObserver(() => {
    for (const { text, en, fa } of labels) text.data = t(en, fa);
    image.alt = t('Local screenshot preview', 'پیش‌نمایش محلی تصویر صفحه');
    status.textContent = '';
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
}
