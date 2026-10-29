import { api } from './browser.js';
export function initFrontendTools({ send, toast, download, activate, getLanguage }) {
  const translations = new Map(),
    labels = [];
  const fa = () => getLanguage() === 'fa',
    t = (en, ps) => {
      const pair = { en, ps };
      translations.set(en, pair);
      translations.set(ps, pair);
      return fa() ? ps : en;
    };
  const create = (tag, text, parent) => {
    const e = document.createElement(tag);
    if (text !== undefined) {
      const node = document.createTextNode(text);
      e.append(node);
      const pair = translations.get(text);
      if (pair) labels.push({ node, pair });
    }
    parent?.append(e);
    return e;
  };
  const nav = create('button', undefined, document.querySelector('nav'));
  nav.className = 'nav-item';
  nav.dataset.view = 'frontend';
  const title = create('span', t('Frontend tools', 'ابزارهای فرانت‌اند'), nav);
  const section = create('section', undefined, document.querySelector('main'));
  section.className = 'view';
  section.id = 'view-frontend';
  section.hidden = true;
  nav.onclick = () => {
    document.querySelectorAll('.view').forEach((e) => (e.hidden = e !== section));
    document.querySelectorAll('.nav-item').forEach((e) => e.classList.toggle('active', e === nav));
    document.querySelector('#view-title').textContent = t('Frontend tools', 'ابزارهای فرانت‌اند');
  };
  const intro = create(
    'p',
    t(
      'Inspect, measure and refine the page. Changes stay in this tab.',
      'بررسی، اندازه‌گیری و اصلاح صفحه؛ تغییرات فقط در همین تب هستند.',
    ),
    section,
  );
  intro.className = 'hint';
  const grid = create('div', undefined, section);
  grid.className = 'frontend-grid';
  let result = null,
    busy = false;
  const buttons = [];
  async function run(action, options = {}, focus = false) {
    if (busy) return;
    busy = true;
    buttons.forEach((b) => (b.disabled = true));
    status.textContent = t('Working…', 'در حال بررسی…');
    try {
      if (focus) await activate();
      const response = await send({
        type: 'FRONTEND_TOOL',
        action,
        options: { ...options, language: getLanguage() },
      });
      if (response.kind) {
        result = response;
        render();
      }
      status.textContent = response.started
        ? t(
            'Select on the page; results appear here.',
            'روی صفحه انتخاب کنید؛ نتیجه اینجا نمایش داده می‌شود.',
          )
        : t('Done', 'انجام شد');
      if (focus && !document.body.classList.contains('workspace')) window.close();
      return response;
    } catch (e) {
      status.textContent = e.message;
      toast(e.message);
    } finally {
      busy = false;
      buttons.forEach((b) => (b.disabled = false));
    }
  }
  const tools = [
    [
      'inspect',
      'Element inspector',
      'بازرسی عنصر',
      'Dimensions, box model and copyable CSS',
      'ابعاد، مدل جعبه و کپی CSS',
    ],
    [
      'typography',
      'Typography',
      'تایپوگرافی',
      'Font family, size, weight and rhythm',
      'خانواده، اندازه، وزن و فاصله‌های متن',
    ],
    [
      'measure',
      'Spacing ruler',
      'خط‌کش فاصله',
      'Select two elements to measure their gaps',
      'انتخاب دو عنصر برای اندازه‌گیری فاصله',
    ],
    [
      'layout',
      'Layout audit',
      'بررسی چیدمان',
      'Find overflow and clipped content',
      'شناسایی بیرون‌زدگی و محتوای بریده',
    ],
    [
      'accessibility',
      'Contrast audit',
      'بررسی کنتراست',
      'Text contrast and suggested foreground colors',
      'کنتراست متن و پیشنهاد رنگ مناسب',
    ],
    [
      'tokens',
      'Design tokens',
      'توکن‌های طراحی',
      'Extract CSS variables and JSON',
      'استخراج متغیرهای CSS و JSON',
    ],
  ];
  for (const [action, en, ps, desc, pdesc] of tools) {
    const b = create('button', undefined, grid);
    b.className = 'frontend-card';
    create('strong', t(en, ps), b);
    create('small', t(desc, pdesc), b);
    b.onclick = () => run(action, {}, ['inspect', 'typography', 'measure'].includes(action));
    buttons.push(b);
    b.dataset.tool = action;
  }
  const heading = create('h2', t('Reference image', 'تصویر مرجع'), section);
  heading.className = 'section-heading';
  const image = create('input', undefined, section);
  image.type = 'file';
  image.accept = 'image/png,image/jpeg,image/webp';
  image.id = 'reference-file';
  const controls = create('div', undefined, section);
  controls.className = 'tool-controls';
  const fields = {};
  for (const [name, en, ps, value, min, max] of [
    ['opacity', 'Opacity', 'شفافیت', 50, 0, 100],
    ['x', 'X', 'X', 0, -8000, 8000],
    ['y', 'Y', 'Y', 0, -8000, 8000],
    ['width', 'Width', 'عرض', 1000, 20, 8000],
  ]) {
    const label = create('label', t(en, ps), controls),
      input = create('input', undefined, label);
    input.type = 'number';
    input.value = value;
    input.min = min;
    input.max = max;
    input.id = 'reference-' + name;
    fields[name] = input;
    input.onchange = () =>
      run('reference', { [name]: Number(input.value) / (name === 'opacity' ? 100 : 1) });
  }
  const dragLabel = create('label', t('Drag image on page', 'جابه‌جایی تصویر روی صفحه'), section),
    drag = create('input', undefined, dragLabel);
  drag.type = 'checkbox';
  drag.onchange = () => run('reference', { drag: drag.checked }, drag.checked);
  image.onchange = async () => {
    try {
      const file = image.files[0];
      if (!file) return;
      if (file.size > 12 * 1024 * 1024)
        throw Error(
          t('Use an image smaller than 12 MB.', 'از تصویر کوچک‌تر از ۱۲ مگابایت استفاده کنید.'),
        );
      const bitmap = await createImageBitmap(file),
        canvas = document.createElement('canvas'),
        scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      await run('reference', {
        image: canvas.toDataURL('image/png'),
        opacity: Number(fields.opacity.value) / 100,
        x: Number(fields.x.value),
        y: Number(fields.y.value),
        width: Number(fields.width.value),
      });
    } catch (e) {
      toast(e.message);
    } finally {
      image.value = '';
    }
  };
  const dirHeading = create('h2', t('Direction preview', 'پیش‌نمایش جهت صفحه'), section);
  dirHeading.className = 'section-heading';
  const actions = create('div', undefined, section);
  actions.className = 'tool-controls';
  for (const direction of ['rtl', 'ltr']) {
    const b = create('button', direction.toUpperCase(), actions);
    b.className = 'secondary';
    b.onclick = async () => {
      await run('direction', { direction });
      await run('layout');
    };
  }
  const restore = create('button', t('Restore page', 'بازگردانی صفحه'), actions);
  restore.className = 'secondary';
  restore.id = 'restore-page';
  restore.onclick = () => run('restore');
  const status = create('p', '', section);
  status.className = 'hint';
  status.role = 'status';
  const output = create('div', undefined, section);
  output.id = 'frontend-result';
  const manual = create(
    'p',
    t(
      'Contrast: flat computed backgrounds only. Image/gradient/opacity cases are flagged for manual review. Font families are computed CSS, not verified font-file usage.',
      'کنتراست روی پس‌زمینهٔ ساده محاسبه می‌شود؛ تصویر، گرادیان و شفافیت نیازمند بررسی دستی‌اند. خانوادهٔ فونت از CSS است و تأیید فایل فونتِ رندرشده نیست.',
    ),
    section,
  );
  manual.className = 'hint';
  function button(label, fn, parent = output) {
    const b = create('button', label, parent);
    b.className = 'secondary small';
    b.onclick = async () => {
      try {
        await fn();
      } catch (e) {
        toast(e.message);
      }
    };
    return b;
  }
  function tokenCSS(tokens) {
    return (
      ':root {\n' +
      Object.entries(tokens)
        .flatMap(([group, values]) =>
          values.map(
            (item, i) =>
              `  --${group.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}-${i + 1}: ${item.value};`,
          ),
        )
        .join('\n') +
      '\n}'
    );
  }
  function render() {
    output.replaceChildren();
    if (!result) return;
    if (result.kind === 'measure') {
      create('h2', t('Measured distances', 'فاصله‌های اندازه‌گیری‌شده'), output);
      create(
        'pre',
        `${result.first.label} → ${result.second.label}\n↔ ${result.horizontalGap.toFixed(1)}px · ↕ ${result.verticalGap.toFixed(1)}px\nΔx ${result.deltaX.toFixed(1)} · Δy ${result.deltaY.toFixed(1)}`,
        output,
      );
      return;
    }
    if (['inspect', 'typography'].includes(result.kind)) {
      create('h2', result.label, output);
      const css = result.kind === 'typography' ? result.typography : `.element {\n${result.css}\n}`;
      create('pre', css, output);
      button(t('Copy CSS', 'کپی CSS'), () => send({ type: 'COPY', text: css }));
      return;
    }
    create(
      'p',
      `${result.inspected} ${t('elements scanned', 'عنصر بررسی شد')}${result.truncated ? ' · ' + t('10,000 element limit reached', 'سقف ۱۰٬۰۰۰ عنصر') : ''}`,
      output,
    );
    if (result.tokens) {
      const css = tokenCSS(result.tokens);
      button('CSS', () => download('uiassistant-tokens.css', css, 'text/css'));
      button('JSON', () =>
        download('uiassistant-tokens.json', JSON.stringify(result.tokens, null, 2)),
      );
      button(t('Copy variables', 'کپی متغیرها'), () => send({ type: 'COPY', text: css }));
      for (const [key, values] of Object.entries(result.tokens)) {
        create('h2', key + ' · ' + values.length, output);
        create('pre', values.map((v) => `${v.value}  ×${v.count}`).join('\n'), output);
      }
      return;
    }
    create('h2', `${result.totalIssues} ${t('findings', 'مورد')}`, output);
    if (!result.issues.length)
      create('p', t('No issues found by these checks.', 'این بررسی‌ها موردی پیدا نکردند.'), output);
    for (const issue of result.issues) {
      const row = create('div', undefined, output);
      row.className = 'tool-issue';
      create('strong', issue.label, row);
      create('small', issue.type, row);
      create('p', issue.detail, row);
      button(t('Locate', 'نمایش عنصر'), () => run('highlight', { id: issue.id }, true), row);
      if (issue.suggestion)
        button(
          t('Copy suggested color', 'کپی رنگ پیشنهادی'),
          () => send({ type: 'COPY', text: issue.suggestion }),
          row,
        );
    }
  }
  api?.storage?.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.toolResult) {
      result = changes.toolResult.newValue;
      render();
    }
  });
  if (api?.storage)
    api.storage.local.get('toolResult').then((data) => {
      if (data.toolResult) {
        result = data.toolResult;
        render();
      }
    });
  new MutationObserver(() => {
    for (const { node, pair } of labels) if (node.isConnected) node.data = fa() ? pair.ps : pair.en;
    title.textContent = t('Frontend tools', 'ابزارهای فرانت‌اند');
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
}
