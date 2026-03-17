import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, MapPin, Flag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

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

    return (
        <div className="w-full max-w-5xl animate-slide-in-bottom">
            {/* Available Goals */}
            {availableGoals.length > 0 && (
                <div className="mb-6">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                        {t('goal_roadmap.available_goals')}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {availableGoals.map((goal) => (
                            <button
                                key={goal.id}
                                onClick={() => addGoal(goal.id)}
                                className="p-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-blue-400 transition-all text-left"
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-2xl">{goal.icon}</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">
                                        {goal.title}
                                    </span>
                                </div>
                                <div className="text-xs text-slate-600 dark:text-slate-400">
                                    {goal.timeframe}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Roadmap Timeline */}
            <div className="mb-6 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-950/30 dark:to-purple-950/30 border-2 border-blue-500 dark:border-blue-700 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-black text-blue-900 dark:text-blue-100">
                        {t('goal_roadmap.your_roadmap')}
                    </h3>
                </div>

                {orderedGoals.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                        {t('goal_roadmap.empty_roadmap')}
                    </div>
                ) : (
                    <div className="relative">
                        {/* Timeline Line */}
                        <div className="absolute left-6 top-0 bottom-0 w-1 bg-blue-400 dark:bg-blue-600"></div>

                        {/* Goals */}
                        <div className="space-y-4">
                            {orderedGoals.map((goalId, index) => {
                                const goal = goals.find((g: any) => g.id === goalId);
                                if (!goal) return null;

                                return (
                                    <div key={goalId} className="relative flex items-start gap-4 pl-12">
                                        {/* Milestone Marker */}
                                        <div className="absolute left-3 top-3 w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg">
                                            {index + 1}
                                        </div>

                                        {/* Goal Card */}
                                        <button
                                            onClick={() => removeGoal(goalId)}
                                            className="flex-1 p-4 bg-white dark:bg-slate-800 rounded-xl shadow-md hover:shadow-lg transition-all text-left group"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-3xl">{goal.icon}</span>
                                                    <div>
                                                        <div className="font-bold text-slate-800 dark:text-slate-200">
                                                            {goal.title}
                                                        </div>
                                                        <div className="text-xs text-slate-600 dark:text-slate-400">
                                                            {goal.timeframe}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-xs text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
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
                                    <div className="absolute left-3 w-7 h-7 flex items-center justify-center">
                                        <Flag className="w-7 h-7 text-green-600" />
                                    </div>
                                    <div className="flex-1 p-4 bg-green-100 dark:bg-green-950 rounded-xl border-2 border-green-500">
                                        <div className="font-bold text-green-800 dark:text-green-200 text-center">
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
                    <Button
                        onClick={handleSubmit}
                        disabled={orderedGoals.length !== goals.length}
                        className="relative overflow-hidden w-full max-w-md h-12 text-base font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-[0_4px_0_rgb(29,78,216)] hover:shadow-[0_2px_0_rgb(29,78,216)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50"
                    >
                        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                        <span className="relative flex items-center justify-center">
                            {t('actions.create_roadmap')}
                            <ArrowRight className="ml-2 w-5 h-5" />
                        </span>
                    </Button>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-300 dark:border-blue-700 rounded-xl max-w-2xl">
                            <p className="text-sm text-blue-900 dark:text-blue-100 text-center">
                                {t('goal_roadmap.feedback_order')}
                            </p>
                        </div>

                        <Button
                            onClick={onNext}
                            className="relative overflow-hidden w-full max-w-md h-12 text-base font-bold bg-green-500 hover:bg-green-600 text-white rounded-2xl shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all"
                        >
                            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                            <span className="relative flex items-center justify-center">
                                {t('actions.continue')}
                                <ArrowRight className="ml-2 w-5 h-5" />
                            </span>
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
