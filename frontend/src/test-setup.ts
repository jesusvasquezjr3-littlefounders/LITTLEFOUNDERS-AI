import '@testing-library/jest-dom/vitest';
import '@/i18n';

// jsdom doesn't implement scrollTo — stub it so the scroll-to-top-on-route-change
// effect (MarketingLayout) doesn't spam "Not implemented" errors in test output.
window.scrollTo = () => {};

// jsdom doesn't implement scrollIntoView either — stub it so the course map's
// auto-scroll-to-current-lesson effect (routes/app/learn/CoursePage.tsx)
// doesn't spam "Not implemented" errors in test output.
window.HTMLElement.prototype.scrollIntoView = () => {};

// Mock IntersectionObserver for JSDOM
class IntersectionObserverMock {
  observe = () => {};
  unobserve = () => {};
  disconnect = () => {};
  root = null;
  rootMargin = '';
  thresholds = [];
  takeRecords = () => [];
}
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: IntersectionObserverMock,
});
Object.defineProperty(global, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: IntersectionObserverMock,
});
