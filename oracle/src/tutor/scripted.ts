import type { Locale } from '../context/schema.js';
import type { SafetyCategory } from '../safety/classifier.js';
import type { TutorTurn } from './turnSchema.js';

/*
 * Human-written lines, for every moment a generated one must not be used.
 *
 * These are the most important strings in the service and the least
 * impressive-looking. Every one of them covers a case where something went
 * wrong — the model is down, moderation refused, a child said something that
 * must never reach a language model — and in all of those the correct output
 * is a sentence a person wrote and reviewed, in the child's own language.
 *
 * WHY THEY LIVE IN CODE RATHER THAN IN THE FRONTEND'S i18n FILES. These are
 * spoken by the tutor, so they go through the same turn pipeline as a
 * generated line: they carry an emotion and an action, they get synthesized to
 * audio, and they are written to the transcript as `source: 'scripted'`. A key
 * in the client's translation bundle could not do any of that, and splitting
 * the tutor's voice across two systems is how one half drifts.
 *
 * They are written to be true rather than soothing. A child who has just
 * disclosed something serious is not helped by a cheerful deflection.
 */

type Trilingual = Record<Locale, string>;

function turn(say: string, emotion: TutorTurn['emotion'], action: TutorTurn['action']): TutorTurn {
  return { say, emotion, action, next: 'ask', segmentRequest: null, offerAdaptation: null };
}

const SAFETY_LINES: Record<SafetyCategory, Trilingual> = {
  self_harm: {
    'en-US':
      'What you just said matters, and it is bigger than something I can help with. Please tell a grown-up you trust right now — a parent, a teacher, someone at home. I am going to stop our lesson here so you can do that.',
    'es-MX':
      'Lo que acabas de decir importa, y es más grande de lo que yo puedo ayudarte. Por favor dile ahora mismo a una persona adulta en la que confíes: tu mamá, tu papá, alguien de tu casa o de la escuela. Voy a detener nuestra clase aquí para que puedas hacerlo.',
    'pt-BR':
      'O que você acabou de dizer é importante, e é maior do que eu consigo ajudar. Por favor, conte agora para uma pessoa adulta em quem você confia: sua mãe, seu pai, alguém da sua casa ou da escola. Vou parar a nossa aula aqui para você poder fazer isso.',
  },
  abuse_disclosure: {
    'en-US':
      'Thank you for telling me. That is not okay and it is not your fault. Please tell a grown-up you trust — someone at school, or another adult at home. I am stopping our lesson here so you can go and do that.',
    'es-MX':
      'Gracias por contármelo. Eso no está bien y no es tu culpa. Por favor dile a una persona adulta en la que confíes: alguien de tu escuela, u otro adulto de tu casa. Voy a detener la clase aquí para que puedas hacerlo.',
    'pt-BR':
      'Obrigado por me contar. Isso não é certo e não é culpa sua. Por favor, conte para uma pessoa adulta em quem você confia: alguém da escola, ou outro adulto da sua casa. Vou parar a aula aqui para você poder fazer isso.',
  },
  adult_content: {
    'en-US': 'That is not something I can talk about. Shall we get back to what we were working on?',
    'es-MX': 'De eso no puedo hablar. ¿Regresamos a lo que estábamos viendo?',
    'pt-BR': 'Sobre isso eu não posso falar. Vamos voltar para o que estávamos vendo?',
  },
  grooming_pattern: {
    'en-US':
      'I never keep secrets from your family, and neither should anyone else. If someone has asked you to, please tell a grown-up at home. I am stopping our lesson here.',
    'es-MX':
      'Yo nunca guardo secretos de tu familia, y nadie más debería pedirte eso. Si alguien te lo pidió, por favor dile a una persona adulta de tu casa. Voy a detener la clase aquí.',
    'pt-BR':
      'Eu nunca guardo segredos da sua família, e ninguém deveria pedir isso a você. Se alguém pediu, por favor conte para uma pessoa adulta da sua casa. Vou parar a aula aqui.',
  },
  personal_data: {
    'en-US':
      'Careful — never tell me things like your address, phone or school. I do not need them, and they should stay private. Where were we?',
    'es-MX':
      'Cuidado: nunca me digas cosas como tu dirección, tu teléfono o tu escuela. No las necesito y deben quedarse privadas. ¿En qué íbamos?',
    'pt-BR':
      'Cuidado: nunca me diga coisas como seu endereço, telefone ou escola. Eu não preciso disso e deve ficar em segredo. Onde estávamos?',
  },
  injection_attempt: {
    'en-US': 'Nice try! I am just here to help you learn. Where were we?',
    'es-MX': '¡Buen intento! Yo nada más estoy aquí para ayudarte a aprender. ¿En qué íbamos?',
    'pt-BR': 'Boa tentativa! Eu só estou aqui para te ajudar a aprender. Onde estávamos?',
  },
};

const MODEL_DOWN: Trilingual = {
  'en-US': 'My thoughts got tangled for a moment. Give me a second and ask me again?',
  'es-MX': 'Se me enredaron las ideas un momento. ¿Me lo preguntas otra vez?',
  'pt-BR': 'Minhas ideias se embaralharam um instante. Pode me perguntar de novo?',
};

const MODERATION_BLOCKED: Trilingual = {
  'en-US': 'Let me say that a different way. What part would you like me to explain again?',
  'es-MX': 'Déjame decirlo de otra forma. ¿Qué parte quieres que te explique otra vez?',
  'pt-BR': 'Deixa eu dizer de outro jeito. Que parte você quer que eu explique de novo?',
};

const SOFT_CLOSE: Trilingual = {
  'en-US':
    'We have done good work today. Let us finish this last bit and I will let you go — you can come back whenever you want.',
  'es-MX':
    'Hoy trabajamos muy bien. Terminamos esta última parte y te dejo ir; puedes volver cuando quieras.',
  'pt-BR':
    'Hoje a gente trabalhou muito bem. Vamos terminar esta última parte e eu te deixo ir; você pode voltar quando quiser.',
};

const HARD_CLOSE: Trilingual = {
  'en-US': 'That is our time for today. You worked hard — I will be here when you come back.',
  'es-MX': 'Hasta aquí llegamos por hoy. Te esforzaste mucho; aquí voy a estar cuando regreses.',
  'pt-BR': 'Por hoje é isso. Você se esforçou bastante; vou estar aqui quando você voltar.',
};

const CONSENT_REVOKED: Trilingual = {
  'en-US': 'We are switching off the microphone. You can keep going by tapping your answers.',
  'es-MX': 'Vamos a apagar el micrófono. Puedes seguir tocando tus respuestas.',
  'pt-BR': 'Vamos desligar o microfone. Você pode continuar tocando nas suas respostas.',
};

const GREETING_FALLBACK: Trilingual = {
  'en-US': 'Hello! Good to see you. What would you like to work on today?',
  'es-MX': '¡Hola! Qué gusto verte. ¿En qué te gustaría trabajar hoy?',
  'pt-BR': 'Oi! Que bom te ver. No que você quer trabalhar hoje?',
};

export function safetyResponse(category: SafetyCategory, locale: Locale): TutorTurn {
  const stopping = category === 'self_harm' || category === 'abuse_disclosure' || category === 'grooming_pattern';
  const line = SAFETY_LINES[category][locale];
  return {
    say: line,
    emotion: stopping ? 'encouraging' : 'neutral',
    action: stopping ? 'nod' : 'idle',
    next: stopping ? 'close' : 'ask',
    segmentRequest: null,
    offerAdaptation: null,
  };
}

export function modelDownResponse(locale: Locale): TutorTurn {
  return turn(MODEL_DOWN[locale], 'thinking', 'think');
}

export function moderationBlockedResponse(locale: Locale): TutorTurn {
  return turn(MODERATION_BLOCKED[locale], 'encouraging', 'nod');
}

export function consentRevokedResponse(locale: Locale): TutorTurn {
  return turn(CONSENT_REVOKED[locale], 'neutral', 'nod');
}

export function greetingFallback(locale: Locale): TutorTurn {
  return turn(GREETING_FALLBACK[locale], 'happy', 'wave');
}

export function closingResponse(locale: Locale, kind: 'soft' | 'hard'): TutorTurn {
  return {
    say: kind === 'soft' ? SOFT_CLOSE[locale] : HARD_CLOSE[locale],
    emotion: 'proud',
    action: kind === 'soft' ? 'nod' : 'wave',
    next: 'close',
    segmentRequest: null,
    offerAdaptation: null,
  };
}
