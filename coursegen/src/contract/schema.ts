// The composed LessonDocument Zod schema — LESSON_ENGINE.md §3.
// This is the contract Forge (coursegen) generates against and Core will
// validate with server-side (pure TS, dependency-free beyond zod, by design).

import { z } from 'zod';
import { lessonMetaSchema, lessonScoringSchema } from './core/schemaBase.js';
import { storySchemas } from './families/story/schema.js';
import { choiceSchemas } from './families/choice/schema.js';
import { inputSchemas } from './families/input/schema.js';
import { arrangeSchemas } from './families/arrange/schema.js';
import { moneySchemas } from './families/money/schema.js';
import { analyzeSchemas } from './families/analyze/schema.js';
import { storyplaySchemas } from './families/storyplay/schema.js';
import { makerSchemas } from './families/maker/schema.js';

const allSegmentSchemas = [
  ...storySchemas,
  ...choiceSchemas,
  ...inputSchemas,
  ...arrangeSchemas,
  ...moneySchemas,
  ...analyzeSchemas,
  ...storyplaySchemas,
  ...makerSchemas,
] as const;

export const segmentUnion = z.discriminatedUnion(
  'type',
  allSegmentSchemas as unknown as [
    (typeof allSegmentSchemas)[0],
    ...(typeof allSegmentSchemas)[number][],
  ],
);

export const lessonDocumentSchema = z
  .object({
    schema_version: z.literal(1),
    meta: lessonMetaSchema,
    scoring: lessonScoringSchema,
    segments: z.array(segmentUnion).min(1).max(80),
  })
  .superRefine((doc, ctx) => {
    // Cross-field integrity (§3). Deeper per-type referential checks land with Forge.
    const ids = new Set<string>();
    doc.segments.forEach((segment, index) => {
      if (ids.has(segment.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['segments', index, 'id'],
          message: `duplicate segment id "${segment.id}"`,
        });
      }
      ids.add(segment.id);
      const narrator = segment.narrator?.character;
      if (narrator && !doc.meta.cast.includes(narrator)) {
        ctx.addIssue({
          code: 'custom',
          path: ['segments', index, 'narrator'],
          message: `narrator "${narrator}" is not in meta.cast`,
        });
      }
    });
  });

export type LessonDocumentParsed = z.infer<typeof lessonDocumentSchema>;
