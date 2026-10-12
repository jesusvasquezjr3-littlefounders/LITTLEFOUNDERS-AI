'use strict'

// Courier never delivers an email by itself.
//
// Every email goes out through the Amazon SES smarthost (forward_secure). When
// that plugin cannot hand a message over (the smarthost is down, or its
// certificate fails the check) it passes the message on, and Haraka's default
// would then deliver it straight to the recipient's mail server: from an
// address that server has no reason to trust, over a connection whose
// encryption is the other side's choice. This plugin comes after
// forward_secure in config/plugins and ends that path: the message is deferred
// and the caller is told it was not sent.

exports.hook_queue_outbound = function (next, connection) {
  connection.logerror(this, 'the smarthost did not take the message: it is not delivered any other way')
  next(DENYSOFT, 'the mail relay is not available')
}
