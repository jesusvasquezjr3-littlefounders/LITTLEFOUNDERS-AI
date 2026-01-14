/**
 * IntroNarrativeStage - Muestra una narración con el personaje
 */
import { DinoCharacter, DinoMood } from '@/components/demo/DinoCharacter';
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
                className="mt-4 gap-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all"
            >
                Continuar
                <ArrowRight className="w-5 h-5" />
            </Button>
        </div>
    );
}
