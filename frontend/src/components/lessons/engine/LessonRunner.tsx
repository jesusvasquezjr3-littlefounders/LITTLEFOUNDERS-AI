/**
 * LessonRunner - Motor de Lecciones Dinámico
 * 
 * Diseño UI/UX inspirado en Duolingo:
 * - Header minimalista con progress bar y vidas
 * - Personaje centrado con burbuja de diálogo
 * - Opciones grandes y táctiles
 * - Botón de acción prominente
 * - Modo claro/oscuro 100% compatible
 * - Mobile-first responsive
 */
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DinoCharacter, DinoMood } from '@/components/demo/DinoCharacter';
import { DinaCharacter } from '@/components/demo/DinaCharacter';
import { useLessonData, useLessonState } from './hooks';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
    X,
    Heart,
    Trophy,
    Star,
    Loader2,
    AlertCircle,
    Check,
    ArrowRight,
    PartyPopper,
    Volume2,
    VolumeX
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils';

interface LessonRunnerProps {
    lessonCode?: string;
}

export function LessonRunner({ lessonCode: propLessonCode }: LessonRunnerProps) {
    const params = useParams<{ lessonCode: string }>();
    const navigate = useNavigate();
    const code = propLessonCode || params.lessonCode || '';

    // Audio ref
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const [audioMuted, setAudioMuted] = useState(false);

    // Fetch lesson data
    const { data, loading, error } = useLessonData(code);

    // Lesson state machine
    const {
        state,
        currentExerciseIndex,
        currentExercise,
        totalExercises,
        progress,
        results,
        startLesson,
        submitAnswer,
        nextExercise,
        retryExercise
    } = useLessonState(data);

    // Lives system (Duolingo style)
    const [lives, setLives] = useState(5);

    // UI states
    const [showSuccess, setShowSuccess] = useState(false);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [isChecked, setIsChecked] = useState(false);
    const [localFeedback, setLocalFeedback] = useState<'none' | 'success' | 'error'>('none');

    // Get mood based on state (for Liruf)
    const getMood = (): DinoMood => {
        if (localFeedback === 'success') return 'excited';
        if (localFeedback === 'error') return 'thinking';
        return 'happy';
    };

    // Get expression based on state (for Dina)
    const getDinaExpression = (): 'neutral' | 'happy' | 'surprised' | 'wink' => {
        if (localFeedback === 'success') return 'happy';
        if (localFeedback === 'error') return 'surprised';
        return 'neutral';
    };

    // Get current character code from exercise
    const getCharacterCode = (): string => {
        return currentExercise?.character_code || 'liruf';
    };

    // Get current text to display
    const getCurrentText = (): string => {
        if (!currentExercise) return '';
        if (localFeedback === 'success' && currentExercise.feedback?.success) {
            return currentExercise.feedback.success;
        }
        if (localFeedback === 'error' && currentExercise.feedback?.error) {
            return currentExercise.feedback.error;
        }
        return currentExercise.content.question || currentExercise.content.transcript || '';
    };

    // Handle audio playback
    useEffect(() => {
        if (currentExercise?.audio?.url && state === 'PLAYING' && !audioMuted) {
            const audio = audioRef.current;
            if (audio) {
                audio.src = currentExercise.audio.url;
                audio.play().catch(console.log);
                setIsAudioPlaying(true);
            }
        }
    }, [currentExercise, state, audioMuted]);

    // Handle audio end
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleEnded = () => {
            setIsAudioPlaying(false);
            if (currentExercise?.type === 'intro_narrative') {
                setTimeout(nextExercise, 500);
            }
        };

        audio.addEventListener('ended', handleEnded);
        return () => audio.removeEventListener('ended', handleEnded);
    }, [currentExercise, nextExercise]);

    // Celebration on complete
    useEffect(() => {
        if (state === 'COMPLETED') {
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, zIndex: 100 });
            setTimeout(() => setShowSuccess(true), 1000);
        }
    }, [state]);

    // Reset states when exercise changes
    useEffect(() => {
        setSelectedOption(null);
        setIsChecked(false);
        setLocalFeedback('none');
    }, [currentExerciseIndex]);

    // Handle option selection
    const handleSelectOption = (optionId: string) => {
        if (isChecked) return;
        setSelectedOption(optionId);
    };

    // Handle check answer
    const handleCheckAnswer = () => {
        if (!selectedOption || !currentExercise) return;
        const isCorrect = submitAnswer(selectedOption);
        setIsChecked(true);
        setLocalFeedback(isCorrect ? 'success' : 'error');

        if (isCorrect) {
            confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
        } else {
            setLives(prev => Math.max(0, prev - 1));
        }
    };

    // Handle continue after answer
    const handleContinue = () => {
        if (localFeedback === 'error') {
            // Reset para reintentar
            setSelectedOption(null);
            setIsChecked(false);
            setLocalFeedback('none');
            retryExercise(); // Resetear estado del hook también
        } else if (localFeedback === 'success') {
            // Avanzar al siguiente ejercicio
            nextExercise();
        }
    };

    // Close lesson
    const handleClose = () => navigate(-1);

    // ============ LOADING STATE ============
    if (loading) {
        return (
            <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-16 h-16 text-primary animate-spin" />
                <p className="text-lg text-muted-foreground font-medium">Cargando lección...</p>
            </div>
        );
    }

    // ============ ERROR STATE ============
    if (error || !data) {
        return (
            <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-4 p-6">
                <AlertCircle className="w-16 h-16 text-destructive" />
                <p className="text-lg text-destructive font-medium text-center">
                    {error || 'Error al cargar la lección'}
                </p>
                <Button variant="outline" onClick={handleClose} className="mt-4">
                    Volver
                </Button>
            </div>
        );
    }

    // ============ IDLE STATE - START SCREEN ============
    if (state === 'IDLE') {
        return (
            <div className="fixed inset-0 bg-gradient-to-b from-primary/10 via-background to-background flex flex-col">
                <audio ref={audioRef} preload="auto" />

                {/* Header */}
                <div className="flex items-center justify-between p-4">
                    <button
                        onClick={handleClose}
                        className="w-10 h-10 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors"
                    >
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                    <span className="text-sm font-medium text-muted-foreground">
                        {data.lesson.saga}
                    </span>
                    <div className="w-10" /> {/* Spacer */}
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
                    {/* Character - Use first exercise's character_code */}
                    <div className="mb-8 animate-bounce-in">
                        {data.timeline[0]?.character_code === 'dina' ? (
                            <DinaCharacter
                                className="w-full max-w-[280px]"
                                expression="happy"
                            />
                        ) : (
                            <DinoCharacter
                                className="w-full max-w-[280px]"
                                showBubble={false}
                                mood="excited"
                            />
                        )}
                    </div>

                    {/* Lesson Info */}
                    <div className="text-center max-w-sm">
                        <h1 className="text-3xl font-bold text-foreground mb-3">
                            {data.lesson.title}
                        </h1>
                        <p className="text-muted-foreground mb-6">
                            {data.lesson.description}
                        </p>

                        {/* Rewards */}
                        <div className="flex justify-center gap-4 mb-8">
                            <div className="flex items-center gap-2 bg-yellow-500/10 dark:bg-yellow-500/20 px-4 py-2 rounded-full">
                                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                                <span className="font-bold text-yellow-600 dark:text-yellow-400">
                                    {data.meta.points_reward} pts
                                </span>
                            </div>
                            <div className="flex items-center gap-2 bg-purple-500/10 dark:bg-purple-500/20 px-4 py-2 rounded-full">
                                <Trophy className="w-5 h-5 text-purple-500" />
                                <span className="font-bold text-purple-600 dark:text-purple-400">
                                    {data.meta.xp_reward} XP
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Start Button */}
                    <Button
                        onClick={startLesson}
                        size="lg"
                        className="w-full max-w-sm h-14 text-lg font-bold bg-success hover:bg-success/90 text-success-foreground rounded-2xl shadow-[0_4px_0_hsl(var(--success)/0.7)] hover:shadow-[0_2px_0_hsl(var(--success)/0.7)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all"
                    >
                        EMPEZAR
                    </Button>
                </div>
            </div>
        );
    }

    // ============ ACTIVE LESSON ============
    const correctId = currentExercise?.correct_answer?.correctOptionId;
    const exerciseNumber = `${currentExerciseIndex + 1}/${totalExercises}`;

    return (
        <div className="fixed inset-0 bg-background flex flex-col">
            <audio ref={audioRef} preload="auto" />

            {/* ===== TOP BAR ===== */}
            <div className="flex items-center gap-3 p-4 pb-2">
                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="w-9 h-9 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors flex-shrink-0"
                >
                    <X className="w-4 h-4 text-muted-foreground" />
                </button>

                {/* Progress Bar */}
                <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary rounded-full transition-all duration-500 ease-out relative"
                        style={{ width: `${progress}%` }}
                    >
                        <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]" />
                    </div>
                </div>

                {/* Exercise Counter */}
                <span className="text-sm font-bold text-muted-foreground min-w-[40px] text-center">
                    {exerciseNumber}
                </span>

                {/* Lives */}
                <div className="flex items-center gap-1 bg-destructive/10 dark:bg-destructive/20 px-3 py-1.5 rounded-full">
                    <Heart className="w-4 h-4 text-destructive fill-destructive" />
                    <span className="text-sm font-bold text-destructive">{lives}</span>
                </div>

                {/* Audio Toggle */}
                <button
                    onClick={() => setAudioMuted(!audioMuted)}
                    className="w-9 h-9 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors"
                >
                    {audioMuted ? (
                        <VolumeX className="w-4 h-4 text-muted-foreground" />
                    ) : (
                        <Volume2 className="w-4 h-4 text-muted-foreground" />
                    )}
                </button>
            </div>

            {/* ===== MAIN CONTENT ===== */}
            <div className="flex-1 flex flex-col items-center justify-center px-4 pb-4 overflow-y-auto">

                {/* Speech Bubble - SEPARATE from character, positioned above */}
                <div className="w-full max-w-md mb-4">
                    <div className="relative bg-card rounded-3xl shadow-lg border border-border p-5 mx-4">
                        <p className="text-center text-lg font-medium text-foreground leading-relaxed">
                            {getCurrentText()}
                        </p>
                        {/* Tail pointing down to character */}
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
                            <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[12px] border-t-card" />
                        </div>
                    </div>
                </div>

                {/* Character - WITHOUT bubble, fully visible */}
                <div className="mb-4">
                    {getCharacterCode() === 'dina' ? (
                        <DinaCharacter
                            className="w-[250px] h-[250px] mx-auto"
                            expression={getDinaExpression()}
                        />
                    ) : (
                        <DinoCharacter
                            className="w-[250px] h-[250px] mx-auto"
                            showBubble={false}
                            mood={getMood()}
                        />
                    )}
                </div>

                {/* ===== INTRO NARRATIVE ===== */}
                {currentExercise?.type === 'intro_narrative' && (
                    <div className="w-full max-w-lg animate-slide-in-bottom">
                        {isAudioPlaying && (
                            <div className="flex items-center justify-center gap-2 mb-4 text-muted-foreground">
                                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                                <span className="text-sm font-medium">Escuchando...</span>
                            </div>
                        )}

                        <Button
                            onClick={nextExercise}
                            disabled={isAudioPlaying}
                            className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90 rounded-2xl shadow-[0_4px_0_hsl(var(--primary)/0.7)] hover:shadow-[0_2px_0_hsl(var(--primary)/0.7)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50"
                        >
                            CONTINUAR
                        </Button>
                    </div>
                )}

                {/* ===== MULTIPLE CHOICE ===== */}
                {currentExercise?.type === 'multiple_choice' && (
                    <div className="w-full max-w-lg animate-slide-in-bottom">

                        {/* Options */}
                        <div className="space-y-3 mb-6">
                            {currentExercise.content.options?.map((option) => {
                                const isSelected = selectedOption === option.id;
                                const isCorrect = option.id === correctId;
                                const showResult = isChecked;

                                return (
                                    <button
                                        key={option.id}
                                        onClick={() => handleSelectOption(option.id)}
                                        disabled={isChecked}
                                        className={cn(
                                            "w-full p-4 rounded-2xl border-2 text-left transition-all duration-200",
                                            "font-semibold text-lg",
                                            "active:scale-[0.98]",
                                            // Default state
                                            !showResult && !isSelected && "bg-card border-border hover:border-primary/50 hover:bg-primary/5 dark:hover:bg-primary/10",
                                            // Selected state (before verification)
                                            !showResult && isSelected && "bg-primary/10 border-primary dark:bg-primary/20 ring-2 ring-primary/30",
                                            // ✅ SUCCESS: User selected correct - bright green glow
                                            showResult && isSelected && isCorrect && "bg-success/20 border-success dark:bg-success/30 ring-4 ring-success/40 shadow-[0_0_20px_rgba(34,197,94,0.4)]",
                                            // ❌ ERROR: User selected wrong - red
                                            showResult && isSelected && !isCorrect && "bg-destructive/10 border-destructive dark:bg-destructive/20",
                                            // 💡 HINT: Other options when user was wrong - subtle yellow
                                            showResult && !isSelected && localFeedback === 'error' && "bg-yellow-500/10 border-yellow-500/50 dark:bg-yellow-500/20"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            {/* ✅ Checkmark only when USER selected correct */}
                                            {showResult && isSelected && isCorrect && (
                                                <div className="w-7 h-7 rounded-full bg-success flex items-center justify-center animate-bounce-in shadow-lg">
                                                    <Check className="w-5 h-5 text-success-foreground" />
                                                </div>
                                            )}
                                            {/* ❌ X when user selected wrong */}
                                            {showResult && isSelected && !isCorrect && (
                                                <div className="w-6 h-6 rounded-full bg-destructive flex items-center justify-center">
                                                    <X className="w-4 h-4 text-destructive-foreground" />
                                                </div>
                                            )}
                                            <span className={cn(
                                                showResult && isSelected && isCorrect && "text-success font-bold",
                                                showResult && isSelected && !isCorrect && "text-destructive",
                                                showResult && !isSelected && localFeedback === 'error' && "text-yellow-600 dark:text-yellow-400"
                                            )}>
                                                {option.text}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Action Button */}
                        {!isChecked ? (
                            <Button
                                onClick={handleCheckAnswer}
                                disabled={!selectedOption}
                                className="w-full h-14 text-lg font-bold bg-success hover:bg-success/90 text-success-foreground rounded-2xl shadow-[0_4px_0_hsl(var(--success)/0.7)] hover:shadow-[0_2px_0_hsl(var(--success)/0.7)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50 disabled:shadow-none"
                            >
                                VERIFICAR
                            </Button>
                        ) : (
                            <Button
                                onClick={handleContinue}
                                className={cn(
                                    "w-full h-14 text-lg font-bold rounded-2xl transition-all",
                                    localFeedback === 'success'
                                        ? "bg-success hover:bg-success/90 text-success-foreground shadow-[0_4px_0_hsl(var(--success)/0.7)]"
                                        : "bg-orange-500 hover:bg-orange-600 text-white shadow-[0_4px_0_rgb(194,65,12)]",
                                    "hover:translate-y-[2px] active:translate-y-1 active:shadow-none"
                                )}
                            >
                                {localFeedback === 'success' ? 'CONTINUAR' : 'INTENTAR DE NUEVO'}
                                <ArrowRight className="ml-2 w-5 h-5" />
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* ===== SUCCESS DIALOG ===== */}
            <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
                <DialogContent className="sm:max-w-md bg-card border-0 shadow-2xl rounded-3xl">
                    <div className="text-center py-6">
                        <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-celebrate">
                            <PartyPopper className="w-10 h-10 text-yellow-500" />
                        </div>

                        <DialogTitle className="text-3xl font-bold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent mb-2">
                            ¡Excelente!
                        </DialogTitle>
                        <DialogDescription className="text-lg text-muted-foreground mb-6">
                            Completaste la lección 🌟
                        </DialogDescription>

                        {/* Stats */}
                        <div className="flex justify-center gap-4 mb-6">
                            <div className="bg-yellow-500/10 dark:bg-yellow-500/20 px-5 py-3 rounded-2xl">
                                <Star className="w-7 h-7 text-yellow-500 fill-yellow-500 mx-auto mb-1" />
                                <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                                    +{data.meta.points_reward}
                                </p>
                                <p className="text-xs text-muted-foreground">puntos</p>
                            </div>
                            <div className="bg-purple-500/10 dark:bg-purple-500/20 px-5 py-3 rounded-2xl">
                                <Trophy className="w-7 h-7 text-purple-500 mx-auto mb-1" />
                                <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                                    +{data.meta.xp_reward}
                                </p>
                                <p className="text-xs text-muted-foreground">XP</p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={handleClose}
                                className="flex-1 h-12 rounded-xl font-semibold"
                            >
                                Salir
                            </Button>
                            <Button
                                onClick={() => { setShowSuccess(false); startLesson(); }}
                                className="flex-1 h-12 rounded-xl font-semibold bg-primary"
                            >
                                Repetir
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default LessonRunner;
