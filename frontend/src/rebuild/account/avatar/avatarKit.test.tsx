import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AVATAR_PARTS, AVATAR_SPRITES, COVER_IDS, COVER_SPRITE, avatarLayers, lookToStored, resolveCover, resolveLook, withPart } from './avatarKit';
import { CartoonAvatar, CoverArt } from './CartoonAvatar';

/*
 * The cartoon avatar as data (E.12): a stored option set always resolves to a
 * drawable look, what is written back is exactly the closed shape Core
 * accepts, and every layer the drawing asks for exists in our own sprites.
 */

const publicDir = resolve(__dirname, '../../../../public');
const sprite = (path: string) => readFileSync(resolve(publicDir, `.${path}`), 'utf8');

describe('resolveLook', () => {
  it('draws a stored look as stored', () => {
    const look = resolveLook({ skinColor: ['614335'], top: ['hijab'], hairColor: ['c93305'], eyes: ['wink'], eyebrows: ['upDown'], mouth: ['tongue'],
      clothing: ['overall'], clothesColor: ['a7ffc4'], accessories: ['kurt'], accessoriesProbability: 100, facialHair: ['beardLight'], facialHairProbability: 0 }, 'seed');
    expect(look).toEqual({ skinColor: '614335', top: 'hijab', hairColor: 'c93305', eyes: 'wink', eyebrows: 'upDown', mouth: 'tongue', facialHair: null,
      clothing: 'overall', clothesColor: 'a7ffc4', accessories: 'kurt' });
  });

  it('gives an unsaved avatar the same default look for the same account, without a random draw', () => {
    const first = resolveLook({}, '33333333-3333-4333-8333-333333333333');
    expect(resolveLook({}, '33333333-3333-4333-8333-333333333333')).toEqual(first);
    expect(first.facialHair).toBeNull();
    expect(first.accessories).toBeNull();
    for (const part of ['skinColor', 'top', 'hairColor', 'eyes', 'eyebrows', 'mouth', 'clothing', 'clothesColor'] as const) {
      expect(AVATAR_PARTS[part] as readonly string[]).toContain(first[part]);
    }
  });

  it('keeps drawing when a legacy row holds a value outside the catalogue (Core accepts any short alphanumeric value)', () => {
    const look = resolveLook({ top: ['someRetiredStyle', 'bob'], eyes: ['notAnEye'], seed: 'legacy_seed' }, 'fallback');
    expect(look.top).toBe('bob');
    expect(AVATAR_PARTS.eyes as readonly string[]).toContain(look.eyes);
    // The stored seed, not the account id, derives the default.
    expect(resolveLook({ seed: 'legacy_seed' }, 'a')).toEqual(resolveLook({ seed: 'legacy_seed' }, 'b'));
  });
});

describe('lookToStored', () => {
  it('writes exactly the closed shape Core accepts (profileShape.ts AvatarOptions)', () => {
    const look = withPart(resolveLook({}, 'x'), 'accessories', 'round');
    const stored = lookToStored(look, 'kept-seed');
    const allowed = ['seed', 'top', 'hairColor', 'skinColor', 'eyes', 'eyebrows', 'mouth', 'facialHair', 'clothing', 'clothesColor', 'accessories',
      'facialHairProbability', 'accessoriesProbability'];
    for (const [key, value] of Object.entries(stored)) {
      expect(allowed).toContain(key);
      if (Array.isArray(value)) {
        expect(value.length).toBeLessThanOrEqual(3);
        for (const entry of value) expect(entry).toMatch(/^[A-Za-z0-9]{1,40}$/);
      } else if (typeof value === 'number') expect([0, 100]).toContain(value);
      else expect(value).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    }
    expect(stored.accessories).toEqual(['round']);
    expect(stored.accessoriesProbability).toBe(100);
    expect(stored.facialHair).toBeUndefined();
    expect(stored.facialHairProbability).toBe(0);
    expect(resolveLook(stored, 'other')).toEqual(look);
  });

  it('never writes a seed that Core would refuse', () => {
    expect(lookToStored(resolveLook({}, 'x'), 'not a valid seed!').seed).toBeUndefined();
  });

  it('refuses values outside the catalogue and a "None" for a part that is not optional', () => {
    const look = resolveLook({}, 'x');
    expect(withPart(look, 'top', 'https://example.com/me.png')).toBe(look);
    expect(withPart(look, 'eyes', null)).toBe(look);
    expect(withPart(look, 'facialHair', null).facialHair).toBeNull();
  });
});

describe('the sprites', () => {
  it('holds every layer any look can ask for, and no raster, text, script or hard-coded colour', () => {
    const ids = new Set(Object.values(AVATAR_SPRITES).flatMap((path) => [...sprite(path).matchAll(/<g id="([^"]+)"/g)].map((m) => `${path}#${m[1]}`)));
    for (const top of AVATAR_PARTS.top) for (const clothing of AVATAR_PARTS.clothing) {
      const look = { ...resolveLook({}, 'x'), top, clothing, facialHair: 'beardMajestic' as const, accessories: 'wayfarers' as const };
      for (const layer of avatarLayers(look)) expect(ids, layer).toContain(layer);
    }
    for (const part of ['eyes', 'eyebrows', 'mouth', 'facialHair', 'accessories'] as const) {
      for (const value of AVATAR_PARTS[part]) expect(avatarLayers({ ...resolveLook({}, 'x'), [part]: value }).join(' ')).toContain(`#${part}-${value}`);
    }
    for (const path of [...Object.values(AVATAR_SPRITES), COVER_SPRITE]) {
      const svg = sprite(path);
      expect(svg.startsWith('<svg ')).toBe(true);
      expect(svg).not.toMatch(/<(script|image|text|foreignObject|linearGradient|radialGradient|filter)\b|#[0-9a-f]{3,8}\b|https?:\/\/(?!www\.w3\.org)/i);
    }
    const covers = new Set([...sprite(COVER_SPRITE).matchAll(/<g id="([^"]+)"/g)].map((m) => m[1]));
    for (const id of COVER_IDS) expect(covers).toContain(id);
  });
});

describe('resolveCover', () => {
  it('names a preset or the default, never anything else', () => {
    expect(resolveCover({ preset: 'forest' })).toBe('forest');
    expect(resolveCover({ preset: 'https://example.com/cover.png' })).toBe('aurora');
    expect(resolveCover({})).toBe('aurora');
    expect(resolveCover(null)).toBe('aurora');
  });
});

describe('CartoonAvatar', () => {
  it('layers our registered sprites, carries the colours as variables and is decorative unless labelled', () => {
    const look = resolveLook({ skinColor: ['ae5d29'], hairColor: ['d6b370'], clothesColor: ['25557c'] }, 'x');
    const { container, rerender } = render(<CartoonAvatar look={look} />);
    const slot = container.querySelector('[data-slot="profile-avatar"]')!;
    expect(slot.getAttribute('aria-hidden')).toBe('true');
    expect(slot.getAttribute('data-refused')).toBeNull();
    const uses = [...container.querySelectorAll('use')].map((node) => node.getAttribute('href'));
    expect(uses).toEqual(avatarLayers(look));
    const style = container.querySelector('svg')!.getAttribute('style') ?? '';
    expect(style).toContain('--lf-avatar-skin: #ae5d29');
    expect(style).toContain('--lf-avatar-hair: #d6b370');
    expect(style).toContain('--lf-avatar-clothes: #25557c');
    rerender(<CartoonAvatar look={look} label="Your avatar" />);
    expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Your avatar');
  });

  it('draws a cover preset from the registered cover sprite', () => {
    const { container } = render(<CoverArt cover="midnight" />);
    expect(container.querySelector('use')?.getAttribute('href')).toBe(`${COVER_SPRITE}#midnight`);
    expect(container.querySelector('[data-slot="profile-cover"]')?.getAttribute('aria-hidden')).toBe('true');
  });
});
