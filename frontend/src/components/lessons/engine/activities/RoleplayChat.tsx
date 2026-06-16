import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { OptionCard } from '../ui/OptionCard';
import { QuestButton } from '../ui/QuestButton';

interface ChatMessage {
    id: string;
    sender: 'system' | 'hero' | 'npc' | 'user';
    name?: string;
    text: string;
    avatar?: string;
    delay?: number;
}

interface RoleplayChatProps {
    exercise: any;
    onSubmit: (choiceId: string) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const RoleplayChat = ({ exercise, onSubmit, onNext, onRetry }: RoleplayChatProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [choices, setChoices] = useState<any[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');
    const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        // Build initial messages from scenario + instruction
        const initialMessages: ChatMessage[] = [];
        const content = exercise?.content || {};

        if (content.scenario) {
            initialMessages.push({
                id: 'scenario',
                sender: 'npc',
                name: 'NPC',
                text: content.scenario,
                avatar: '🤖'
            });
        }
        if (content.instruction) {
            initialMessages.push({
                id: 'instruction',
                sender: 'system',
                name: t('status.system', { defaultValue: 'Sistema' }),
                text: content.instruction,
                avatar: '💡'
            });
        }

        setMessages(initialMessages);
        setChoices(content.options || []);
        setOutputState();
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [exercise, t]);

    const setOutputState = () => {
        setFeedback('none');
        setSelectedChoiceId(null);
    }

    const handleChoice = (choice: any) => {
        if (selectedChoiceId) return;
        playSound('ui_tap');
        setSelectedChoiceId(choice.id);

        // Add user message
        const userMsg: ChatMessage = {
            id: `user-${Date.now()}`,
            sender: 'user',
            text: choice.text,
            avatar: '👤'
        };
        setMessages(prev => [...prev, userMsg]);
        setIsTyping(true);

        // Delegate validation to useLessonState via onSubmit (single source of truth)
        // We call onSubmit immediately to get the result, but show it after delay
        const isCorrect = onSubmit(choice.id);

        // Determine NPC response with delay for chat effect
        timeoutRef.current = setTimeout(() => {
            setIsTyping(false);

            const npcResponseText = isCorrect
                ? (exercise?.feedback?.success || t('roleplay_chat.excellent_decision'))
                : (exercise?.feedback?.error || t('roleplay_chat.not_best_choice'));

            const npcMsg: ChatMessage = {
                id: `npc-${Date.now()}`,
                sender: 'npc',
                name: 'NPC',
                text: npcResponseText,
                avatar: '🤖'
            };
            setMessages(prev => [...prev, npcMsg]);
            setFeedback(isCorrect ? 'success' : 'error');

        }, 1500);
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            // Reset to initial state (remove user message and feedback)
            // Actually, remove last 2 messages (user + npc response)
            setMessages(prev => prev.slice(0, -2));
            setSelectedChoiceId(null);
            setFeedback('none');
            onRetry();
        }
    };

    const contextText = exercise.content?.scenario || exercise.content?.instruction || "...";

    return (
        <div className="lp-card w-full max-w-md animate-in fade-in slide-in-from-bottom-3 duration-500 min-h-[400px] max-h-[70vh] flex flex-col overflow-hidden">

            {/* Header */}
            <div className="p-4 flex items-center gap-3" style={{ background: "var(--lp-bg-2)", borderBottom: "1.5px solid var(--lp-line)" }}>
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-2xl sm:text-3xl shrink-0" style={{ background: "var(--lp-indigo-soft)" }}>
                    💬
                </div>
                <div>
                    <h3 className="lp-display text-sm sm:text-base" style={{ color: "var(--lp-ink)" }}>{t('status.chat_header')}</h3>
                    <p className="text-xs line-clamp-1" style={{ color: "var(--lp-muted)" }}>{contextText}</p>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ background: "var(--lp-bg)" }}>
                {messages.map((msg) => {
                    const isUser = msg.sender === 'user';
                    return (
                        <div key={msg.id} className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
                            <div
                                className={cn(
                                    "max-w-[85%] rounded-2xl p-4 text-sm animate-in zoom-in-95 slide-in-from-bottom-4 duration-300",
                                    isUser ? "rounded-tr-none" : "rounded-tl-none"
                                )}
                                style={isUser
                                    ? { background: "var(--lp-indigo)", color: "#fff", boxShadow: "0 5px 0 var(--lp-indigo-lip)" }
                                    : { background: "var(--lp-surface)", border: "1.5px solid var(--lp-line)", color: "var(--lp-ink)", boxShadow: "var(--lp-shadow)" }
                                }
                            >
                                {!isUser && (
                                    <p className="lp-display text-[10px] mb-1.5 uppercase tracking-wider" style={{ color: "var(--lp-indigo-ink)" }}>
                                        {msg.name || msg.sender}
                                    </p>
                                )}
                                <p className="leading-relaxed font-medium" style={{ color: isUser ? "#fff" : "var(--lp-ink)" }}>
                                    {msg.text}
                                </p>
                            </div>
                        </div>
                    );
                })}
                {isTyping && (
                    <div className="flex justify-start w-full">
                        <div className="rounded-full px-4 py-2 flex gap-1 animate-pulse" style={{ background: "var(--lp-bg-2)", border: "1.5px solid var(--lp-line)" }}>
                            <span className="w-2 h-2 rounded-full" style={{ background: "var(--lp-muted)" }}></span>
                            <span className="w-2 h-2 rounded-full" style={{ background: "var(--lp-muted)" }}></span>
                            <span className="w-2 h-2 rounded-full" style={{ background: "var(--lp-muted)" }}></span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input / Choices Area */}
            <div className="p-4" style={{ background: "var(--lp-surface)", borderTop: "1.5px solid var(--lp-line)" }}>
                {feedback === 'none' ? (
                    <div className="flex flex-col gap-2.5">
                        {choices.length === 0 && (
                            <div className="text-center space-y-3 py-4">
                                <p className="text-sm" style={{ color: "var(--lp-muted)" }}>
                                    {t('errors.no_options', { defaultValue: 'No hay opciones disponibles' })}
                                </p>
                                <QuestButton variant="brand" onClick={onNext}>
                                    {t('actions.skip', { defaultValue: 'Saltar ejercicio' })}
                                    <ArrowRight className="w-5 h-5" />
                                </QuestButton>
                            </div>
                        )}
                        {choices.map((choice, index) => (
                            <OptionCard
                                key={choice.id}
                                index={index}
                                text={choice.text}
                                state={selectedChoiceId === choice.id ? 'selected' : 'idle'}
                                onClick={() => handleChoice(choice)}
                                disabled={selectedChoiceId !== null}
                                showLetter={false}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="lp-display text-center" style={{ color: feedback === 'success' ? "var(--lp-emerald)" : "var(--lp-coral)" }}>
                            {feedback === 'success' ? t('feedback.success') : t('feedback.error')}
                        </div>
                        <QuestButton variant={feedback === 'success' ? 'go' : 'retry'} onClick={handleContinue}>
                            {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                            {feedback === 'success' ? <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" /> : <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />}
                        </QuestButton>
                    </div>
                )}
            </div>
        </div>
    );
};
