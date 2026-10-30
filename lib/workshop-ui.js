import { createIcon } from './icons.js';
import { convertUnits, fluidSize, shadowCSS } from './css-tools.js';

export function initWorkshop({ navigate, copy, getLanguage }) {
  const labels = [];
  const text = (en, fa) => (getLanguage() === 'fa' ? fa : en);
  function element(tag, parent, en, fa) {
    const node = document.createElement(tag);
    if (en !== undefined) {
      const label = document.createTextNode(text(en, fa ?? en));
      node.append(label);
      labels.push({ label, en, fa: fa ?? en });
    }
    parent?.append(node);
    return node;
  }
  const nav = element('button', document.querySelector('nav'));
  nav.className = 'nav-item';
  nav.dataset.view = 'workshop';
  nav.append(createIcon('code'));
  element('span', nav, 'CSS workshop', 'کارگاه CSS');
  element('kbd', nav, '07');
  nav.onclick = () => navigate('workshop');
  const section = element('section', document.querySelector('main'));
  section.className = 'view';
  section.id = 'view-workshop';
  section.hidden = true;
  element(
    'p',
    section,
    'Small CSS tools, ready to paste into your project.',
    'ابزارهای کوچک CSS، آمادهٔ استفاده در پروژه.',
  ).className = 'hint view-intro';
  function card(en, fa, icon) {
    const card = element('article', section);
    card.className = 'workshop-card';
    const heading = element('h2', card);
    heading.append(createIcon(icon));
    element('span', heading, en, fa);
    return card;
  }
  function field(parent, id, en, fa, value, { type = 'number', min, max, step = 'any' } = {}) {
    const label = element('label', parent);
    element('span', label, en, fa);
    const input = element('input', label);
    input.id = id;
    input.type = type;
    input.value = value;
    if (type === 'number') input.step = step;
    if (min !== undefined) input.min = min;
    if (max !== undefined) input.max = max;
    return input;
  }
  function output(card, id) {
    const row = element('div', card);
    row.className = 'workshop-output';
    const code = element('code', row);
    code.id = id;
    const button = element('button', row, 'Copy CSS', 'کپی CSS');
    button.className = 'secondary small';
    button.dataset.icon = 'copy';
    button.onclick = () => copy(code.textContent);
    const error = element('p', card);
    error.className = 'field-error';
    error.setAttribute('role', 'status');
    error.hidden = true;
    return { code, button, error };
  }
  function calculate(out, inputs, fn) {
    try {
      if (inputs.some((input) => !input.checkValidity())) throw Error('Range');
      out.code.textContent = fn();
      out.button.disabled = false;
      out.error.hidden = true;
      inputs.forEach((input) => input.removeAttribute('aria-invalid'));
    } catch {
      out.code.textContent = '—';
      out.button.disabled = true;
      inputs.forEach((input) => input.setAttribute('aria-invalid', 'true'));
      out.error.textContent = text(
        'Check the values and ranges below each tool.',
        'مقادیر و بازه‌های مشخص‌شده برای ابزار را بررسی کنید.',
      );
      out.error.hidden = false;
    }
  }
  const numeric = (input) => (input.value === '' ? NaN : Number(input.value));
  const units = card('px ↔ rem converter', 'تبدیل px و rem', 'measure');
  const unitFields = element('div', units);
  unitFields.className = 'workshop-fields';
  const unitValue = field(unitFields, 'unit-value', 'Value', 'مقدار', 24);
  const unitRoot = field(unitFields, 'unit-root', 'Root size (px)', 'اندازهٔ ریشه (px)', 16, {
    min: 1,
  });
  const direction = element('label', unitFields);
  element('span', direction, 'Convert from', 'تبدیل از');
  const from = element('select', direction);
  from.id = 'unit-from';
  for (const unit of ['px', 'rem']) element('option', from, unit).value = unit;
  element(
    'p',
    units,
    'Set the root size to match your page’s computed html font size.',
    'اندازهٔ ریشه را مطابق font-size محاسبه‌شدهٔ html صفحه تنظیم کنید.',
  ).className = 'hint';
  const unitOut = output(units, 'unit-result');
  const updateUnit = () =>
    calculate(
      unitOut,
      [unitValue, unitRoot],
      () =>
        `${Number(convertUnits(numeric(unitValue), numeric(unitRoot), from.value).toFixed(6))}${from.value === 'px' ? 'rem' : 'px'}`,
    );
  [unitValue, unitRoot, from].forEach((el) => (el.oninput = updateUnit));

  const fluid = card('Fluid size generator', 'ساخت اندازهٔ واکنش‌گرا', 'typography');
  const fluidFields = element('div', fluid);
  fluidFields.className = 'workshop-fields';
  const fluidInputs = {};
  for (const [key, en, fa, value, min] of [
    ['minSize', 'Minimum size (px)', 'کمترین اندازه (px)', 16, 1],
    ['maxSize', 'Maximum size (px)', 'بیشترین اندازه (px)', 32, 1],
    ['minViewport', 'Start viewport (px)', 'عرض شروع (px)', 320, 0],
    ['maxViewport', 'End viewport (px)', 'عرض پایان (px)', 1280, 1],
    ['root', 'Root size (px)', 'اندازهٔ ریشه (px)', 16, 1],
  ])
    fluidInputs[key] = field(fluidFields, 'fluid-' + key, en, fa, value, {
      min,
      max: key.includes('Size') ? 256 : key === 'root' ? 128 : 10000,
    });
  element(
    'p',
    fluid,
    'Max size ≥ min size; end viewport > start viewport. Uses rem + vw. Check text at 200% zoom in your target page.',
    'بیشترین اندازه ≥ کمترین اندازه؛ عرض پایان > عرض شروع. خروجی rem + vw است. متن را در صفحهٔ مقصد با زوم ۲۰۰٪ بررسی کنید.',
  ).className = 'hint';
  const fluidOut = output(fluid, 'fluid-result');
  const fluidPreview = element(
    'div',
    fluid,
    'Type that grows with the viewport.',
    'متنی که همراه عرض صفحه تغییر می‌کند.',
  );
  fluidPreview.className = 'fluid-preview';
  const updateFluid = () =>
    calculate(fluidOut, Object.values(fluidInputs), () => {
      const value = fluidSize(
        Object.fromEntries(
          Object.entries(fluidInputs).map(([key, input]) => [key, numeric(input)]),
        ),
      );
      // The extension's root size can differ from the target; keep the preview explicit.
      fluidPreview.style.fontSize = numeric(fluidInputs.minSize) + 'px';
      return `font-size: ${value};`;
    });
  Object.values(fluidInputs).forEach((el) => (el.oninput = updateFluid));
  // Preview at a user-selected viewport without resizing or modifying the target page.
  const previewWidth = field(
    fluid,
    'fluid-preview-width',
    'Preview viewport (px)',
    'عرض پیش‌نمایش (px)',
    800,
    { min: 1, max: 10000 },
  );
  function paintFluid() {
    const a = numeric(fluidInputs.minSize),
      b = numeric(fluidInputs.maxSize);
    const lo = numeric(fluidInputs.minViewport),
      hi = numeric(fluidInputs.maxViewport);
    if (hi > lo && b >= a && a > 0 && Number.isFinite(numeric(previewWidth)))
      fluidPreview.style.fontSize =
        Math.max(a, Math.min(b, a + ((b - a) * (numeric(previewWidth) - lo)) / (hi - lo))) + 'px';
  }
  previewWidth.oninput = paintFluid;
  fluidFields.addEventListener('input', paintFluid);

  const shadow = card('Box shadow builder', 'ساخت سایهٔ جعبه', 'layout');
  const shadowFields = element('div', shadow);
  shadowFields.className = 'workshop-fields';
  const shadowInputs = {};
  for (const [key, en, fa, value, min, max] of [
    ['x', 'X offset (px)', 'فاصلهٔ افقی (px)', 0, -200, 200],
    ['y', 'Y offset (px)', 'فاصلهٔ عمودی (px)', 8, -200, 200],
    ['blur', 'Blur (px)', 'محو شدگی (px)', 24, 0, 200],
    ['spread', 'Spread (px)', 'گسترش (px)', 0, -200, 200],
    ['opacity', 'Opacity (%)', 'شفافیت (%)', 18, 0, 100],
  ])
    shadowInputs[key] = field(shadowFields, 'shadow-' + key, en, fa, value, { min, max });
  const shadowColor = field(shadowFields, 'shadow-color', 'Color', 'رنگ', '#302547', {
    type: 'color',
  });
  const insetLabel = element('label', shadowFields);
  insetLabel.className = 'check-label';
  const inset = element('input', insetLabel);
  inset.type = 'checkbox';
  inset.id = 'shadow-inset';
  element('span', insetLabel, 'Inset shadow', 'سایهٔ داخلی');
  const shadowPreview = element('div', shadow);
  shadowPreview.className = 'shadow-preview';
  const tile = element('div', shadowPreview, 'UI', 'UI');
  tile.id = 'shadow-tile';
  const shadowOut = output(shadow, 'shadow-result');
  const updateShadow = () =>
    calculate(shadowOut, Object.values(shadowInputs), () => {
      if (Object.values(shadowInputs).some((input) => !input.checkValidity())) throw Error('Range');
      const css = shadowCSS({
        ...Object.fromEntries(
          Object.entries(shadowInputs).map(([key, input]) => [key, numeric(input)]),
        ),
        color: shadowColor.value,
        inset: inset.checked,
      });
      tile.style.boxShadow = css;
      return `box-shadow: ${css};`;
    });
  shadowFields.addEventListener('input', updateShadow);
  updateUnit();
  updateFluid();
  paintFluid();
  updateShadow();
  new MutationObserver(() => {
    for (const { label, en, fa } of labels) label.data = text(en, fa);
    updateUnit();
    updateFluid();
    paintFluid();
    updateShadow();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
}
