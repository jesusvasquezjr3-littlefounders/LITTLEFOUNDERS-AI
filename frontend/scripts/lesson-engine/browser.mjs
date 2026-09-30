/*
 * A zero-dependency headless browser for driving the app like a person.
 *
 * Node 24 ships a WebSocket client and Chrome is already installed, so the
 * DevTools protocol needs nothing else. The Chrome discovery and the
 * DevToolsActivePort handshake follow `scripts/seo/render-cards.mjs` so the
 * repo has one convention rather than two.
 *
 * Two flags here are not optional and are worth the words:
 *
 *   --use-angle=swiftshader   without the software GL path, a headless Chrome
 *   --enable-unsafe-swiftshader   on a machine with no display hands the page a
 *                             context that never draws. The character layer
 *                             then renders nothing, which reads exactly like a
 *                             bug in the scene rather than a bug in the harness.
 *
 * Everything is driven with Input.dispatchMouseEvent and never element.click().
 * A synthetic click dispatches straight at the node; a real one asks the browser
 * what is TOPMOST at those coordinates. That difference is how a full-viewport
 * canvas shipped that swallowed every control in the Lesson Engine while four
 * kinds of audit stayed green (/AGENTS.md §1.14).
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean)

/** The first Chrome or Chromium on this machine (CHROME_PATH first), or null when there is none. */
export function findChrome() {
  return CHROME_CANDIDATES.find((path) => existsSync(path)) ?? null
}

function chromeBinary() {
  const found = findChrome()
  if (!found) {
    throw new Error(
      `No Chrome or Chromium found. Set CHROME_PATH to its executable.\nLooked in:\n  ${CHROME_CANDIDATES.join('\n  ')}`,
    )
  }
  return found
}

/** Launch headless Chrome and wait for it to publish the port it chose. */
export async function launchBrowser(userDataDir) {
  mkdirSync(userDataDir, { recursive: true })
  const child = spawn(
    chromeBinary(),
    [
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--mute-audio',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--force-device-scale-factor=1',
      /*
       * CI runners are the one place Chrome's sandbox cannot always start
       * (no user namespaces inside the container), and the failure is a
       * launch error rather than a test result — which reads as "the gate is
       * broken" instead of "the gate could not start". Dropped ONLY under CI:
       * a developer machine keeps the sandbox.
       */
      ...(process.env.CI ? ['--no-sandbox', '--disable-dev-shm-usage'] : []),
      `--user-data-dir=${userDataDir}`,
      '--remote-debugging-port=0',
      'about:blank',
    ],
    { stdio: 'ignore' },
  )

  const portFile = join(userDataDir, 'DevToolsActivePort')
  for (let attempt = 0; attempt < 150; attempt += 1) {
    await sleep(200)
    try {
      const port = Number(readFileSync(portFile, 'utf8').split('\n')[0])
      if (!port) continue
      const res = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (res.ok) return { child, browser: (await res.json()).webSocketDebuggerUrl }
    } catch {
      /* not up yet */
    }
  }
  child.kill()
  throw new Error('Chrome started but never opened its debugging port.')
}

/** One page, with its console and its failed requests recorded as they happen. */
class Page {
  constructor(socket, sessionId) {
    this.ws = socket
    this.sessionId = sessionId
    this.nextId = 1
    this.pending = new Map()
    this.errors = []
    this.failedRequests = []
    /** Why the DevTools connection ended (Chrome exited or crashed), or null while it is open. */
    this.closed = null
    /** Set when this page's renderer crashed (Inspector.targetCrashed): the page will never answer again. */
    this.crashed = false
    /** Set by openPage: the target and the isolated browser context (if any) that close() disposes of. */
    this.targetId = null
    this.contextId = null

    /*
     * A call Chrome will never answer must not wait forever. When the socket
     * closes (Chrome exited, crashed, or was killed by the machine), every
     * pending call is rejected and every later call fails at once. Without
     * this, a gate awaiting a call on a dead browser is left with nothing on
     * the event loop and Node ends it as "unsettled top-level await" (exit 13),
     * with no word about the browser that went away.
     */
    const end = (reason) => {
      if (this.closed) return
      this.closed = reason
      for (const waiter of this.pending.values()) waiter.reject(new Error(reason))
      this.pending.clear()
    }
    socket.addEventListener('close', (event) => end(`Chrome closed the DevTools connection (code ${event.code})`))
    socket.addEventListener('error', () => end('the DevTools connection to Chrome failed'))

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (message.id && this.pending.has(message.id)) {
        const waiter = this.pending.get(message.id)
        this.pending.delete(message.id)
        if (message.error) waiter.reject(new Error(message.error.message))
        else waiter.resolve(message.result)
        return
      }
      if (message.method === 'Inspector.targetCrashed') this.crashed = true
      if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
        this.errors.push((message.params.args ?? []).map((a) => a.value ?? a.description ?? '').join(' '))
      }
      if (message.method === 'Runtime.exceptionThrown') {
        this.errors.push(message.params.exceptionDetails?.text ?? 'exception')
      }
      if (message.method === 'Network.responseReceived') {
        const { url, status } = message.params.response
        // Analytics and Vite's own hot-update probes are not the product.
        if (status >= 400 && !/favicon|analytics|plausible|umami|hot-update/.test(url)) {
          this.failedRequests.push(`${status} ${url}`)
        }
      }
    })
  }

  send(method, params = {}) {
    return this.call(method, params, this.sessionId)
  }

  /** One DevTools call: to this page's session, or to the browser itself when `sessionId` is undefined (Target.*). */
  call(method, params, sessionId) {
    if (this.closed) return Promise.reject(new Error(this.closed))
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      try {
        this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
      } catch (error) {
        this.pending.delete(id)
        reject(error)
      }
    })
  }

  /** Closes the page's target and its isolated context (when it has one), then its DevTools connection. */
  async close() {
    if (!this.closed) {
      if (this.targetId) await this.call('Target.closeTarget', { targetId: this.targetId }).catch(() => {})
      if (this.contextId) await this.call('Target.disposeBrowserContext', { browserContextId: this.contextId }).catch(() => {})
    }
    try { this.ws.close() } catch { /* already closed */ }
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (res.exceptionDetails) {
      const detail = res.exceptionDetails
      throw new Error(`${detail.text}: ${detail.exception?.description ?? detail.exception?.value ?? ''}`)
    }
    return res.result.value
  }
}

/**
 * Open a page at a given viewport and theme. `newWindow` gives the page a window of
 * its own: a second tab in one window is hidden, and a hidden page gets no
 * animation frames and throttled timers, so a pool of pages must not share one.
 * `isolated` gives it a browser context of its own (like a separate profile): pages
 * of one origin otherwise share localStorage, so a pool of pages that each sign in
 * as someone else, or pick another language or mode, would overwrite each other.
 */
export async function openPage(browserUrl, { width, height, dark, newWindow = false, isolated = false }) {
  const socket = new WebSocket(browserUrl)
  await new Promise((ok, fail) => {
    socket.addEventListener('open', ok, { once: true })
    socket.addEventListener('error', () => fail(new Error('CDP socket failed to open')), { once: true })
  })

  const attach = (method, params) =>
    new Promise((resolve) => {
      const id = Math.floor(Math.random() * 1e6) + 1
      const onMessage = (event) => {
        const message = JSON.parse(event.data)
        if (message.id === id) {
          socket.removeEventListener('message', onMessage)
          resolve(message.result)
        }
      }
      socket.addEventListener('message', onMessage)
      socket.send(JSON.stringify({ id, method, params }))
    })

  const context = isolated ? await attach('Target.createBrowserContext', {}) : null
  const { targetId } = await attach('Target.createTarget', {
    url: 'about:blank',
    ...(newWindow ? { newWindow: true } : {}),
    ...(context?.browserContextId ? { browserContextId: context.browserContextId } : {}),
  })
  const { sessionId } = await attach('Target.attachToTarget', { targetId, flatten: true })

  const page = new Page(socket, sessionId)
  page.targetId = targetId
  page.contextId = context?.browserContextId ?? null
  // Inspector reports a crashed renderer (Inspector.targetCrashed), so a page that never becomes ready can say why.
  await page.send('Inspector.enable').catch(() => {})
  await page.send('Page.enable')
  await page.send('Runtime.enable')
  await page.send('Network.enable')
  await page.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 768,
  })
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }],
  })

  /*
   * SLOW THE MACHINE DOWN ON PURPOSE: `LESSON_LAB_CPU_THROTTLE=4`.
   *
   * A developer machine is not the machine this product runs on, and it is not
   * the machine CI runs on either — a GitHub runner is 2 vCPU with no GPU, and
   * a child's laptop is worse. The 3D characters carry a still stand-in for
   * exactly that, so "did a character fall back to its still?" is a question whose
   * answer depends on how fast the machine is, and a gate tuned on a 16-thread
   * workstation cannot see it.
   *
   * This makes that reproducible locally instead of only in CI, where each
   * observation costs a 25-minute round trip. Off by default: a throttled run
   * measures a different machine, so it belongs in an investigation, not in
   * the number the gate reports by default.
   *
   * All three browser gates import this helper — verify:lesson-engine,
   * verify:tutor-ui and verify:tutor-a11y — so the variable throttles any of
   * them despite the lesson-lab prefix its neighbours here use.
   */
  const throttle = Number(process.env.LESSON_LAB_CPU_THROTTLE ?? 0)
  if (throttle > 1) {
    await page.send('Emulation.setCPUThrottlingRate', { rate: throttle })
    console.log(`  [browser] CPU throttled ${throttle}x`)
  }

  return page
}

/**
 * Loads the root route and waits for the app to mount, BEFORE a gate navigates
 * to one of the `/dev/*` labs.
 *
 * Navigating a cold Vite straight at a lazy route does not fail, it hangs: the
 * app never mounts, `#root` stays empty, and the gate's own 60-second poll
 * expires with ZERO console errors and ZERO failed requests to say why. It then
 * reports something that sounds like a product defect — "timed out waiting for
 * lab chrome" — when the truth is that the first page load was still paying for
 * Vite's dependency optimisation.
 *
 * `verify-lesson-engine` hit this and solved it inline. Its two siblings did
 * not, and the difference only showed up the first time they ran on a cold
 * 2-vCPU runner: a developer machine has a warm `node_modules/.vite` from the
 * last run, so the race is invisible there. This lives here so the next gate
 * inherits the answer instead of rediscovering it.
 *
 * The root route is the right place to pay that cost: nothing on it is lazy, so
 * there is no race to lose. This removes a start-up race rather than widening a
 * timeout around it.
 *
 * SIZED FROM WHAT CI ACTUALLY DID, not from a guess. At 60 tries both tutor
 * gates reported "never mounted" on the runner and then loaded the lab in
 * 11.7s — so the warm-up WAS paying the optimisation cost, and simply gave up
 * before finishing while claiming failure. The first full mount of this app on
 * a 2-vCPU runner takes longer than a minute; on a workstation it is seconds,
 * which is why nobody saw it. This returns the moment the app mounts, so the
 * larger ceiling costs a fast machine nothing.
 */
export async function warmDevServer(page, baseUrl, { tries = 180 } = {}) {
  const MOUNTED = '(document.getElementById("root") || {innerHTML: ""}).innerHTML.length > 0'
  const started = Date.now()
  await page.send('Page.navigate', { url: `${baseUrl}/` })
  for (let attempt = 0; attempt < tries; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    if (await page.evaluate(MOUNTED)) {
      const took = Date.now() - started
      if (took > 5000) console.log(`  [warm-up] app mounted after ${(took / 1000).toFixed(0)}s`)
      return true
    }
  }
  return false
}
