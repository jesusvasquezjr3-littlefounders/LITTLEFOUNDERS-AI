'use strict'

// Courier's forward to the smarthost, with one rule added: nothing
// leaves over a connection that is not encrypted.
//
// It is Haraka's own queue/smtp_forward (same config file, smtp_forward.ini,
// same behavior), inherited whole. That plugin upgrades to TLS only when the
// other side offers it: if the offer is missing (a fault, or somebody on the
// path removing it), it would go on and send the smarthost's password and then the
// email, a sign-in code included, in clear. Here every command that carries a
// secret or a message is held back unless the connection has been secured, and
// the email is deferred instead (the caller is told it was not sent).
//
// The certificate is checked too: smtp_forward.ini is rendered with
// [tls] rejectUnauthorized=true (src/services/haraka.ts).

const GUARDED = new Set(['AUTH', 'MAIL', 'RCPT', 'DATA'])

exports.register = function () {
  this.inherits('queue/smtp_forward')
}

exports.auth = function (cfg, connection, smtp_client) {
  const plugin = this
  const send = smtp_client.send_command.bind(smtp_client)
  let refused = false

  smtp_client.send_command = function (command, data) {
    if (smtp_client.secured === true || !GUARDED.has(String(command).toUpperCase())) return send(command, data)

    if (refused) return

    refused = true
    connection.logcrit(plugin, 'the smarthost connection is not encrypted: nothing is sent over it')
    smtp_client.call_next(DENYSOFT, 'the relay connection is not encrypted')
    smtp_client.release()
  }

  return plugin.base['queue/smtp_forward'].auth.call(plugin, cfg, connection, smtp_client)
}

// Exported for checks. Haraka only looks for hook_*/register.
exports._GUARDED = GUARDED
