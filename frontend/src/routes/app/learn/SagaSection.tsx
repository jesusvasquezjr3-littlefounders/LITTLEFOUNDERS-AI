import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, IconChip, ProgressBar } from '@/components/ui';
import type { CharacterId } from '@/components/characters/control/types';
import { LessonPathNode } from './LessonPathNode';
import { localizedText, type SagaNode } from './types';

/*
 * One saga: icon chip + title + progress header, then its topics threaded
 * into ONE continuous winding lesson path — the v1 "caminito"
 * (main:frontend/src/components/lessons/LessonPath.tsx): nodes weave left
 * and right on a fixed wave pattern, connected by a fat rounded bezier
 * track drawn from the nodes' LIVE on-screen centers (getBoundingClientRect,
 * recomputed on resize/layout settle), with a dashed inner guide line and
 * canon characters decorating the wave peaks.
 */

// v1 wave (px). Clamped by the container's width on small screens via the
// scale factor below, so ±70 never overflows a 375px viewport.
const WAVE_PATTERN = [0, -45, -70, -45, 0, 45, 70, 45] as const;

/** Ambient mascots on wave peaks — same rotation v1 used on patternIndex 2/6. */
const PEAK_CHARACTERS: CharacterId[] = ['liruf', 'dina', 'zara', 'rho'];

interface SagaSectionProps {
  saga: SagaNode;
  locale: string;
  courseSlug: string;
  nextLessonId: string | null;
  registerNodeRef: (lessonId: string, el: HTMLElement | null) => void;
}

export function SagaSection({ saga, locale, courseSlug, nextLessonId, registerNodeRef }: SagaSectionProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef(new Map<string, HTMLElement>());
  const [pathD, setPathD] = useState('');
  const [pathSize, setPathSize] = useState({ w: 0, h: 0 });

  const allLessons = saga.topics.flatMap((topic) => topic.lessons);
  const lessonIdsKey = allLessons.map((l) => l.id).join(',');

  // Rebuild the connector from live node centers (v1's PathLine technique):
  // container-relative cubic beziers whose control points sit at the vertical
  // midpoint between consecutive nodes — a smooth S-curve per hop.
  const rebuildPath = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    const points = lessonIdsKey
      .split(',')
      .map((id) => nodeRefs.current.get(id))
      .filter((el): el is HTMLElement => Boolean(el))
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2 - cRect.left, y: r.top + r.height / 2 - cRect.top };
      });
    if (points.length < 2) {
      setPathD('');
      return;
    }
    let d = `M ${points[0]!.x} ${points[0]!.y} `;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]!;
      const p = points[i]!;
      const cpY = (prev.y + p.y) / 2;
      d += `C ${prev.x} ${cpY}, ${p.x} ${cpY}, ${p.x} ${p.y} `;
    }
    setPathD(d);
    setPathSize({ w: cRect.width, h: cRect.height });
  }, [lessonIdsKey]);

  useEffect(() => {
    rebuildPath();
    // Layout settles asynchronously (fonts, images, sibling banners) — the
    // v1 component re-measured on the same staggered timeouts.
    const timeouts = [100, 500, 1000].map((ms) => setTimeout(rebuildPath, ms));
    window.addEventListener('resize', rebuildPath);
    return () => {
      timeouts.forEach(clearTimeout);
      window.removeEventListener('resize', rebuildPath);
    };
  }, [rebuildPath]);

  const setNodeRef = useCallback(
    (lessonId: string) => (el: HTMLElement | null) => {
      if (el) nodeRefs.current.set(lessonId, el);
      else nodeRefs.current.delete(lessonId);
      registerNodeRef(lessonId, el);
    },
    [registerNodeRef],
  );

  let flatIndex = 0;

  return (
    <section className="mt-8 first:mt-0">
      <div className="mb-5 flex items-center gap-3">
        <IconChip size="md">
          <Icon name={saga.icon || 'flag'} />
        </IconChip>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="lf-title text-content">{localizedText(saga.title, locale, saga.slug)}</h3>
            <span className="lf-caption lf-number shrink-0 font-bold text-content-muted">
              {t('learn.lessonsProgress', { passed: saga.progress.passed, total: saga.progress.total })}
            </span>
          </div>
          <ProgressBar
            value={saga.progress.pct}
            tone="accent"
            label={t('learn.lessonsProgress', { passed: saga.progress.passed, total: saga.progress.total })}
            className="mt-1.5"
          />
        </div>
      </div>

      <div ref={containerRef} className="relative mx-auto flex max-w-xl flex-col gap-7 pb-4">
        {/* The winding track — fat rounded path + dashed inner guide (v1). */}
        {pathD && (
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0"
            width={pathSize.w}
            height={pathSize.h}
            viewBox={`0 0 ${pathSize.w} ${pathSize.h}`}
            fill="none"
          >
            <path d={pathD} strokeWidth="26" strokeLinecap="round" className="stroke-surface-sunken" />
            <path d={pathD} strokeWidth="6" strokeLinecap="round" strokeDasharray="1 18" className="stroke-outline" />
          </svg>
        )}

        {saga.topics.map((topic) => (
          <div key={topic.id} className="relative z-10 flex flex-col gap-7">
            <p className="lf-label self-center rounded-full border border-outline/60 bg-surface px-3 py-1 text-content-muted shadow-glass-sm">
              {localizedText(topic.title, locale, topic.slug)}
            </p>
            {topic.lessons.map((lesson) => {
              const i = flatIndex++;
              const patternIndex = i % WAVE_PATTERN.length;
              const isPeak = patternIndex === 2 || patternIndex === 6;
              const peakCharacter = PEAK_CHARACTERS[Math.floor(i / 4) % PEAK_CHARACTERS.length]!;
              return (
                <LessonPathNode
                  key={lesson.id}
                  lesson={lesson}
                  locale={locale}
                  courseSlug={courseSlug}
                  waveOffset={WAVE_PATTERN[patternIndex]!}
                  peakCharacter={isPeak ? peakCharacter : null}
                  peakSide={patternIndex === 2 ? 'right' : 'left'}
                  isNextLesson={lesson.id === nextLessonId}
                  registerRef={setNodeRef(lesson.id)}
                />
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
