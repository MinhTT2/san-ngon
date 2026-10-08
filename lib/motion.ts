import { animate } from 'motion/mini';

export const motionEase = [0.16, 1, 0.3, 1] as const;

/** Temporary effects: restore styles on completion, interruption and preference change. */
export function playMotion(
  element: HTMLElement,
  keyframes: Parameters<typeof animate>[1],
  options: Parameters<typeof animate>[2] = {},
) {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (preference.matches || typeof element.animate !== 'function') return () => {};
  const properties = Object.keys(keyframes).map(key => key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`));
  const styles = properties.map(property => [property, element.style.getPropertyValue(property), element.style.getPropertyPriority(property)]);
  const animation = animate(element, keyframes, { duration: 0.48, ease: [...motionEase], ...options });
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    animation.cancel();
    styles.forEach(([property, value, priority]) => {
      if (value) element.style.setProperty(property, value, priority);
      else element.style.removeProperty(property);
    });
    preference.removeEventListener('change', reduce);
  };
  const reduce = () => { if (preference.matches) dispose(); };
  preference.addEventListener('change', reduce);
  void animation.then(dispose);
  return dispose;
}

export function enterMotion(element: HTMLElement, delay = 0, distance = 14) {
  // Opacity alone on containers with dialogs keeps fixed descendants anchored.
  const anchored = element.matches('form') || !!element.querySelector('dialog, [role="dialog"]');
  return playMotion(element, {
    opacity: [0, 1],
    ...(!anchored ? { translate: [`0 ${distance}px`, '0 0'] } : {}),
  }, { delay: Math.min(delay, 0.2) });
}
