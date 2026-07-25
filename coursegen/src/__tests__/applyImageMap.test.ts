import { describe, expect, it } from 'vitest';
import { rewriteImageUrls } from '../scripts/apply-image-map.js';
import type { LessonDocumentParsed } from '../contract/schema.js';

/*
 * The url rewrite must be provably complete against the contract: the four
 * image keys can appear at the SEGMENT level (scene anchor) and arbitrarily
 * deep in payloads (options[], pairs[].a/b, count_objects.scene[]…). A missed
 * spot would leave a PNG url pointing at an object the cleanup step deletes.
 */

const OLD_A = 'http://localhost:4006/files/lesson-images/aaaa.png';
const OLD_B = 'http://localhost:4006/files/lesson-images/bbbb.png';
const NEW_A = 'http://localhost:4006/files/lesson-images/1111.webp';
const NEW_B = 'http://localhost:4006/files/lesson-images/2222.webp';

function doc(segments: unknown[]): LessonDocumentParsed {
  return { schema_version: 1, meta: {}, scoring: {}, segments } as unknown as LessonDocumentParsed;
}

describe('rewriteImageUrls', () => {
  it('rewrites scene anchors, nested payload slots, and memory_flip a/b sides', () => {
    const input = doc([
      { id: 's1', type: 'story_scene', image_url: OLD_A, payload: { art: { image_url: OLD_A } } },
      {
        id: 's2',
        type: 'memory_flip',
        payload: { pairs: [{ a_md: 'x', a_image_url: OLD_A, b_md: 'y', b_image_url: OLD_B }] },
      },
      { id: 's3', type: 'count_objects', payload: { scene: [{ image_url: OLD_B }], ask_image_url: OLD_A } },
    ]);

    const result = rewriteImageUrls(input, { [OLD_A]: NEW_A, [OLD_B]: NEW_B });

    expect(result.replaced).toBe(6);
    expect(result.unmapped).toEqual([]);
    const segments = result.document.segments as unknown as Array<Record<string, unknown>>;
    expect(segments[0]?.image_url).toBe(NEW_A);
    expect((segments[0]?.payload as { art: { image_url: string } }).art.image_url).toBe(NEW_A);
    const pair = (segments[1]?.payload as { pairs: Array<Record<string, string>> }).pairs[0];
    expect(pair?.a_image_url).toBe(NEW_A);
    expect(pair?.b_image_url).toBe(NEW_B);
  });

  it('does not mutate the input document', () => {
    const input = doc([{ id: 's1', type: 'story_scene', image_url: OLD_A, payload: {} }]);
    rewriteImageUrls(input, { [OLD_A]: NEW_A });
    expect((input.segments as unknown as Array<Record<string, unknown>>)[0]?.image_url).toBe(OLD_A);
  });

  it('reports lesson-images urls the map does not cover — but not already-converted ones', () => {
    const input = doc([
      { id: 's1', type: 'story_scene', image_url: OLD_A, payload: {} },
      { id: 's2', type: 'story_scene', image_url: NEW_B, payload: {} }, // already webp — fine
      { id: 's3', type: 'story_scene', image_url: 'https://other.example/pic.png', payload: {} }, // foreign host — ignored
    ]);

    const result = rewriteImageUrls(input, { [OLD_B]: NEW_B });

    expect(result.replaced).toBe(0);
    expect(result.unmapped).toEqual([OLD_A]);
  });
});
