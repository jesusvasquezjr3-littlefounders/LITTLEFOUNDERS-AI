// Conservative authoring preflight; rendered text-fit and copy audits remain required.
// Reserve the visible player labels in addition to the complete authored board.
const limits = { 'en-US': [40, 7], 'es-MX': [50, 6], 'pt-BR': [50, 6] };
export const countScreenWords = text => (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’.,%$-]*/gu) ?? []).length;

export function storyCopyProblems(plans) {
  const problems = [];
  for (const plan of plans) for (const segment of plan.segments) {
    if (segment.type !== 'story.branch.v2') continue;
    for (const [locale, [limit, chrome]] of Object.entries(limits)) {
      const copy = segment.copy[locale];
      const words = countScreenWords([plan.title[locale], copy.prompt, copy.scene,
        ...copy.options.map(option => option.label)].join(' ')) + chrome;
      if (words > limit) problems.push({lesson:plan.lesson_id,segment:segment.id,locale,words,limit});
    }
  }
  return problems;
}
