import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'
import '@/i18n'

vi.mock('phaser', () => ({
  default: {
    AUTO: 2,
    Scale: { FIT: 'FIT', CENTER_BOTH: 'CENTER_BOTH' },
    Scene: class {},
    Game: class { events = { once: () => {}, on: () => {} }; destroy = () => {} },
    Geom: {
      Point: class { x = 0; y = 0 },
      Circle: class { radius = 0 },
      Rectangle: class {},
    },
    Math: { Interpolation: { Linear: (arr: number[], t: number) => (arr[0] ?? 0) + ((arr[1] ?? 0) - (arr[0] ?? 0)) * t } },
    Display: { Color: { HexStringToColor: () => ({}) } },
  },
}))

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
