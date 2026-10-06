// Retired rows remain available to historical runs but are never release candidates.
export interface ReleaseAdventure { id: string; status: string }
export interface ReleaseSaga { id: string; adventure_id: string; status: string }
export interface ReleaseTopic { id: string; saga_id: string; status: string; title: unknown }
export interface ReleaseLesson { id: string; topic_id: string; slug: string; status: string }

export function selectReleaseCatalog(input: {
  adventures: readonly ReleaseAdventure[];
  sagas: readonly ReleaseSaga[];
  topics: readonly ReleaseTopic[];
  lessons: readonly ReleaseLesson[];
}) {
  const adventures = input.adventures.filter(row => row.status !== 'archived');
  const sagas = input.sagas.filter(row => row.status !== 'archived');
  const topics = input.topics.filter(row => row.status !== 'archived');
  const lessons = input.lessons.filter(row => row.status !== 'archived');
  const problems: string[] = [];
  const adventureIds = new Set(adventures.map(row => row.id));
  const sagaIds = new Set(sagas.map(row => row.id));
  const topicIds = new Set(topics.map(row => row.id));
  for (const row of sagas) if (!adventureIds.has(row.adventure_id)) problems.push(`Active saga ${row.id} has an archived or missing adventure`);
  for (const row of topics) if (!sagaIds.has(row.saga_id)) problems.push(`Active topic ${row.id} has an archived or missing saga`);
  for (const row of lessons) if (!topicIds.has(row.topic_id)) problems.push(`Active lesson ${row.id} has an archived or missing topic`);
  for (const row of adventures) if (!sagas.some(child => child.adventure_id === row.id)) problems.push(`Active adventure ${row.id} has no active saga`);
  for (const row of sagas) if (!topics.some(child => child.saga_id === row.id)) problems.push(`Active saga ${row.id} has no active topic`);
  for (const row of topics) if (!lessons.some(child => child.topic_id === row.id)) problems.push(`Active topic ${row.id} has no active lesson`);
  if (!lessons.length) problems.push('A release needs at least one non-archived lesson');
  return { adventures, sagas, topics, lessons, problems, archivedLessonCount: input.lessons.length - lessons.length };
}
