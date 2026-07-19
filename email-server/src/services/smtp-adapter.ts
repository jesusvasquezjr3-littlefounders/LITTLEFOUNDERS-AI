import nodemailer, { type Transporter } from 'nodemailer';
import type { EmailAdapter, SendRequest, SendResult } from './adapter.js';

/*
 * SmtpAdapter — submits mail into the co-located Haraka engine over plain SMTP
 * on localhost. Haraka (relay_internal) treats the localhost connection as
 * relaying and forwards it to Amazon SES over TLS + SMTP AUTH. The internal hop
 * is intentionally plaintext-on-loopback; the sensitive hop (Haraka -> SES) is
 * encrypted. See email-server/haraka/README.md.
 */
export interface SmtpAdapterOptions {
  host: string;
  port: number;
  from: string;
}

export class SmtpAdapter implements EmailAdapter {
  private readonly transport: Transporter;
  private readonly from: string;

  /** `transport` is injectable so tests can mock nodemailer without a socket. */
  constructor(opts: SmtpAdapterOptions, transport?: Transporter) {
    this.from = opts.from;
    this.transport =
      transport ??
      nodemailer.createTransport({
        host: opts.host,
        port: opts.port,
        secure: false, // loopback submission into Haraka
        ignoreTLS: true, // do not attempt STARTTLS to the local engine
        pool: true,
        maxConnections: 3,
      });
  }

  async send(req: SendRequest): Promise<SendResult> {
    const info = await this.transport.sendMail({
      from: this.from,
      to: req.to,
      subject: req.subject,
      html: req.html,
      text: req.text,
    });
    return { id: info.messageId, status: 'queued' };
  }
}
