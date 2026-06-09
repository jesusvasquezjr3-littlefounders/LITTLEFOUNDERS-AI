/**
 * ExercisePreview — Lightweight visual preview of an exercise as students would see it.
 * No API calls, no audio, no confetti — just a visual simulation.
 */
import React from 'react';
import { EXERCISE_TYPE_ICONS } from './ExerciseEditorForms';

interface ExercisePreviewProps {
    exercise: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
}

/** Simulated phone-like container */
const PhoneFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="mx-auto w-full max-w-[375px] bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 rounded-3xl border-2 border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden">
        {/* Notch */}
        <div className="flex justify-center pt-2 pb-1">
            <div className="w-20 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full" />
        </div>
        <div className="px-4 pb-6 min-h-[480px] flex flex-col">
            {children}
        </div>
    </div>
);

/** Main text extraction — mirrors LessonRunner.getCurrentText() */
function getMainText(exercise: any): string {
    const c = exercise?.content || {};
    return c.question || c.statement || c.instruction || c.transcript || c.context || c.prompt || c.description || c.text || c.scenario || c.challenge || '';
}

/** Render options list */
function OptionsList({ items, correctId }: { items: any[]; correctId?: string }) {
    if (!items?.length) return null;
    return (
        <div className="space-y-2 mt-4">
            {items.map((opt: any, i: number) => {
                const isCorrect = opt.id === correctId;
                return (
                    <div key={opt.id || i}
                        className={`px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all
                            ${isCorrect
                                ? 'border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-900/40 dark:text-emerald-200'
                                : 'border-slate-200 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                    >
                        {isCorrect && <span className="mr-2">✅</span>}
                        {opt.text || opt.title || opt.label || opt.id}
                    </div>
                );
            })}
        </div>
    );
}

/** Render items list (sequencing, classification, etc.) */
function ItemsList({ items, label }: { items: any[]; label: string }) {
    if (!items?.length) return null;
    return (
        <div className="mt-4">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">{label}</p>
            <div className="flex flex-wrap gap-2">
                {items.map((item: any, i: number) => (
                    <span key={item.id || i}
                        className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 text-sm rounded-lg font-medium border border-purple-200 dark:border-purple-700">
                        {item.text || item.name || item.title || item.label || item.word || `#${i + 1}`}
                    </span>
                ))}
            </div>
        </div>
    );
}

/** Render pairs */
function PairsList({ pairs }: { pairs: any[] }) {
    if (!pairs?.length) return null;
    return (
        <div className="mt-4 space-y-2">
            {pairs.map((pair: any, i: number) => (
                <div key={pair.id || i} className="flex items-center gap-2">
                    <span className="flex-1 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-lg text-sm text-center border border-blue-200 dark:border-blue-700">
                        {pair.left || pair.term || `A${i + 1}`}
                    </span>
                    <span className="text-slate-400">↔</span>
                    <span className="flex-1 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-lg text-sm text-center border border-blue-200 dark:border-blue-700">
                        {pair.right || pair.definition || `B${i + 1}`}
                    </span>
                </div>
            ))}
        </div>
    );
}

/** Products grid */
function ProductsGrid({ products, budget }: { products: any[]; budget?: number }) {
    if (!products?.length) return null;
    return (
        <div className="mt-4">
            {budget !== undefined && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-200 dark:border-indigo-700">
                    <span className="text-lg">💰</span>
                    <span className="font-bold text-indigo-700 dark:text-indigo-300">${budget}</span>
                </div>
            )}
            <div className="grid grid-cols-2 gap-2">
                {products.map((p: any, i: number) => (
                    <div key={p.id || i} className="px-3 py-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 text-center">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{p.name || `Item ${i + 1}`}</p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-1">${p.price || p.cost || 0}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Slider preview */
function SliderPreview({ exercise }: { exercise: any }) {
    const c = exercise?.content || {};
    const min = c.min ?? c.minValue ?? 0;
    const max = c.max ?? c.maxValue ?? 100;
    const correct = exercise?.correct_answer?.exactValue ?? exercise?.correct_answer?.value ?? Math.round((min + max) / 2);
    const pct = max > min ? ((correct - min) / (max - min)) * 100 : 50;
    return (
        <div className="mt-4 space-y-2">
            <div className="relative h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-slate-400">
                <span>{min}{c.unit ? ` ${c.unit}` : ''}</span>
                <span className="font-bold text-emerald-500">{correct}{c.unit ? ` ${c.unit}` : ''}</span>
                <span>{max}{c.unit ? ` ${c.unit}` : ''}</span>
            </div>
        </div>
    );
}

/** Story pages */
function StoryPages({ pages }: { pages: any[] }) {
    if (!pages?.length) return null;
    return (
        <div className="mt-4 space-y-3">
            {pages.slice(0, 3).map((page: any, i: number) => (
                <div key={page.id || i} className="px-4 py-3 bg-blue-50/60 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/50">
                    <span className="text-xs text-blue-500 dark:text-blue-400 font-bold">📄 {i + 1}</span>
                    <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{page.text || '...'}</p>
                </div>
            ))}
            {pages.length > 3 && (
                <p className="text-xs text-center text-slate-400">+{pages.length - 3} more pages...</p>
            )}
        </div>
    );
}

/** True/False toggle preview */
function TrueFalsePreview({ correctValue }: { correctValue?: boolean }) {
    return (
        <div className="flex gap-3 mt-4">
            <div className={`flex-1 py-4 rounded-xl border-2 text-center font-bold text-lg transition-all
                ${correctValue === true
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'border-slate-200 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                ✅ True
            </div>
            <div className={`flex-1 py-4 rounded-xl border-2 text-center font-bold text-lg transition-all
                ${correctValue === false
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'border-slate-200 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                ❌ False
            </div>
        </div>
    );
}

/** Math challenge preview */
function MathPreview({ exercise }: { exercise: any }) {
    const c = exercise?.content || {};
    return (
        <div className="mt-4 space-y-3">
            {c.expression && (
                <div className="text-center py-4 px-6 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-200 dark:border-indigo-700">
                    <p className="text-2xl font-mono font-bold text-indigo-700 dark:text-indigo-300">{c.expression}</p>
                </div>
            )}
            {c.options && <OptionsList items={c.options} correctId={exercise?.correct_answer?.correctOptionId} />}
        </div>
    );
}

/** Dialogue preview (roleplay_chat) */
function DialoguePreview({ dialogue, choices, correctId }: { dialogue: any[]; choices?: any[]; correctId?: string }) {
    return (
        <div className="mt-4 space-y-2">
            {(dialogue || []).slice(0, 4).map((msg: any, i: number) => (
                <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm
                        ${msg.sender === 'user'
                            ? 'bg-blue-500 text-white rounded-br-md'
                            : msg.sender === 'narrator'
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 italic'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-md'}`}>
                        {msg.text || '...'}
                    </div>
                </div>
            ))}
            {choices && <OptionsList items={choices} correctId={correctId} />}
        </div>
    );
}

export const ExercisePreview: React.FC<ExercisePreviewProps> = ({ exercise, t }) => {
    if (!exercise) return null;

    const type = exercise.type || 'unknown';
    const icon = EXERCISE_TYPE_ICONS[type] || '❓';
    const mainText = getMainText(exercise);
    const c = exercise.content || {};
    const ca = exercise.correct_answer || {};

    return (
        <PhoneFrame>
            {/* Simulated progress bar */}
            <div className="flex items-center gap-2 mt-2 mb-4">
                <div className="flex-1 h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full w-1/2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full" />
                </div>
                <span className="text-xs font-bold text-slate-400">1/5</span>
                <span className="text-xs">⚡ 5</span>
            </div>

            {/* Speech bubble */}
            {mainText && (
                <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 px-4 py-3 mb-3">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 text-center leading-relaxed">
                        {mainText}
                    </p>
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2">
                        <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white dark:border-t-slate-800" />
                    </div>
                </div>
            )}

            {/* Character icon */}
            <div className="flex justify-center mb-3">
                <span className="text-5xl">{icon}</span>
            </div>

            {/* Type-specific content */}
            <div className="flex-1">
                {/* Multiple choice / price_detective / risk_reward / etc. */}
                {(c.options || c.risk_options) && type !== 'math_challenge' && (
                    <OptionsList items={c.options || c.risk_options} correctId={ca.correctOptionId || ca.bestOffer} />
                )}

                {/* True/False */}
                {type === 'true_false' && (
                    <TrueFalsePreview correctValue={ca.isTrue ?? ca.value} />
                )}

                {/* Math challenge */}
                {type === 'math_challenge' && <MathPreview exercise={exercise} />}

                {/* Matching pairs */}
                {(type === 'matching_pairs' || type === 'match_pairs') && (
                    <PairsList pairs={c.pairs || []} />
                )}

                {/* Sequencing / word scramble */}
                {(type === 'sequencing' || type === 'word_scramble') && (
                    <ItemsList items={c.items || c.words || []} label={type === 'word_scramble' ? 'Letters' : 'Steps'} />
                )}

                {/* Estimation slider */}
                {type === 'estimation_slider' && <SliderPreview exercise={exercise} />}

                {/* Story mode */}
                {type === 'story_mode' && <StoryPages pages={c.pages || []} />}

                {/* Shop sim / budget builder */}
                {(type === 'shop_sim' || type === 'budget_builder') && (
                    <ProductsGrid products={c.products || c.items || []} budget={c.budget} />
                )}

                {/* Roleplay chat */}
                {type === 'roleplay_chat' && (
                    <DialoguePreview dialogue={c.dialogue || []} choices={c.choices} correctId={ca.correctOptionId} />
                )}

                {/* Tap action / spot_trap */}
                {(type === 'tap_action' || type === 'spot_trap') && (
                    <ItemsList items={c.items || c.messages || []} label="Items" />
                )}

                {/* Classification */}
                {type === 'classification' && (
                    <>
                        {c.categories && (
                            <div className="flex gap-2 mt-3 flex-wrap">
                                {c.categories.map((cat: any, i: number) => (
                                    <span key={cat.id || i} className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full text-xs font-bold border border-blue-200 dark:border-blue-700">
                                        {cat.label || cat.name || `Cat ${i + 1}`}
                                    </span>
                                ))}
                            </div>
                        )}
                        <ItemsList items={c.items || []} label="Items" />
                    </>
                )}

                {/* Fill blank */}
                {type === 'fill_blank' && c.segments && (
                    <div className="mt-4 flex flex-wrap gap-1 items-center">
                        {c.segments.map((seg: any, i: number) => (
                            seg.type === 'blank'
                                ? <span key={i} className="px-3 py-1 border-b-2 border-dashed border-purple-400 text-purple-500 dark:text-purple-400 font-bold text-sm min-w-[60px] text-center">___</span>
                                : <span key={i} className="text-sm text-slate-700 dark:text-slate-300">{seg.text || ''}</span>
                        ))}
                    </div>
                )}

                {/* Coin counter */}
                {type === 'coin_counter' && (
                    <div className="mt-4 text-center">
                        <p className="text-3xl font-bold text-indigo-500">💰 ${c.targetAmount || 0}</p>
                        <div className="flex justify-center gap-2 mt-3 flex-wrap">
                            {(c.coins_available || []).map((coin: any, i: number) => (
                                <span key={i} className="px-3 py-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-full text-indigo-700 dark:text-indigo-300 font-bold text-sm border border-indigo-300 dark:border-indigo-700">
                                    ${coin.value}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Interest calculator */}
                {type === 'interest_calculator' && (
                    <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                        <div className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                            <p className="text-xs text-slate-400">Principal</p>
                            <p className="font-bold text-slate-700 dark:text-slate-200">${c.defaultPrincipal || 0}</p>
                        </div>
                        <div className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                            <p className="text-xs text-slate-400">Rate</p>
                            <p className="font-bold text-slate-700 dark:text-slate-200">{c.defaultRate || 0}%</p>
                        </div>
                    </div>
                )}

                {/* Generic fallback — show feedback if available */}
                {exercise.feedback?.success && (
                    <div className="mt-4 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-700">
                        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-0.5">✅ Success</p>
                        <p className="text-sm text-emerald-700 dark:text-emerald-300">{exercise.feedback.success}</p>
                    </div>
                )}
            </div>
        </PhoneFrame>
    );
};

export default ExercisePreview;
