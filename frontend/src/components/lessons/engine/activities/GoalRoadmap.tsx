import { useState, useEffect } from 'react';
import { ArrowRight, MapPin, Flag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from "../ui/QuestButton";

interface GoalRoadmapProps {
    exercise: any;
    onSubmit: (order: string[]) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const GoalRoadmap = ({ exercise, onSubmit, onNext, onRetry }: GoalRoadmapProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [orderedGoals, setOrderedGoals] = useState<string[]>([]);
    const [availableGoals, setAvailableGoals] = useState<any[]>([]);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    const goals = exercise.content.goals || [];

    useEffect(() => {
        setOrderedGoals([]);
        setAvailableGoals([...goals]);
        setFeedback('none');
    }, [exercise]);

    const addGoal = (goalId: string) => {
        const goal = availableGoals.find(g => g.id === goalId);
        if (!goal) return;

        setOrderedGoals(prev => [...prev, goalId]);
        setAvailableGoals(prev => prev.filter(g => g.id !== goalId));
        playSound('ui_tap');
    };

    const removeGoal = (goalId: string) => {
        const goal = goals.find((g: any) => g.id === goalId);
        if (!goal) return;

        setOrderedGoals(prev => prev.filter(id => id !== goalId));
        setAvailableGoals(prev => [...prev, goal]);
        playSound('ui_tap');
    };

    const handleSubmit = () => {
        if (orderedGoals.length !== goals.length) return;

        const isCorrect = onSubmit(orderedGoals);
        setFeedback(isCorrect ? 'success' : 'error');
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            setOrderedGoals([]);
            setAvailableGoals([...goals]);
            setFeedback('none');
            onRetry();
        }
    };

    return (
        <div className="w-full max-w-5xl animate-slide-in-bottom">
            {/* Available Goals */}
            {availableGoals.length > 0 && (
                <div className="mb-6">
                    <h3 className="lp-display text-sm mb-3" style={{ color: 'var(--lp-muted)' }}>
                        {t('goal_roadmap.available_goals')}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {availableGoals.map((goal) => (
                            <button
                                key={goal.id}
                                onClick={() => addGoal(goal.id)}
                                className="lp-token lp-option lp-option--indigo text-left p-4"
                            >
                                <div className="flex items-center gap-2.5 mb-2">
                                    <span className="text-3xl sm:text-4xl">{goal.icon}</span>
                                    <span className="lp-display text-base" style={{ color: 'var(--lp-ink)' }}>
                                        {goal.title}
                                    </span>
                                </div>
                                <div className="lp-display text-xs sm:text-sm" style={{ color: 'var(--lp-muted)' }}>
                                    {goal.timeframe}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Roadmap Timeline */}
            <div className="lp-card mb-6 p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                    <MapPin className="w-5 h-5" style={{ color: 'var(--lp-indigo)' }} />
                    <h3 className="lp-display text-lg" style={{ color: 'var(--lp-ink)' }}>
                        {t('goal_roadmap.your_roadmap')}
                    </h3>
                </div>

                {orderedGoals.length === 0 ? (
                    <div className="lp-display text-center py-8" style={{ color: 'var(--lp-muted)' }}>
                        {t('goal_roadmap.empty_roadmap')}
                    </div>
                ) : (
                    <div className="relative">
                        {/* Timeline Line */}
                        <div
                            className="absolute left-6 top-0 bottom-0 w-1 rounded-full opacity-70"
                            style={{ background: 'linear-gradient(to bottom, var(--lp-indigo), var(--lp-amber), var(--lp-emerald))' }}
                        ></div>

                        {/* Goals */}
                        <div className="space-y-4">
                            {orderedGoals.map((goalId, index) => {
                                const goal = goals.find((g: any) => g.id === goalId);
                                if (!goal) return null;

                                return (
                                    <div key={goalId} className="relative flex items-start gap-4 pl-12">
                                        {/* Milestone Marker */}
                                        <div
                                            className="lp-badge absolute left-3 top-3 z-10 w-7 h-7 rounded-full flex items-center justify-center text-sm"
                                            style={{ background: 'var(--lp-indigo)', color: '#fff' }}
                                        >
                                            {index + 1}
                                        </div>

                                        {/* Goal Card */}
                                        <button
                                            onClick={() => removeGoal(goalId)}
                                            className="lp-token lp-option lp-option--coral flex-1 p-4 text-left group"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-3xl sm:text-4xl">{goal.icon}</span>
                                                    <div>
                                                        <div className="lp-display text-base" style={{ color: 'var(--lp-ink)' }}>
                                                            {goal.title}
                                                        </div>
                                                        <div className="lp-display text-xs sm:text-sm" style={{ color: 'var(--lp-muted)' }}>
                                                            {goal.timeframe}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div
                                                    className="lp-display text-xs sm:text-sm sm:opacity-0 sm:group-hover:opacity-100 opacity-100 transition-opacity px-2 py-1 rounded-lg"
                                                    style={{ color: 'var(--lp-coral-ink)', background: 'var(--lp-coral-soft)' }}
                                                >
                                                    {t('goal_roadmap.remove')}
                                                </div>
                                            </div>
                                        </button>
                                    </div>
                                );
                            })}

                            {/* Finish Flag */}
                            {orderedGoals.length === goals.length && (
                                <div className="relative flex items-center gap-4 pl-12 animate-bounce">
                                    <div className="absolute left-3 z-10 w-7 h-7 flex items-center justify-center">
                                        <Flag className="w-7 h-7" style={{ color: 'var(--lp-emerald)' }} />
                                    </div>
                                    <div
                                        className="flex-1 p-4 rounded-2xl border-2"
                                        style={{ background: 'var(--lp-emerald-soft)', borderColor: 'var(--lp-emerald)' }}
                                    >
                                        <div className="lp-display text-center" style={{ color: 'var(--lp-emerald-ink)' }}>
                                            🎉 {t('goal_roadmap.complete')}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center">
                {feedback === 'none' ? (
                    <div className="w-full max-w-md">
                        <QuestButton
                            variant="gold"
                            onClick={handleSubmit}
                            disabled={orderedGoals.length !== goals.length}
                        >
                            {t('actions.create_roadmap')}
                            <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                        </QuestButton>
                    </div>
                ) : (
                    <div className="flex flex-col items-center w-full max-w-md">
                        <p
                            className="lp-display text-lg mb-3"
                            style={{ color: feedback === 'success' ? 'var(--lp-emerald)' : 'var(--lp-coral)' }}
                        >
                            {feedback === 'success' ? t('feedback.success') : t('feedback.error')}
                        </p>
                        <div
                            className="mb-4 p-4 rounded-2xl border-2 max-w-2xl"
                            style={{ background: 'var(--lp-indigo-soft)', borderColor: 'var(--lp-indigo)' }}
                        >
                            <p className="lp-display text-sm text-center" style={{ color: 'var(--lp-indigo-ink)' }}>
                                {t('goal_roadmap.feedback_order')}
                            </p>
                        </div>

                        <QuestButton
                            variant={feedback === 'success' ? 'go' : 'retry'}
                            onClick={handleContinue}
                        >
                            {t('actions.continue')}
                            <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                        </QuestButton>
                    </div>
                )}
            </div>
        </div>
    );
};
