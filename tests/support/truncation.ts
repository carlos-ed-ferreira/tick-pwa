export function simulateClippedText(element: HTMLElement) {
  element.style.overflowX = 'hidden';
  Object.defineProperty(element, 'clientWidth', {
    configurable: true,
    value: 120,
  });
  Object.defineProperty(element, 'scrollWidth', {
    configurable: true,
    value: 320,
  });
}
