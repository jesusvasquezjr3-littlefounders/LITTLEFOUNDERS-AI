import { describe, expect, it } from 'vitest';
import { buildImageInheritance, inheritedUrl, normalizeLabel } from '../pipeline/imageInheritance.js';
import type { LessonDocumentParsed } from '../contract/schema.js';

const doc = (segments: unknown): LessonDocumentParsed =>
  ({ schema_version: 1, meta: {}, scoring: {}, segments } as unknown as LessonDocumentParsed);

describe('normalizeLabel — same drawing, different writing', () => {
  it('folds case, accents, markdown and punctuation', () => {
    expect(normalizeLabel('**Limones**')).toBe('limones');
    expect(normalizeLabel('Limón')).toBe('limon');
    expect(normalizeLabel('  vaso   de  limonada ')).toBe('vaso de limonada');
    expect(normalizeLabel('Moneda de $5')).toBe('moneda de 5');
  });

  it('keeps genuinely different objects apart — a different object deserves new art', () => {
    expect(normalizeLabel('Limones')).not.toBe(normalizeLabel('Limones grandes'));
    expect(normalizeLabel('Vaso chico')).not.toBe(normalizeLabel('Vaso grande'));
  });
});

describe('buildImageInheritance — index the art a lesson already has', () => {
  it('indexes object-level images by their sibling label', () => {
    const index = buildImageInheritance([
      doc([
        {
          id: 's1',
          type: 'picture_choice',
          payload: {
            options: [
              { id: 'a', label: 'Limones', image_url: 'https://img/limones.png' },
              { id: 'b', text_md: 'Vaso de limonada', image_url: 'https://img/vaso.png' },
            ],
          },
        },
      ]),
    ]);
    expect(inheritedUrl(index, 'limones')).toBe('https://img/limones.png');
    expect(inheritedUrl(index, '**Limones**')).toBe('https://img/limones.png');
    expect(inheritedUrl(index, 'Vaso de Limonada')).toBe('https://img/vaso.png');
    expect(inheritedUrl(index, 'Hielo')).toBeUndefined();
  });

  it('indexes both sides of a memory pair', () => {
    const index = buildImageInheritance([
      doc([
        {
          id: 's1',
          type: 'memory_flip',
          payload: {
            pairs: [{ a_md: 'Moneda de 5', a_image_url: 'https://img/c5.png', b_md: '5 pesos', b_image_url: 'https://img/p5.png' }],
          },
        },
      ]),
    ]);
    expect(inheritedUrl(index, 'Moneda de 5')).toBe('https://img/c5.png');
    expect(inheritedUrl(index, '5 pesos')).toBe('https://img/p5.png');
  });

  it('NEVER indexes a scene anchor — a stale scene would be wrong, not just differently framed', () => {
    const index = buildImageInheritance([
      doc([
        {
          id: 's1',
          type: 'story_scene',
          prompt_md: 'Liruf abre su puesto en la mañana',
          image_url: 'https://img/scene-morning.png',
          payload: { body_md: 'x' },
        },
      ]),
    ]);
    // the segment-level image has no sibling object label, so nothing is indexed
    expect(index.size).toBe(0);
    expect(inheritedUrl(index, 'Liruf abre su puesto en la mañana')).toBeUndefined();
  });

  it('first URL wins, so passing the authoring locale first is deterministic', () => {
    const index = buildImageInheritance([
      doc([{ id: 's1', type: 'picture_choice', payload: { options: [{ id: 'a', label: 'Limones', image_url: 'https://img/first.png' }] } }]),
      doc([{ id: 's1', type: 'picture_choice', payload: { options: [{ id: 'a', label: 'Limones', image_url: 'https://img/second.png' }] } }]),
    ]);
    expect(inheritedUrl(index, 'Limones')).toBe('https://img/first.png');
  });

  it('does not inherit legacy art when a current style version is required', () => {
    const legacy = { ...doc([{ id: 's1', type: 'picture_choice', payload: { options: [{ id: 'a', label: 'Limones', image_url: 'https://img/legacy.png' }] } }]), illustration_style_version: null };
    const current = { ...doc([{ id: 's2', type: 'picture_choice', payload: { options: [{ id: 'a', label: 'Naranjas', image_url: 'https://img/current.png' }] } }]), illustration_style_version: 'v7-qwen-image-max-flat-vector+v8-qwen-image-max-object-white-flat-vector' };
    const index = buildImageInheritance([legacy, current], 'v7-qwen-image-max-flat-vector+v8-qwen-image-max-object-white-flat-vector');
    expect(inheritedUrl(index, 'Limones')).toBeUndefined();
    expect(inheritedUrl(index, 'Naranjas')).toBe('https://img/current.png');
  });

  it('is safe on an empty or imageless document', () => {
    expect(buildImageInheritance([]).size).toBe(0);
    expect(buildImageInheritance([doc([{ id: 's1', type: 'quiz_mcq', payload: { options: [{ id: 'a', text_md: 'x' }] } }])].map((d) => d)).size).toBe(0);
    expect(inheritedUrl(undefined, 'Limones')).toBeUndefined();
  });
});
