import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Page } from '../../frontend/scripts/lesson-engine/browser.mjs'

class FakeSocket extends EventTarget {
  sent = []

  send(message) {
    this.sent.push(JSON.parse(message))
  }

  closed = false
  close() { this.closed = true }

  message(value) {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(value) }))
  }
}

describe('bounded DevTools transport', () => {
  it('fails an unanswered command with its method and deadline, removes it, and ignores a late reply', async () => {
    const socket = new FakeSocket()
    const page = new Page(socket, 'session-1', { commandTimeoutMs: 10 })
    const pending = page.send('Runtime.evaluate', { expression: '1' })
    const [{ id }] = socket.sent

    await assert.rejects(pending, /DevTools command Runtime\.evaluate timed out after 10ms/)
    assert.equal(page.pending.size, 0)
    socket.message({ id, result: { result: { value: 1 } } })
    assert.equal(page.pending.size, 0)
  })

  it('rejects every pending command when the socket closes', async () => {
    const socket = new FakeSocket()
    const page = new Page(socket, 'session-1', { commandTimeoutMs: 1_000 })
    const first = page.send('Page.navigate')
    const second = page.send('Runtime.evaluate')

    const closed = new Event('close')
    Object.defineProperty(closed, 'code', { value: 1006 })
    socket.dispatchEvent(closed)
    await assert.rejects(first, /Chrome closed the DevTools connection \(code 1006\)/)
    await assert.rejects(second, /Chrome closed the DevTools connection \(code 1006\)/)
    assert.equal(page.pending.size, 0)
  })

  it('bounds cleanup, attempts both resources, and preserves the first failure', async () => {
    const socket = new FakeSocket()
    const page = new Page(socket, 'session-1', { commandTimeoutMs: 10 })
    page.targetId = 'target-1'
    page.contextId = 'context-1'

    await assert.rejects(page.close(), /DevTools command Target\.closeTarget timed out after 10ms/)
    assert.deepEqual(socket.sent.map(({ method }) => method), ['Target.closeTarget', 'Target.disposeBrowserContext'])
    assert.equal(page.pending.size, 0)
    assert.equal(socket.closed, true)
  })
})
