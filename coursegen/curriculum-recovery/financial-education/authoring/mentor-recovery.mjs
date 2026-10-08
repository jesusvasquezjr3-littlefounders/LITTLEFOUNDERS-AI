// A visible correction of the exact minimum-payment misconception, not metadata-only compliance.
export function attachMentorRecovery(plans) {
  const plan = plans.find(row => row.lesson_id.startsWith('fe-solid-24-'));
  if (!plan) throw new Error('Missing minimum-payment lesson.');
  const segment = {
    id: 'example-mentor-recovery', type: 'voice.mentor-episode.v2', grading: 'none',
    teaching_role: 'example', visual: { type: 'speech-plate' }, payload: {},
    copy: {
      'en-US': { prompt: 'Rho checks an assumption', setup: 'I paid the minimum on time.', misjudgment: 'I thought that stopped interest.', recovery: 'I checked the statement: debt and interest remain. Meeting the minimum does not remove them.' },
      'es-MX': { prompt: 'Rho revisa una suposición', setup: 'Pagué el mínimo a tiempo.', misjudgment: 'Pensé que eso evitaba intereses.', recovery: 'Revisé el estado: quedan deuda e intereses. Pagar el mínimo no los elimina.' },
      'pt-BR': { prompt: 'Rho confere uma suposição', setup: 'Paguei o mínimo no prazo.', misjudgment: 'Pensei que isso evitava juros.', recovery: 'Conferi o extrato: restam dívida e juros. Pagar o mínimo não os elimina.' },
    },
  };
  plan.segments.splice(2, 0, segment);
  plan.mentor_misjudgment = { character: 'rho', misjudgment: segment.copy['en-US'].misjudgment, recovery: segment.copy['en-US'].recovery };
  plan.instruction.evidence.push({ segment_id: segment.id, skill_id: 'debt.minimum', context_id: 'minimum-payment-mentor-correction', supports_from: [], reasoning: segment.copy['en-US'].recovery });
}
