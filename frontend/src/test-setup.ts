import '@testing-library/jest-dom/vitest'
import { afterAll } from 'vitest'
import i18n from '@/i18n'

/*
 * EVERY MISSING TRANSLATION KEY THE SUITE TOUCHES IS A FAILURE.
 *
 * `npm run i18n:check` can only verify keys it can read statically, and it
 * says so in its own output. This application has ~170 `t()` calls whose key
 * is assembled from a template literal at runtime, and not one of them is
 * checkable that way — which is how `admin.analytics.web.visitorsInRange`
 * reached production and rendered its own key, as literal text, across the top
 * of the web-analytics chart. All four metrics on that chart did it. Every
 * gate was green the whole time.
 *
 * The tests are the one place the interpolated value is REAL, so this is the
 * only place a dynamic key can be resolved at all. i18next reports each miss
 * once; the run fails at the END with the whole list, so a single pass tells
 * you everything to add rather than one key per re-run.
 *
 * Reported in `afterAll` rather than per-test on purpose: a component that
 * renders a missing key is usually asserting something else entirely, and
 * failing THAT test would send the next reader to the wrong file.
 */
const missingKeys = new Set<string>()

i18n.on('missingKey', (_lngs, namespace, key) => {
  const scope = namespace && namespace !== 'translation' ? `${namespace}:` : ''
  missingKeys.add(`${scope}${String(key)}`)
})

afterAll(() => {
  if (missingKeys.size === 0) return
  const list = [...missingKeys].sort().map((key) => `  - ${key}`)
  throw new Error(
    [
      `${missingKeys.size} translation key(s) were requested and do not exist in en-US.`,
      'A key that does not resolve renders as ITSELF, in the product, to a real user.',
      ...list,
    ].join('\n'),
  )
})

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
