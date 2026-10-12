// How a built email leaves the service. POST /api/v1/send builds the email (src/mail) and hands it
// to one of these; which one is chosen by EMAIL_ENGINE (src/config.ts).

export interface SendRequest {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  /** Extra headers, such as the one-click unsubscribe pair. */
  headers?: Record<string, string>;
}

export interface SendResult {
  id: string;
  status: 'queued';
}

export interface EmailAdapter {
  send(req: SendRequest): Promise<SendResult>;
}

export class NoopAdapter implements EmailAdapter {
  private counter = 0;

  async send(req: SendRequest): Promise<SendResult> {
    this.counter += 1;
    const id = `noop-${this.counter}`;
    // Never the address: a log line is kept longer, and read by more people, than the email.
    console.log(`[courier] no-op queued ${id}: "${req.subject}"`);
    return { id, status: 'queued' };
  }
}
