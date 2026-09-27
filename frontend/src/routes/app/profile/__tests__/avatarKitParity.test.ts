import { describe, expect, it } from 'vitest';
import { AVATAR_CATALOG } from '@/lib/avatarOptions';
import { COVER_PRESETS } from '@/lib/coverPresets';
import { AVATAR_PARTS, COVER_IDS } from '@/rebuild/account/avatar/avatarKit';

/*
 * The rebuilt avatar kit hand-mirrors the editor's closed catalogue and the
 * ten cover presets (the rebuilt frontend may not import `lib/`, Bible 02
 * rule 23). A drift would let the rebuilt editor offer a value the legacy
 * pages cannot draw, or draw a stored value as the default: fail here.
 * (`social:check` compares the cover presets with Core and the database too.)
 */
describe('rebuilt avatar kit parity', () => {
  it('offers exactly the legacy catalogue, part by part and in the same order', () => {
    expect(Object.keys(AVATAR_PARTS).sort()).toEqual(Object.keys(AVATAR_CATALOG).sort());
    for (const [part, values] of Object.entries(AVATAR_CATALOG)) expect(AVATAR_PARTS[part as keyof typeof AVATAR_PARTS], part).toEqual(values);
  });

  it('draws exactly the ten cover presets', () => {
    expect([...COVER_IDS]).toEqual(COVER_PRESETS.map((preset) => preset.id));
  });
});
