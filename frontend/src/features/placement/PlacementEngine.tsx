import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { updateGuestProfile } from '@/lib/guestProfile';
import { trackEvent } from '@/lib/analytics';
import DrRhoCharacter from '@/components/characters/DrRhoCharacter';
import { DinoCharacter } from '@/components/characters/DinoCharacter';
import type { PlacementState } from './types';
import { ageToAdventure, selectNextItem, shouldStop, computePlacementResult } from './scoring/engine';
import { PlacementIntroScreen } from './components/PlacementIntroScreen';
import { PlacementQuestion } from './components/PlacementQuestion';
import { PlacementProgressBar } from './components/PlacementProgressBar';
import { PlacementClosingScreen } from './components/PlacementClosingScreen';

const MAX_ITEMS = 12;

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
      trackEvent('placement_quiz_completed', {
        items_served: currentState.servedIds.length,
        items_correct: result.itemsCorrect.length,
        overall_score: result.overallScore,
        confidence: result.confidence,
        base_adventure: result.baseAdventure,
        final_adventure: result.finalAdventure,
        final_saga: result.finalSaga,
        target_lesson_code: result.targetLessonCode,
        duration_sec: result.durationSec,
        age_declared: result.ageDeclared,
      });
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
      next_lesson_code: finalResult.targetLessonCode,
    });
  }

  // ── Handle intro actions ─────────────────────────────────────────────────
  function handleAccept() {
    trackEvent('placement_started', {
      base_adventure: baseAdventure,
      age,
    });
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

  function handleSkip(source: 'intro' | 'exit' = 'intro') {
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
    trackEvent('placement_skipped', {
      source,
      base_adventure: baseAdventure,
      age,
    });
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
        trackEvent('placement_quiz_completed', {
          items_served: newState.servedIds.length,
          items_correct: result.itemsCorrect.length,
          overall_score: result.overallScore,
          confidence: result.confidence,
          base_adventure: result.baseAdventure,
          final_adventure: result.finalAdventure,
          final_saga: result.finalSaga,
          target_lesson_code: result.targetLessonCode,
          duration_sec: result.durationSec,
          age_declared: result.ageDeclared,
        });
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
    trackEvent('placement_exited_early', {
      items_answered: state.responses.length,
      items_served: state.servedIds.length,
      base_adventure: baseAdventure,
    });
    handleSkip('exit');
  }

  // ── Navigate after closing ───────────────────────────────────────────────
  function handleContinue() {
    trackEvent('placement_continue_to_learn', {
      skipped: state.skipped,
      target_lesson_code: state.result?.targetLessonCode ?? null,
      final_adventure: state.result?.finalAdventure ?? baseAdventure,
      final_saga: state.result?.finalSaga ?? 1,
    });
    if (state.skipped && state.result?.targetLessonCode) {
      navigate(`/lesson/${state.result.targetLessonCode}`);
    } else {
      navigate('/learn');
    }
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-slate-50 dark:bg-[#0a0e1a]">

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
          className="absolute top-4 right-4 z-20 w-9 h-9 flex items-center justify-center rounded-full bg-slate-200/70 dark:bg-white/10 hover:bg-slate-300/70 dark:hover:bg-white/20 transition-colors duration-150 active:scale-95"
          aria-label={t('quiz.exit_aria')}
        >
          <X className="w-4 h-4 text-slate-500 dark:text-white/60" />
        </button>
      )}

      {/* Content — Lesson Engine grid: character left on desktop */}
      <div className="relative z-10 flex-1 flex flex-col lg:flex-row items-center justify-center px-4 pb-8 pt-4 lg:gap-8 max-w-7xl mx-auto w-full overflow-y-auto min-h-0">

        {/* Left column: Character */}
        <div className="w-full lg:w-[38%] flex flex-col items-center justify-center flex-shrink-0 lg:sticky lg:top-0 lg:h-full">
          {state.phase === 'intro' && (
            <div className="w-48 h-48 sm:w-56 sm:h-56 lg:w-64 lg:h-64 relative z-10 drop-shadow-xl animate-in fade-in zoom-in-95 duration-300">
              <DrRhoCharacter mood="explaining" showBubble currentText={t('intro.rho_bubble', { name })} bubblePosition="top" />
            </div>
          )}
          {state.phase === 'closing' && (
            <div className="w-56 h-56 sm:w-64 sm:h-64 lg:w-72 lg:h-72 relative z-10 drop-shadow-xl animate-in fade-in zoom-in-95 duration-300">
              <DinoCharacter mood="excited" showBubble currentText={t('closing.liruf_bubble', { name, adventure: state.result?.finalAdventure ?? '-', saga: state.result?.finalSaga ?? '-' })} bubblePosition="standard" />
            </div>
          )}
        </div>

        {/* Right column: Content */}
        <div className="w-full lg:w-[62%] flex flex-col items-center justify-center lg:min-h-0 max-w-lg mx-auto lg:mx-0">

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
      </div>

      <div className="h-6 shrink-0" />
    </div>
  );
}
