import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RoleplayCaption } from '../RoleplayCaption';
import { ROLEPLAY_SCENES } from '../scenes';

/*
 * The one place a DYNAMIC i18n key (`tutor.character.${id}.name`,
 * `t(beat.textKey)`, `t(titleKey)`) can actually be proven to resolve —
 * `test-setup.ts`'s own `missingKey` listener is why: `i18n:check`'s static
 * scanner explicitly cannot verify a template-literal key, and this project
 * has shipped a rendered-but-untranslated key to production before over
 * exactly that gap.
 */

const SCENE = ROLEPLAY_SCENES.lemonade_change!;

describe('RoleplayCaption', () => {
  it('resolves the scene title and every beat text key for every real character id', () => {
    for (const id of ['rho', 'zara', 'liruf', 'dina'] as const) {
      for (const beat of SCENE.beats) {
        const { unmount } = render(<RoleplayCaption titleKey={SCENE.titleKey} beat={beat} speakerId={id} />);
        // The scene title always renders.
        expect(screen.getByText('The lemonade stand')).toBeInTheDocument();
        // The character's own name-prefixed line, not the raw key.
        expect(screen.queryByText(new RegExp(beat.textKey))).toBeNull();
        unmount();
      }
    }
  });

  it('shows the line with no speaker prefix when the role has no real character (no companion picked)', () => {
    render(<RoleplayCaption titleKey={SCENE.titleKey} beat={SCENE.beats[0]!} speakerId={null} />);
    expect(screen.getByText('The lemonade stand')).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(SCENE.beats[0]!.textKey))).toBeNull();
  });
});
