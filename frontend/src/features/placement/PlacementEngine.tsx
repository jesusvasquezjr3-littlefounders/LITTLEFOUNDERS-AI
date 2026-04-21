import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { updateGuestProfile } from '@/lib/guestProfile';
import type { PlacementState } from './types';
import { ageToAdventure, selectNextItem, shouldStop, computePlacementResult } from './scoring/engine';
import { PlacementIntroScreen } from './components/PlacementIntroScreen';
import { PlacementQuestion } from './components/PlacementQuestion';
import { PlacementProgressBar } from './components/PlacementProgressBar';
import { PlacementClosingScreen } from './components/PlacementClosingScreen';

const MAX_ITEMS = 12;

// ─── Ambient orbs (reusing onboarding style) ─────────────────────────────────

function DriftingOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full blur-[120px] animate-orb-1 bg-violet-400 dark:bg-violet-600 opacity-25 dark:opacity-30 transition-colors duration-[1200ms]" />
      <div className="absolute -bottom-40 -right-32 w-[420px] h-[420px] rounded-full blur-[100px] animate-orb-2 bg-indigo-300 dark:bg-indigo-500 opacity-20 dark:opacity-25 transition-colors duration-[1200ms]" />
      <div className="absolute top-1/2 left-1/3 w-[300px] h-[300px] rounded-full blur-[90px] animate-orb-3 bg-violet-400 opacity-10 dark:opacity-15" />
    </div>
  );
}

// ─── Main engine ─────────────────────────────────────────────────────────────

interface Props {
  name: string;
  age: number;
}

export function PlacementEngine({ name, age }: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation('placement');
  const baseAdventure = ageToAdventure(age);

  const [state, setState] = useState<PlacementState>({
    phase: 'intro',
    baseAdventure,
    startedAt: Date.now(),
    servedIds: [],
    responses: [],
    currentItem: null,
    skipped: false,
    result: null,
  });

  // ── Load first item when quiz starts ────────────────────────────────────
  const loadNextItem = useCallback((currentState: PlacementState) => {
    const next = selectNextItem(
      currentState.servedIds,
      currentState.responses,
      currentState.baseAdventure,
    );

    if (!next || shouldStop(currentState.servedIds.length, currentState.responses, MAX_ITEMS)) {
      // Enough data — compute result and close
      const result = computePlacementResult(
        currentState.responses,
        currentState.servedIds,
        currentState.baseAdventure,
        age,
        currentState.startedAt,
      );
      saveResult(result, false);
      setState(prev => ({ ...prev, phase: 'closing', result, currentItem: null }));
    } else {
      setState(prev => ({
        ...prev,
        currentItem: next,
        servedIds: [...prev.servedIds, next.id],
      }));
    }
  }, [age]);

  // ── Persist result to guest profile ─────────────────────────────────────
  function saveResult(result: import('@/lib/guestProfile').PlacementResult, skipped: boolean) {
    const finalResult = { ...result, skipped };
    updateGuestProfile({
      placement: finalResult,
      placement_adventure: finalResult.finalAdventure,
      next_lesson_code: finalResult.skipped ? null : finalResult.targetLessonCode,
    });
  }

  // ── Handle intro actions ─────────────────────────────────────────────────
  function handleAccept() {
    setState(prev => {
      const next = selectNextItem([], [], prev.baseAdventure);
      if (!next) {
        // No items available (shouldn't happen) — go to closing with skip
        return { ...prev, phase: 'closing', skipped: true };
      }
      return {
        ...prev,
        phase: 'quiz',
        startedAt: Date.now(),
        servedIds: [next.id],
        currentItem: next,
      };
    });
  }

  function handleSkip() {
    // Skip: save a skipped result pointing to saga 1 of base adventure
    const skippedResult: import('@/lib/guestProfile').PlacementResult = {
      version: 1,
      takenAt: new Date().toISOString(),
      durationSec: 0,
      ageDeclared: age,
      baseAdventure,
      finalAdventure: baseAdventure,
      finalSaga: 1,
      targetLessonCode: `${baseAdventure}-1-1-1`,
      overallScore: 0,
      confidence: 0,
      skipped: true,
      itemsServed: [],
      itemsCorrect: [],
    };
    saveResult(skippedResult, true);
    setState(prev => ({ ...prev, phase: 'closing', skipped: true, result: skippedResult }));
  }

  // ── Handle answer ────────────────────────────────────────────────────────
  function handleAnswer(correct: boolean, timeSec: number) {
    setState(prev => {
      const newResponses = [...prev.responses, { itemId: prev.currentItem!.id, correct, timeSec }];
      const newState = { ...prev, responses: newResponses, currentItem: null };

      // Check stop condition
      if (shouldStop(newState.servedIds.length, newResponses, MAX_ITEMS)) {
        const result = computePlacementResult(
          newResponses,
          newState.servedIds,
          newState.baseAdventure,
          age,
          newState.startedAt,
        );
        saveResult(result, false);
        return { ...newState, phase: 'closing', result };
      }

      return newState;
    });
  }

  // ── Load next item after answer ──────────────────────────────────────────
  useEffect(() => {
    if (state.phase === 'quiz' && state.currentItem === null) {
      // Small visual pause before next question
      const timer = setTimeout(() => {
        loadNextItem(state);
      }, 950);
      return () => clearTimeout(timer);
    }
  }, [state.currentItem, state.phase, state.servedIds.length]);

  // ── Exit during quiz → treat as skip ────────────────────────────────────
  function handleExit() {
    handleSkip();
  }

  // ── Navigate after closing ───────────────────────────────────────────────
  function handleContinue() {
    navigate('/learn');
  }

  // ── Background gradient by phase ────────────────────────────────────────
  const bgClass = state.phase === 'closing'
    ? 'from-emerald-100 via-teal-50 to-blue-100 dark:from-[#032b1a] dark:via-[#073b28] dark:to-[#0d1b4b]'
    : 'from-violet-100 via-indigo-50 to-blue-100 dark:from-[#1a0938] dark:via-[#1e0f5c] dark:to-[#0d1b4b]';

  return (
    <div
      className={cn(
        'min-h-screen flex flex-col items-center relative overflow-hidden',
        'bg-gradient-to-br transition-all duration-[1100ms]',
        bgClass,
      )}
    >
      <DriftingOrbs />

      {/* Top rim */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.5) 40%,rgba(255,255,255,0.7) 60%,transparent)' }}
      />

      {/* Progress bar — during quiz and closing */}
      {(state.phase === 'quiz' || state.phase === 'closing') && (
        <PlacementProgressBar
          current={state.servedIds.length}
          max={MAX_ITEMS}
          isFinishing={state.phase === 'closing'}
        />
      )}

      {/* Exit button — only during quiz */}
      {state.phase === 'quiz' && (
        <button
          type="button"
          onClick={handleExit}
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-black/8 dark:bg-white/10 hover:bg-black/15 dark:hover:bg-white/20 transition-colors"
          aria-label={t('quiz.exit_aria')}
        >
          <X className="w-4 h-4 text-gray-500 dark:text-white/60" />
        </button>
      )}

      {/* Content */}
      <div className="flex-1 w-full flex flex-col items-center justify-center px-4 py-8 gap-6 max-w-lg mx-auto">

        {state.phase === 'intro' && (
          <PlacementIntroScreen
            name={name}
            onAccept={handleAccept}
            onSkip={handleSkip}
          />
        )}

        {state.phase === 'quiz' && state.currentItem && (
          <PlacementQuestion
            key={state.currentItem.id}
            item={state.currentItem}
            itemNumber={state.servedIds.length}
            onAnswer={handleAnswer}
          />
        )}

        {state.phase === 'quiz' && !state.currentItem && (
          /* Between questions — brief empty state */
          <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        )}

        {state.phase === 'closing' && (
          <PlacementClosingScreen
            result={state.result}
            name={name}
            onContinue={handleContinue}
          />
        )}
      </div>

      <div className="h-6 shrink-0" />
    </div>
  );
}
