import { describe, expect, it } from 'vitest';
import { authoringMessages, skeletonOf } from '../../v2/author.js';
import { HORIZONTE_FORGE_CAPABILITIES, HORIZONTE_FORGE_PACKS, horizonteGuidanceFor } from '../../v2/horizonte/index.js';
import { loadV2Plans } from '../../v2/plan.js';
import { FIXTURE_PLANS_HORIZONTE } from '../../v2/cli.js';

const TYPES = Object.keys(HORIZONTE_FORGE_CAPABILITIES).sort();

describe('the Forge authoring prompt covers every Horizonte type', () => {
  it('gives every registered type its own authoring guidance, and no guidance names an unregistered type', () => {
    const guided = new Set(HORIZONTE_FORGE_PACKS.flatMap((pack) => (pack.guidance as readonly { type: string }[]).map((entry) => entry.type)));
    expect(TYPES.filter((type) => !guided.has(type))).toEqual([]);
    expect([...guided].filter((type) => !(type in HORIZONTE_FORGE_CAPABILITIES))).toEqual([]);
  });

  it('turns every type into guidance lines when a skeleton uses it', () => {
    for (const type of TYPES) expect(horizonteGuidanceFor([type]).length, type).toBeGreaterThan(0);
  });

  it('puts the guidance of each type a committed Horizonte plan uses into the system prompt of its skeleton', () => {
    const plans = loadV2Plans(FIXTURE_PLANS_HORIZONTE).flatMap((entry) => (entry.plan ? [entry.plan] : []));
    expect(plans.length).toBeGreaterThan(30);
    for (const plan of plans) {
      const system = authoringMessages(skeletonOf(plan))[0].content as string;
      for (const line of horizonteGuidanceFor(plan.segments.map((segment) => segment.type))) expect(system, plan.lesson_id).toContain(line);
    }
  });
});
