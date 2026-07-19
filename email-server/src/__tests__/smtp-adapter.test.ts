import { describe, expect, it, vi } from 'vitest';
import { type Transporter } from 'nodemailer';
import { SmtpAdapter } from '../services/smtp-adapter.js';

describe('SmtpAdapter', () => {
  it('submits via the transport and reports the message queued', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: '<abc@courier>' });
    const transport = { sendMail } as unknown as Transporter;
    const adapter = new SmtpAdapter(
      { host: '127.0.0.1', port: 2525, from: 'LittleFounders <noreply@littlefounders.ai>' },
      transport,
    );

    const result = await adapter.send({
      to: 'parent@example.com',
      subject: 'Confirm your email',
      html: '<p>Hi</p>',
      text: 'Hi',
    });

    expect(result).toEqual({ id: '<abc@courier>', status: 'queued' });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'LittleFounders <noreply@littlefounders.ai>',
        to: 'parent@example.com',
        subject: 'Confirm your email',
        html: '<p>Hi</p>',
        text: 'Hi',
      }),
    );
  });

  it('propagates a transport failure (e.g. SES auth rejected)', async () => {
    const sendMail = vi.fn().mockRejectedValue(new Error('550 Authentication Credentials Invalid'));
    const transport = { sendMail } as unknown as Transporter;
    const adapter = new SmtpAdapter({ host: '127.0.0.1', port: 2525, from: 'x@littlefounders.ai' }, transport);

    await expect(adapter.send({ to: 'p@example.com', subject: 'S', text: 'T' })).rejects.toThrow(/550/);
  });
});
