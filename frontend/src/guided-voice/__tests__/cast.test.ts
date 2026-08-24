import { describe, expect, it } from 'vitest';
import castFile from '../cast.json';
import manifestFile from '../manifest.json';
import enOnboarding from '@/i18n/en-US/onboarding.json';
import esOnboarding from '@/i18n/es-MX/onboarding.json';
import ptOnboarding from '@/i18n/pt-BR/onboarding.json';
import enPlacement from '@/i18n/en-US/placement.json';
import esPlacement from '@/i18n/es-MX/placement.json';
import ptPlacement from '@/i18n/pt-BR/placement.json';

/*
 * The narration keys are built at runtime (`placement.narration.${step}`), and
 * `npm run i18n:check` says so explicitly: under a dynamic segment it verifies
 * the NAMESPACE and cannot verify the leaf. This file is that missing check.
 *
 * The failure it exists to catch is quiet in the worst way: a step whose line is
 * missing renders an empty speech bubble and a silent character — the flow still
 * "works", and the one thing this whole feature is for is gone.
 */

const cast = (castFile as { cast: Record<string, string> }).cast;
const CHARACTERS = ['dina', 'liruf', 'rho', 'zara'];

const BUNDLES: Record<string, Record<string, { narration?: Record<string, string> }>> = {
  'en-US': { onboarding: enOnboarding, placement: enPlacement },
  'es-MX': { onboarding: esOnboarding, placement: esPlacement },
  'pt-BR': { onboarding: ptOnboarding, placement: ptPlacement },
};

describe('guided-voice cast', () => {
  it('names only the four canonical characters', () => {
    for (const [key, character] of Object.entries(cast)) {
      expect({ key, character }).toEqual({ key, character: expect.stringMatching(new RegExp(`^(${CHARACTERS.join('|')})$`)) });
    }
  });

  it('has a narration line for every cast key, in all three locales', () => {
    const missing: string[] = [];
    for (const key of Object.keys(cast)) {
      const [namespace, step] = key.split('.');
      for (const [locale, bundle] of Object.entries(BUNDLES)) {
        const line = bundle[namespace!]?.narration?.[step!];
        if (!line || line.trim().length === 0) missing.push(`${locale} ${namespace}.narration.${step}`);
      }
    }
    expect(missing).toEqual([]);
  });

  /*
   * A fixed recording cannot say a variable. A narration line that interpolates
   * would be synthesised with the literal "{{name}}" in it, or — worse — pass
   * the generator and have a character read a template out loud to a child.
   * Interpolated copy belongs in the on-screen aside, which is never voiced.
   */
  it('has no interpolation in any narration line', () => {
    const offenders: string[] = [];
    for (const [locale, bundle] of Object.entries(BUNDLES)) {
      for (const [namespace, ns] of Object.entries(bundle)) {
        for (const [step, line] of Object.entries(ns.narration ?? {})) {
          if (line.includes('{{')) offenders.push(`${locale} ${namespace}.narration.${step}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('has a cast entry for every narration line, so no line is spoken by nobody', () => {
    const orphans: string[] = [];
    for (const [namespace, ns] of Object.entries(BUNDLES['en-US']!)) {
      for (const step of Object.keys(ns.narration ?? {})) {
        if (!cast[`${namespace}.${step}`]) orphans.push(`${namespace}.narration.${step}`);
      }
    }
    expect(orphans).toEqual([]);
  });
});

describe('guided-voice manifest', () => {
  const manifest = manifestFile as unknown as { lines: Record<string, { url: string; character: string; text: string }> };

  it('records the exact text of every clip, which is what the drift guard compares against', () => {
    for (const [key, entry] of Object.entries(manifest.lines)) {
      expect({ key, hasText: typeof entry.text === 'string' && entry.text.length > 0 }).toEqual({ key, hasText: true });
      expect({ key, url: entry.url.startsWith('https://') }).toEqual({ key, url: true });
    }
  });

  /*
   * The whole point of storing the text. If this drifts, the character says one
   * sentence while the screen shows another — and it drifts silently, because
   * the runtime's only response is to go quiet.
   */
  it('matches the current copy, so no line has silently gone stale', () => {
    const stale: string[] = [];
    for (const [key, entry] of Object.entries(manifest.lines)) {
      const [castKey, locale] = key.split('|');
      const [namespace, step] = castKey!.split('.');
      const line = BUNDLES[locale!]?.[namespace!]?.narration?.[step!];
      if (line !== entry.text) stale.push(key);
    }
    expect(stale).toEqual([]);
  });

  it('covers every cast key in every locale', () => {
    const missing: string[] = [];
    for (const key of Object.keys(cast)) {
      for (const locale of Object.keys(BUNDLES)) {
        if (!manifest.lines[`${key}|${locale}`]) missing.push(`${key}|${locale}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
