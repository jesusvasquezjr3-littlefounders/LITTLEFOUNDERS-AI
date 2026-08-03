import '@testing-library/jest-dom/vitest'
import '@/i18n'

window.scrollTo = () => {}

window.HTMLElement.prototype.scrollIntoView = () => {}

class IntersectionObserverMock {
  observe = () => {}
  unobserve = () => {}
  disconnect = () => {}
  root = null
  rootMargin = ''
  thresholds = []
  takeRecords = () => []
}
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: IntersectionObserverMock,
})
Object.defineProperty(global, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: IntersectionObserverMock,
})
