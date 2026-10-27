/**
 * Small DOM helpers. Text always goes in through textContent or text nodes,
 * never through innerHTML.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Creates an element.
 * @param {string} tag
 * @param {Record<string, unknown>} [props] element properties (className, type, ...);
 *   `dataset` and `attrs` take objects of data attributes and plain attributes
 * @param {(Node | string)[]} [children] strings become text nodes
 * @returns {HTMLElement}
 */
export function h(tag, props = {}, children = []) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (name === 'dataset') Object.assign(element.dataset, value);
    else if (name === 'attrs') Object.entries(value).forEach(([attr, v]) => element.setAttribute(attr, String(v)));
    else element[name] = value;
  }
  element.append(...children);
  return element;
}

/**
 * Creates a decorative line icon: a 24 x 24 SVG styled by the .icon class
 * and hidden from assistive technology.
 * @param {string[]} paths path data
 * @param {string} className extra class names
 * @returns {SVGSVGElement}
 */
export function icon(paths, className) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', `icon ${className}`);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of paths) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

/**
 * Sets an attribute only when its value changes (cheap to call on every render).
 * @param {Element} element
 * @param {string} name
 * @param {string} value
 */
export function setAttr(element, name, value) {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

/**
 * Sets the text of an element only when it changes.
 * @param {Element} element
 * @param {string} text
 */
export function setText(element, text) {
  if (element.textContent !== text) element.textContent = text;
}

/**
 * Sets aria-pressed on a toggle button.
 * @param {Element} element
 * @param {boolean} pressed
 */
export function setPressed(element, pressed) {
  setAttr(element, 'aria-pressed', String(pressed));
}

/**
 * Shows a value on a range input and paints its filled part (CSS variable --fill).
 * The value is left alone while it already matches, so dragging never jitters.
 * @param {HTMLInputElement} input
 * @param {number} value
 */
export function setRange(input, value) {
  if (input.valueAsNumber !== value) input.value = String(value);
  const min = Number(input.min);
  const percent = ((value - min) / (Number(input.max) - min)) * 100;
  input.style.setProperty('--fill', `${percent}%`);
}

/**
 * Re-translates the static markup: data-i18n sets the text, data-i18n-title
 * the tooltip and data-i18n-aria the accessible name.
 * @param {ParentNode} root
 * @param {(key: string) => string} t
 */
export function translateStatic(root, t) {
  root.querySelectorAll('[data-i18n]').forEach((element) => setText(element, t(element.dataset.i18n)));
  root.querySelectorAll('[data-i18n-title]').forEach((element) => setAttr(element, 'title', t(element.dataset.i18nTitle)));
  root.querySelectorAll('[data-i18n-aria]').forEach((element) => setAttr(element, 'aria-label', t(element.dataset.i18nAria)));
}
