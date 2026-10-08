import { corePreviewScreens } from './core';
import { learnPreviewScreens } from './learn';
import { mentorPreviewScreens } from './mentor';
import { profilePreviewScreens } from './profile';
import { sitePreviewScreens } from './site';
import { staffPreviewScreens } from './staff';
import type { PreviewRegistry } from './types';

/** Every area's preview screens, by area. Each area edits only its own registry. */
export const PREVIEW_REGISTRIES: Readonly<Record<string, PreviewRegistry>> = {
  core: corePreviewScreens,
  site: sitePreviewScreens,
  learn: learnPreviewScreens,
  mentor: mentorPreviewScreens,
  profile: profilePreviewScreens,
  staff: staffPreviewScreens,
};

/** Screen ids registered by more than one area (must stay empty). */
export function duplicatePreviewScreens(registries: Readonly<Record<string, PreviewRegistry>> = PREVIEW_REGISTRIES): string[] {
  const owner = new Map<string, string>();
  const duplicates: string[] = [];
  for (const [lane, registry] of Object.entries(registries)) for (const id of Object.keys(registry)) {
    if (owner.has(id)) duplicates.push(`${id} (${owner.get(id)} and ${lane})`);
    else owner.set(id, lane);
  }
  return duplicates;
}

export const PREVIEW_SCREENS: PreviewRegistry = Object.assign({}, ...Object.values(PREVIEW_REGISTRIES));
