/**
 * IntroNarrativeStage - Muestra una narración con el personaje
 */
import { DinoCharacter, DinoMood } from '@/components/characters/DinoCharacter';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import type { ExerciseData } from '../hooks/useLessonData';

interface IntroNarrativeStageProps {
    exercise: ExerciseData;
    onComplete: () => void;
}

export function IntroNarrativeStage({ exercise, onComplete }: IntroNarrativeStageProps) {
    const content = exercise.content;
    const mood = (content.emotion || 'happy') as DinoMood;
    const text = content.transcript || '';

    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 animate-fadeIn">
            {/* Personaje - usando DinoCharacter para todos */}
            <div className="mb-8">
                <DinoCharacter
                    currentText={text}
                    showBubble={true}
                    mood={mood}
                    bubblePosition="standard"
                />
            </div>

            {/* Botón continuar */}
            <Button
                size="lg"
                onClick={onComplete}
                className="mt-4 gap-2 bg-green-500 hover:bg-green-600 text-white font-bold px-8 h-14 sm:h-16 text-lg sm:text-xl rounded-2xl shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all"
            >
                Continuar
                <ArrowRight className="w-5 h-5" />
            </Button>
        </div>
    );
}
