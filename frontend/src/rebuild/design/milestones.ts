/** OD-7 is a closed list. Correct answers and routine actions cannot celebrate. */
export type Milestone = 'lesson-complete' | 'course-complete' | 'savings-goal-reached' | 'badge-earned' | 'streak-7' | 'streak-30' | 'streak-100';
const milestones = new Set<string>([
  'lesson-complete', 'course-complete', 'savings-goal-reached', 'badge-earned',
  'streak-7', 'streak-30', 'streak-100',
]);
export function isMilestone(event: string): event is Milestone {
  return milestones.has(event);
}
