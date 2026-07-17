import { describe, expect, it } from 'vitest';
import { PALETTE_GUIDE, PALETTE_EXAMPLES, resolveAllowedTypes, renderPalette } from '../pipeline/prompts/palette.js';
import { ALL_TYPES } from '../contract/registry.js';
import { buildTaxonomy } from './fixtures.js';

describe('palette exhaustiveness', () => {
  it('has exactly one PALETTE_GUIDE entry per type actually present in the Zod contract (56 total)', () => {
    const guideKeys = Object.keys(PALETTE_GUIDE).sort();
    const contractTypes = [...ALL_TYPES].sort();
    expect(guideKeys).toEqual(contractTypes);
    expect(contractTypes).toHaveLength(56);
  });

  it('every PALETTE_EXAMPLES key is a real type', () => {
    for (const type of Object.keys(PALETTE_EXAMPLES)) {
      expect(ALL_TYPES).toContain(type);
    }
  });
});

describe('resolveAllowedTypes', () => {
  const taxonomy = buildTaxonomy();

  it('includes only families in the tier allowlist, plus extras, minus banned', () => {
    const { allowed } = resolveAllowedTypes(taxonomy, 'tier1');
    expect(allowed).toContain('story_scene'); // story family
    expect(allowed).toContain('coin_count'); // money family
    expect(allowed).toContain('pattern_complete'); // tier1_extra_allowed exception
    expect(allowed).not.toContain('confidence_quiz'); // tier1_banned_types
    expect(allowed).not.toContain('interest_peek'); // tier1_banned_types
    expect(allowed).not.toContain('spot_error'); // analyze family not in tier1 allowlist
  });

  it('tier2 includes analyze/maker families', () => {
    const { allowed } = resolveAllowedTypes(taxonomy, 'tier2');
    expect(allowed).toContain('spot_error');
    expect(allowed).toContain('robot_path');
  });
});

describe('renderPalette', () => {
  it('renders one line per allowed type, with example fragments for error-prone types', () => {
    const text = renderPalette(['quiz_mcq', 'fill_blank']);
    expect(text).toContain('quiz_mcq:');
    expect(text).toContain('fill_blank:');
    expect(text).toContain('example:'); // fill_blank has a PALETTE_EXAMPLES entry
  });
});
