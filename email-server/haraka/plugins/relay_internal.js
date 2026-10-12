'use strict'

// Courier relay policy: only this machine may submit mail.
//
// Marks a connection from the loopback address as `relaying`, so its mail is
// forwarded outbound to the Amazon SES smarthost by queue/smtp_forward. The one
// sender is the Courier HTTP API in the same container, which accepts only the
// internal key and builds every email from its own templates.
//
// Every other source is refused, the private network included. The listener is
// bound to 127.0.0.1 (config/smtp.ini), so nothing else should ever connect;
// this check is the second lock, for the day somebody widens the listener by
// mistake. It used to trust every private address so the authentication
// service could submit over SMTP: that let any service on the private network
// send arbitrary mail from our domain without a key, and the authentication
// service no longer sends mail itself (docs/features/F-002-emails.md).

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

exports.hook_connect = function (next, connection) {
  const ip = connection.remote && connection.remote.ip
  if (ip && LOOPBACK.has(ip)) {
    connection.relaying = true
  } else {
    connection.logwarn(this, 'relay refused: not this machine')
  }
  next()
}

// Exported for checks. Haraka only looks for hook_*/register.
exports._LOOPBACK = LOOPBACK
