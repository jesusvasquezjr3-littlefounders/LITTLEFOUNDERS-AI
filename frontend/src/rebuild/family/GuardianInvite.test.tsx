import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GuardianInviteMint } from './GuardianInvite';
import en from '@/i18n/en-US/rebuild-family.json';
import es from '@/i18n/es-MX/rebuild-family.json';
import pt from '@/i18n/pt-BR/rebuild-family.json';

/*
 * GAP-FIX-R3 (Bible 06): the minted second-Tutor link is named in the
 * reader's language, never a hardcoded English label, and declares its copy
 * role like every other string of the surface.
 */

const LOCALES = [['en-US', en, 'Invite link'], ['es-MX', es, 'Enlace de invitación'], ['pt-BR', pt, 'Link de convite']] as const;
const LINK = 'https://app.test/family?join=auditInviteToken0123456789ab';

describe('GuardianInviteMint', () => {
  it.each(LOCALES)('names the minted link in %s and declares its copy role', (locale, copy, label) => {
    const { container } = render(<GuardianInviteMint copy={copy.guardianInvite} locale={locale} dark={false} open creating={false} link={LINK}
      copied={false} notice={null} noticeIsError={false} onOpen={() => {}} onClose={() => {}} onMint={() => {}} onCopy={() => {}} />);
    const value = screen.getByLabelText(label);
    expect(value).toHaveTextContent(LINK);
    expect(value).toHaveAttribute('data-copy-role', 'data');
    expect(container.querySelector('[aria-label="invite link"]')).toBeNull();
    // Every text-bearing element of the open panel declares a copy role (Bible 06).
    for (const element of container.querySelectorAll('section *')) {
      const own = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
      if (own) expect(element.closest('[data-copy-role]'), element.outerHTML).not.toBeNull();
    }
  });

  it('keeps the link label a distinct key in every locale', () => {
    for (const [, copy] of LOCALES) {
      expect(copy.guardianInvite.linkLabel.trim()).not.toBe('');
      expect(copy.guardianInvite.linkLabel).not.toBe(copy.guardianInvite.copy);
    }
  });
});
