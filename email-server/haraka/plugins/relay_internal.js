'use strict'

// Courier internal-relay policy.
//
// Marks connections from the Railway private network (IPv6 ULA, fc00::/7 — what
// <service>.railway.internal resolves to) and localhost as `relaying`, so their
// mail is forwarded outbound to the Amazon SES smarthost by queue/smtp_forward.
//
// Why IP-based and not SMTP AUTH: Haraka's auth_base only advertises AUTH after
// STARTTLS (auth_base.js: `if (!connection.tls.enabled) return next()`), and a
// self-signed internal cert is not reliably accepted by GoTrue's SMTP client.
// The listener has NO public domain (internal-only service, /AGENTS.md §1.5), so
// only our own Railway services can reach it — this is not an open relay to the
// internet. The sensitive hop (Courier -> SES) stays TLS + SMTP AUTH.
//
// Hardening follow-up (documented in AGENTS.md): move the internal hop to AUTH
// over a trusted internal cert once GoTrue cert handling is verified.

const net_utils = require('haraka-net-utils')

exports.hook_connect = function (next, connection) {
  const ip = connection.remote && connection.remote.ip
  if (ip && net_utils.is_private_ip(ip)) {
    connection.relaying = true
    connection.loginfo(this, `internal relay granted: ${ip}`)
  } else {
    connection.logwarn(this, `relay refused for non-private source: ${ip}`)
  }
  next()
}
