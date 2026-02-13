/**
 * Transforma el JSON editado al formato que espera el LessonRunner.
 * El LessonRunner NO consume directamente content_es/content_en.
 * Espera una estructura LessonData con timeline transformado.
 */

export interface RawExercise {
  type: string;
  character_code?: string;
  content: Record<string, any>;
  correct_answer?: Record<string, any>;
  feedback?: { success: string; error: string };
}

export interface LessonJSON {
  id?: number;
  lesson_code: string;
  title_es: string;
  title_en: string;
  description_es?: string;
  description_en?: string;
  duration?: number;
  points_reward: number;
  adventure_level: number;
  saga_level: number;
  topic_level: number;
  lesson_number: number;
  content_es: RawExercise[];
  content_en: RawExercise[];
}

export interface ExerciseData {
  id: number;
  type: string;
  order_index: number;
  character_code?: string;
  start_time_ms: number;
  pause_at_ms?: number;
  content: Record<string, any>;
  correct_answer?: Record<string, any> | null;
  feedback?: { success: string; error: string } | null;
  points: number;
  audio?: {
    url: string;
    duration_ms?: number;
    transcript?: string;
  };
}

export interface LessonData {
  lesson: {
    id: number;
    code: string;
    title: string;
    description?: string;
    saga?: string;
    adventure?: string;
    topic?: string;
    language?: string;
  };
  meta: {
    estimated_duration_seconds: number;
    points_reward: number;
    xp_reward: number;
  };
  timeline: ExerciseData[];
}

const normalizeCharCode = (code?: string): string | undefined => {
  if (!code) return undefined;
  const map: Record<string, string> = {
    drrho: "dr_rho",
    DrRho: "dr_rho",
    zaravex: "zara_vex",
    ZaraVex: "zara_vex",
  };
  return map[code] || code;
};

export function transformToTimeline(
  lessonJSON: LessonJSON,
  language: "es" | "en" = "es"
): LessonData {
  const content = language === "es" ? lessonJSON.content_es : lessonJSON.content_en;
  const title = language === "es" ? lessonJSON.title_es : lessonJSON.title_en;
  const description = language === "es" ? lessonJSON.description_es : lessonJSON.description_en;
  const pointsPerExercise = Math.floor(
    lessonJSON.points_reward / Math.max(content?.length || 1, 1)
  );

  const timeline: ExerciseData[] = (content || []).map((exercise, index) => ({
    id: index + 1,
    type: exercise.type,
    order_index: index,
    character_code: normalizeCharCode(exercise.character_code),
    start_time_ms: 0,
    content: exercise.content || {},
    correct_answer: exercise.correct_answer || null,
    feedback: exercise.feedback || null,
    points: pointsPerExercise,
    audio: undefined,
  }));

  return {
    lesson: {
      id: lessonJSON.id || 0,
      code: lessonJSON.lesson_code,
      title,
      description,
      language,
    },
    meta: {
      estimated_duration_seconds: (lessonJSON.duration || 180),
      points_reward: lessonJSON.points_reward,
      xp_reward: 25,
    },
    timeline,
  };
}
