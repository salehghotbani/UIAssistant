const rounded = (value) => String(Number(value.toFixed(6)));
function finite(value, name) {
  if (!Number.isFinite(value)) throw Error(`${name} must be a finite number.`);
}
export function convertUnits(value, root, from = 'px') {
  finite(value, 'Value');
  finite(root, 'Root size');
  if (root <= 0) throw Error('Root size must be greater than zero.');
  if (!['px', 'rem'].includes(from)) throw Error('Choose px or rem.');
  return from === 'px' ? value / root : value * root;
}
export function fluidSize({ minSize, maxSize, minViewport, maxViewport, root }) {
  for (const [key, value] of Object.entries({ minSize, maxSize, minViewport, maxViewport, root }))
    finite(value, key);
  if (
    minSize <= 0 ||
    maxSize < minSize ||
    minViewport < 0 ||
    maxViewport <= minViewport ||
    root <= 0
  )
    throw Error('Use positive sizes, max size ≥ min size and max viewport > min viewport.');
  const slope = (maxSize - minSize) / (maxViewport - minViewport);
  const intercept = (minSize - slope * minViewport) / root;
  return `clamp(${rounded(minSize / root)}rem, ${rounded(intercept)}rem + ${rounded(slope * 100)}vw, ${rounded(maxSize / root)}rem)`;
}
export function shadowCSS({ x, y, blur, spread, color, opacity, inset = false }) {
  for (const [key, value] of Object.entries({ x, y, blur, spread, opacity })) finite(value, key);
  if (blur < 0 || opacity < 0 || opacity > 100 || !/^#[\da-f]{6}$/i.test(color))
    throw Error('Use a valid color, nonnegative blur and opacity between 0 and 100.');
  const rgb = [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16));
  return `${inset ? 'inset ' : ''}${rounded(x)}px ${rounded(y)}px ${rounded(blur)}px ${rounded(spread)}px rgba(${rgb.join(', ')}, ${rounded(opacity / 100)})`;
}

export function gridCSS({ columns, minWidth, columnGap, rowGap, responsive = true }) {
  for (const [name, value] of Object.entries({ columns, minWidth, columnGap, rowGap }))
    finite(value, name);
  if (
    !Number.isInteger(columns) ||
    columns < 1 ||
    columns > 12 ||
    minWidth < 1 ||
    minWidth > 2000 ||
    columnGap < 0 ||
    columnGap > 200 ||
    rowGap < 0 ||
    rowGap > 200
  )
    throw Error('Use 1–12 columns, a positive minimum width and gaps between 0 and 200px.');
  // min(100%, …) prevents a single track from overflowing a narrow container.
  const tracks = responsive
    ? `repeat(auto-fit, minmax(min(100%, ${rounded(minWidth)}px), 1fr))`
    : `repeat(${columns}, minmax(0, 1fr))`;
  return `display: grid;\ngrid-template-columns: ${tracks};\ncolumn-gap: ${rounded(columnGap)}px;\nrow-gap: ${rounded(rowGap)}px;`;
}

export function radiusCSS({ topLeft, topRight, bottomRight, bottomLeft, unit = 'px' }) {
  const values = [topLeft, topRight, bottomRight, bottomLeft];
  if (!['px', '%'].includes(unit)) throw Error('Choose px or %.');
  for (const value of values) {
    finite(value, 'Radius');
    if (value < 0 || value > (unit === '%' ? 100 : 500))
      throw Error('Radius is outside the supported range.');
  }
  return `border-radius: ${values.map((value) => rounded(value) + unit).join(' ')};`;
}

export function easingCSS({ x1, y1, x2, y2 }) {
  for (const [name, value] of Object.entries({ x1, y1, x2, y2 })) finite(value, name);
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1 || Math.abs(y1) > 3 || Math.abs(y2) > 3)
    throw Error('X must be 0–1; Y must be −3–3.');
  return `cubic-bezier(${[x1, y1, x2, y2].map(rounded).join(', ')})`;
}
