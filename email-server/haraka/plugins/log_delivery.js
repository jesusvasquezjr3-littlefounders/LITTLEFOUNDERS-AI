'use strict'

// Courier delivery capture.
//
// GoTrue submits auth mail (confirmation / recovery / magic-link / invite /
// email-change) straight to this relay over SMTP :587. It never touches
// Courier's HTTP API, so before this plugin existed NONE of the platform's
// real mail appeared in the admin console — /admin/emails rendered an empty
// table while SES was happily delivering.
//
// This hook reports every successfully relayed message to Courier's own HTTP
// API on localhost, which owns the (typed, tested) write to the email_logs
// table. The plugin deliberately holds no database credentials and contains no
// SQL: Haraka's runtime is CommonJS and is excluded from our linter and
// type-checker (see email-server/eslint.config.js), so the less logic that
// lives here, the better.
//
// PRIME DIRECTIVE: never break mail delivery. Every failure path swallows and
// calls next(). A logging outage must never bounce a password reset.

const HTTP_TIMEOUT_MS = 2000

/** RFC 2047 encoded-word decoder — GoTrue subjects are trilingual and accented. */
function decodeWords(raw) {
  return raw.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (match, charset, encoding, text) => {
    try {
      if (encoding.toUpperCase() === 'B') {
        return Buffer.from(text, 'base64').toString(charset)
      }
      // Q encoding: '_' is a space, =XX is a hex byte.
      const bytes = text
        .replace(/_/g, ' ')
        .replace(/=([0-9A-Fa-f]{2})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
      return Buffer.from(bytes, 'binary').toString(charset)
    } catch {
      return match
    }
  })
}

function headerValue(txn, name) {
  try {
    const raw = txn.header && txn.header.get(name)
    if (!raw) return ''
    // Adjacent encoded words are separated by whitespace that must collapse.
    return decodeWords(String(raw).trim()).replace(/\s+/g, ' ').trim()
  } catch {
    return ''
  }
}

function recipients(txn) {
  try {
    return (txn.rcpt_to || []).map((r) => String(r.address ? r.address() : r)).filter(Boolean)
  } catch {
    return []
  }
}

exports.hook_queue_ok = function (next, connection) {
  const plugin = this
  try {
    const txn = connection && connection.transaction
    if (!txn) return next()

    const to = recipients(txn)
    if (to.length === 0) return next()

    const subject = headerValue(txn, 'Subject')
    // Message-ID arrives as <id@host>; store the bare id.
    const messageId = headerValue(txn, 'Message-ID').replace(/^<|>$/g, '') || `smtp-${txn.uuid}`

    const port = Number(process.env.PORT || 4005)
    const key = process.env.INTERNAL_API_KEY || ''

    // One row per recipient — email_logs.to_address is a single address.
    for (const address of to) {
      const body = JSON.stringify({
        messageId: to.length > 1 ? `${messageId}#${address}` : messageId,
        to: address,
        subject,
        status: 'relayed',
        templateType: 'auth',
        detail: { source: 'smtp', from: String(txn.mail_from || ''), remoteIp: connection.remote && connection.remote.ip },
      })

      fetch(`http://127.0.0.1:${port}/api/v1/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-api-key': key },
        body,
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      })
        .then((res) => {
          if (!res.ok) plugin.logwarn(`delivery log rejected (HTTP ${res.status}) for ${address}`)
        })
        .catch((err) => {
          plugin.logwarn(`delivery log failed for ${address}: ${err && err.message}`)
        })
    }
  } catch (err) {
    // Belt and braces — nothing in here may propagate.
    try {
      plugin.logwarn(`delivery log threw: ${err && err.message}`)
    } catch {
      /* ignore */
    }
  }
  // Deliberately NOT awaited: the SMTP transaction must not wait on logging.
  next()
}

// Exported for tests. Haraka only ever looks for hook_*/register, so extra
// exports are inert at runtime.
exports._decodeWords = decodeWords
