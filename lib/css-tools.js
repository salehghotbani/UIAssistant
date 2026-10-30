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
