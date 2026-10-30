import { createIcon } from './icons.js';
import { convertUnits, fluidSize, shadowCSS, gridCSS, radiusCSS, easingCSS } from './css-tools.js';

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
  const grid = card('Responsive Grid builder', 'ساخت Grid واکنش‌گرا', 'layout');
  const gridFields = element('div', grid);
  gridFields.className = 'workshop-fields';
  const gridInputs = {};
  for (const [key, en, fa, value, min, max] of [
    ['columns', 'Fixed columns', 'تعداد ستون ثابت', 3, 1, 12],
    ['minWidth', 'Minimum card width (px)', 'کمترین عرض کارت (px)', 160, 1, 2000],
    ['columnGap', 'Column gap (px)', 'فاصلهٔ ستون‌ها (px)', 16, 0, 200],
    ['rowGap', 'Row gap (px)', 'فاصلهٔ ردیف‌ها (px)', 16, 0, 200],
  ])
    gridInputs[key] = field(gridFields, 'grid-' + key, en, fa, value, {
      min,
      max,
      step: key === 'columns' ? 1 : 'any',
    });
  const autoLabel = element('label', gridFields);
  autoLabel.className = 'check-label';
  const responsive = element('input', autoLabel);
  responsive.type = 'checkbox';
  responsive.id = 'grid-responsive';
  responsive.checked = true;
  element('span', autoLabel, 'Auto-fit responsive columns', 'ستون‌های خودکار واکنش‌گرا');
  const gridOut = output(grid, 'grid-result');
  const gridPreview = element('div', grid);
  gridPreview.className = 'grid-preview';
  gridPreview.id = 'grid-preview';
  for (let i = 1; i <= 6; i++) element('div', gridPreview, String(i));
  const updateGrid = () => {
    gridInputs.columns.disabled = responsive.checked;
    gridInputs.minWidth.disabled = !responsive.checked;
    calculate(gridOut, Object.values(gridInputs), () => {
      const css = gridCSS({
        ...Object.fromEntries(
          Object.entries(gridInputs).map(([key, input]) => [key, numeric(input)]),
        ),
        responsive: responsive.checked,
      });
      gridPreview.style.cssText = css;
      return css;
    });
  };
  gridFields.addEventListener('input', updateGrid);
  element(
    'p',
    grid,
    'The preview uses this panel’s width. Auto-fit adapts to the destination container; fixed mode keeps the chosen number of columns.',
    'عرض پنل مبنای پیش‌نمایش است. حالت خودکار با ظرف مقصد سازگار می‌شود؛ حالت ثابت تعداد ستون انتخابی را نگه می‌دارد.',
  ).className = 'hint';

  const radius = card('Corner radius builder', 'تنظیم گردی گوشه‌ها', 'layout');
  const radiusFields = element('div', radius);
  radiusFields.className = 'workshop-fields';
  const radiusInputs = {};
  for (const [key, en, fa, value] of [
    ['topLeft', 'Top left', 'بالا چپ', 24],
    ['topRight', 'Top right', 'بالا راست', 8],
    ['bottomRight', 'Bottom right', 'پایین راست', 24],
    ['bottomLeft', 'Bottom left', 'پایین چپ', 8],
  ])
    radiusInputs[key] = field(radiusFields, 'radius-' + key, en, fa, value, { min: 0, max: 500 });
  const radiusLabel = element('label', radiusFields);
  element('span', radiusLabel, 'Unit', 'واحد');
  const radiusUnit = element('select', radiusLabel);
  radiusUnit.id = 'radius-unit';
  for (const unit of ['px', '%']) element('option', radiusUnit, unit).value = unit;
  const radiusPreview = element('div', radius);
  radiusPreview.className = 'radius-preview';
  const radiusTile = element('div', radiusPreview, 'UI', 'UI');
  radiusTile.id = 'radius-tile';
  const radiusOut = output(radius, 'radius-result');
  const updateRadius = () => {
    Object.values(radiusInputs).forEach(
      (input) => (input.max = radiusUnit.value === '%' ? 100 : 500),
    );
    calculate(radiusOut, Object.values(radiusInputs), () => {
      const css = radiusCSS({
        ...Object.fromEntries(
          Object.entries(radiusInputs).map(([key, input]) => [key, numeric(input)]),
        ),
        unit: radiusUnit.value,
      });
      radiusTile.style.cssText = css;
      return css;
    });
  };
  radiusFields.addEventListener('input', updateRadius);
  element(
    'p',
    radius,
    'Physical corners stay the same in RTL. Percentage radii depend on the destination element’s dimensions.',
    'گوشه‌های فیزیکی در RTL ثابت‌اند. درصد گردی به ابعاد عنصر مقصد بستگی دارد.',
  ).className = 'hint';

  const easing = card('Motion easing editor', 'ویرایش منحنی حرکت', 'refresh');
  const easingFields = element('div', easing);
  easingFields.className = 'workshop-fields';
  const easingInputs = {};
  for (const [key, value] of [
    ['x1', 0.25],
    ['y1', 0.1],
    ['x2', 0.25],
    ['y2', 1],
  ])
    easingInputs[key] = field(
      easingFields,
      'easing-' + key,
      key.toUpperCase(),
      key.toUpperCase(),
      value,
      { min: key[0] === 'x' ? 0 : -3, max: key[0] === 'x' ? 1 : 3 },
    );
  const easingOut = output(easing, 'easing-result');
  const easingTrack = element('div', easing);
  easingTrack.className = 'easing-track';
  const easingDot = element('div', easingTrack);
  easingDot.id = 'easing-dot';
  const motion = element('button', easing, 'Play preview', 'اجرای پیش‌نمایش');
  motion.className = 'secondary';
  motion.id = 'easing-play';
  motion.dataset.icon = 'refresh';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let animation;
  const updateEasing = () => {
    animation?.cancel();
    calculate(
      easingOut,
      Object.values(easingInputs),
      () =>
        `transition-timing-function: ${easingCSS(Object.fromEntries(Object.entries(easingInputs).map(([key, input]) => [key, numeric(input)])))};`,
    );
    motion.disabled = easingOut.button.disabled || reducedMotion.matches;
  };
  easingFields.addEventListener('input', updateEasing);
  motion.onclick = () => {
    animation?.cancel();
    if (reducedMotion.matches || easingOut.button.disabled) return;
    const distance = Math.max(0, easingTrack.clientWidth - easingDot.offsetWidth - 24);
    animation = easingDot.animate(
      [{ transform: 'translateX(0)' }, { transform: `translateX(${distance}px)` }],
      {
        duration: 1200,
        easing: easingCSS(
          Object.fromEntries(
            Object.entries(easingInputs).map(([key, input]) => [key, numeric(input)]),
          ),
        ),
        fill: 'forwards',
      },
    );
  };
  reducedMotion.addEventListener('change', updateEasing);
  document.addEventListener('uia:view', () => {
    if (section.hidden) animation?.cancel();
  });
  element(
    'p',
    easing,
    'X: 0–1. Y: −3–3 allows overshoot. Preview plays only on request and is disabled when reduced motion is enabled.',
    'X بین ۰ و ۱؛ Y بین ۳− و ۳ برای حرکت فراتر از مقصد. پیش‌نمایش فقط با درخواست اجرا می‌شود و با تنظیم کاهش حرکت غیرفعال است.',
  ).className = 'hint';
  updateGrid();
  updateRadius();
  updateEasing();
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
    updateGrid();
    updateRadius();
    updateEasing();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
}
