/*
 * The catalogue poses the full Mentor stage can play (`src/rebuild/mentor/stageStates.ts`), each with the preview
 * request that plays it. Shared by the stills (render-mentor-stage-stills.mjs) and the sequences
 * (render-mentor-stage-sequences.mjs), so a sequence always exists for a pose that has a still.
 */
export const STAGE_STILL_POSES = [
  { pose: 'ambient.idle', query: 'state=idle&age=6-9' },
  { pose: 'ambient.listen', query: 'state=listening&age=6-9' },
  { pose: 'think.ponder', query: 'state=thinking&age=6-9' },
  { pose: 'teach.aside', query: 'state=thinking&age=13-17' },
  { pose: 'ambient.idle.happy', query: 'state=speaking&age=6-9' },
  { pose: 'teach.explain', query: 'state=demonstrating&age=6-9' },
  { pose: 'feedback.retry.gentle', query: 'state=encouraging&age=6-9' },
  { pose: 'celebrate.with', query: 'state=celebrating&milestone=lesson-complete&age=6-9' },
  { pose: 'celebrate.applaud', query: 'state=celebrating&milestone=lesson-complete&age=13-17' },
  { pose: 'transition.close.warm', query: 'state=closing&closing=completed&age=6-9' },
  { pose: 'transition.exit', query: 'state=closing&closing=learner_left&age=6-9' },
  { pose: 'transition.pause', query: 'state=closing&closing=safety_stop&age=6-9' },
  // GAP-FIX-R2: the `acknowledging` state (08 §11, a met answer): the quiet happy pose and the calm register's nod.
  { pose: 'feedback.correct.quiet', query: 'state=acknowledging&age=6-9' },
  { pose: 'greet.nod', query: 'state=acknowledging&age=13-17' },
];
