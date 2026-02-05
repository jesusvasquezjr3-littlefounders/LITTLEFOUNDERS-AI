import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

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
    onSubmit: (choiceId: string) => void;
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

    useEffect(() => {
        // Init logic: Load initial context messages
        const initialMessages = exercise.content.dialogue || [];
        setMessages([]); // Start empty and stream them in? Or show all history? 
        // Let's show history immediately for now, or stream it.
        // Simple version: Show history.
        setMessages(initialMessages);

        setChoices(exercise.content.choices || []);
        setOutputState();
    }, [exercise]);

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
            avatar: '👤' // Or user avatar from context
        };
        setMessages(prev => [...prev, userMsg]);
        setIsTyping(true);

        // Validate
        const correctId = exercise.correct_answer?.correctOptionId;
        const isCorrect = choice.id === correctId;

        // Determine NPC response
        setTimeout(() => {
            setIsTyping(false);

            const npcResponseText = isCorrect
                ? (exercise.feedback?.success || "¡Excelente decisión!")
                : (exercise.feedback?.error || "Mmm, tal vez no sea lo mejor...");

            const npcMsg: ChatMessage = {
                id: `npc-${Date.now()}`,
                sender: 'npc',
                name: 'NPC',
                text: npcResponseText,
                avatar: '🤖' // Contextual avatar ideally
            };
            setMessages(prev => [...prev, npcMsg]);

            setFeedback(isCorrect ? 'success' : 'error');
            onSubmit(choice.id);

            if (isCorrect) playSound('edu_success');
            else playSound('edu_error');

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

    return (
        <div className="w-full max-w-md animate-slide-in-bottom min-h-[400px] max-h-[70vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl overflow-hidden border-2 border-slate-200 dark:border-slate-800 shadow-xl">

            {/* Header */}
            <div className="bg-slate-100 dark:bg-slate-800 p-4 border-b dark:border-slate-700 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xl">
                    💬
                </div>
                <div>
                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">{t('status.chat_header')}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-1">{exercise.content.context || "..."}</p>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900/50">
                {messages.map((msg) => {
                    const isUser = msg.sender === 'user';
                    return (
                        <div key={msg.id} className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
                            <div className={cn(
                                "max-w-[85%] rounded-2xl p-4 text-sm shadow-md animate-in zoom-in-95 slide-in-from-bottom-4 duration-300",
                                isUser
                                    ? "bg-purple-600 text-white rounded-tr-none"
                                    : "bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-tl-none text-slate-800 dark:text-slate-100"
                            )}>
                                {!isUser && (
                                    <p className="text-[10px] font-black opacity-60 mb-1.5 uppercase tracking-wider text-purple-600 dark:text-purple-400">
                                        {msg.name || msg.sender}
                                    </p>
                                )}
                                <p className={cn("leading-relaxed font-medium", isUser ? "text-white" : "text-slate-700 dark:text-slate-200")}>
                                    {msg.text}
                                </p>
                            </div>
                        </div>
                    );
                })}
                {isTyping && (
                    <div className="flex justify-start w-full">
                        <div className="bg-slate-200 dark:bg-slate-800 rounded-full px-4 py-2 flex gap-1 animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input / Choices Area */}
            <div className="p-4 bg-white dark:bg-slate-900 border-t dark:border-slate-800">
                {feedback === 'none' ? (
                    <div className="flex flex-col gap-2">
                        {choices.map((choice) => (
                            <button
                                key={choice.id}
                                onClick={() => handleChoice(choice)}
                                disabled={selectedChoiceId !== null}
                                className="w-full text-left p-3 rounded-xl border-2 border-slate-100 dark:border-slate-700 hover:border-purple-200 dark:hover:border-purple-800 bg-slate-50 dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors text-sm font-medium text-slate-800 dark:text-slate-200"
                            >
                                {choice.text}
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className={cn("text-center font-bold", feedback === 'success' ? "text-green-500" : "text-orange-500")}>
                            {feedback === 'success' ? t('feedback.success') : t('feedback.error')}
                        </div>
                        <Button
                            onClick={handleContinue}
                            className={cn(
                                "w-full h-12 text-lg font-bold rounded-xl transition-all",
                                feedback === 'success'
                                    ? "bg-green-500 hover:bg-green-600 text-white"
                                    : "bg-orange-500 hover:bg-orange-600 text-white"
                            )}
                        >
                            {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                            <ArrowRight className="ml-2 w-5 h-5" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
