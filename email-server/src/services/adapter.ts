// Engine adapter interface. The real engine (Postal/Maddy/Haraka/Stalwart —
// decision OPEN, see README.md) implements EmailAdapter; consumers of
// POST /api/v1/send never change when it lands.

export interface SendRequest {
  to: string;
  subject: string;
  html?: string;
  text?: string;
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
    console.log(`[courier] no-op queued ${id} → ${req.to}: "${req.subject}"`);
    return { id, status: 'queued' };
  }
}
