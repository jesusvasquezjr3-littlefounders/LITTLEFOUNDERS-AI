/**
 * ExerciseEditorForms.tsx
 * Visual form editors for each exercise type, replacing raw JSON editing.
 * Renders appropriate form fields based on exercise type.
 */
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getGestureLabels } from '@/utils/gestureMapper';
import { DinoCharacter } from '@/components/characters/DinoCharacter';
import { DinaCharacter } from '@/components/characters/DinaCharacter';
import DrRhoCharacter from '@/components/characters/DrRhoCharacter';
import ZaraVexCharacter from '@/components/characters/ZaraVexCharacter';

// ── Exercise types configuration ──

export const EXERCISE_TYPE_GROUPS = [
    {
        key: 'groupFoundation',
        emoji: '📚',
        types: [
            'intro_narrative', 'multiple_choice', 'true_false', 'fill_blank',
            'classification', 'matching_pairs', 'sequencing', 'tap_action',
            'story_mode', 'math_challenge', 'word_scramble',
        ],
    },
    {
        key: 'groupInteractive',
        emoji: '🎮',
        types: [
            'roleplay_chat', 'estimation_slider', 'risk_reward',
            'concept_builder', 'quiz_battle',
        ],
    },
    {
        key: 'groupEconomy',
        emoji: '💰',
        types: [
            'shop_sim', 'coin_counter', 'price_detective', 'bill_splitter',
            'budget_builder', 'expense_timeline', 'subscription_tracker',
        ],
    },
    {
        key: 'groupSavings',
        emoji: '🏦',
        types: [
            'savings_race', 'emergency_fund', 'goal_roadmap',
            'interest_calculator', 'portfolio_builder', 'mystery_investment',
            'passive_income', 'opportunity_cost', 'market_reaction',
        ],
    },
    {
        key: 'groupAdvanced',
        emoji: '🎓',
        types: [
            'inflation_simulator', 'credit_score', 'debt_strategy',
            'tax_puzzle', 'salary_comparison', 'spot_trap',
            'impact_meter', 'mindset_comparison',
        ],
    },
];

export const ALL_EXERCISE_TYPES = EXERCISE_TYPE_GROUPS.flatMap((g) => g.types);

export const EXERCISE_TYPE_ICONS: Record<string, string> = {
    intro_narrative: '📖', multiple_choice: '🔘', true_false: '✅',
    fill_blank: '✏️', classification: '📂', matching_pairs: '🔗',
    sequencing: '🔢', tap_action: '👆', story_mode: '📕',
    math_challenge: '🧮', word_scramble: '🔤', roleplay_chat: '💬',
    estimation_slider: '📏', risk_reward: '⚖️', concept_builder: '🧱',
    quiz_battle: '⚔️', shop_sim: '🛒', coin_counter: '🪙',
    price_detective: '🔍', bill_splitter: '🧾', budget_builder: '📊',
    expense_timeline: '📅', subscription_tracker: '🔄',
    savings_race: '🏁', emergency_fund: '🚨', goal_roadmap: '🗺️',
    interest_calculator: '📈', portfolio_builder: '💼',
    mystery_investment: '🎁', passive_income: '💸',
    opportunity_cost: '🤔', market_reaction: '📉',
    inflation_simulator: '🎈', credit_score: '💳',
    debt_strategy: '🏗️', tax_puzzle: '🧩', salary_comparison: '💵',
    spot_trap: '🪤', impact_meter: '🌍', mindset_comparison: '🧠',
};

// ── Shared helpers ──

interface FieldProps {
    label: string;
    children: React.ReactNode;
    className?: string;
}

const Field: React.FC<FieldProps> = ({ label, children, className = '' }) => (
    <div className={className}>
        <Label className="corp-body-sm">{label}</Label>
        <div className="mt-1">{children}</div>
    </div>
);

interface DynamicListProps {
    items: any[];
    onUpdate: (items: any[]) => void;
    addLabel: string;
    renderItem: (item: any, index: number, onChange: (val: any) => void) => React.ReactNode;
    newItem: () => any;
    disabled?: boolean;
}

const DynamicList: React.FC<DynamicListProps> = ({
    items, onUpdate, addLabel, renderItem, newItem, disabled,
}) => (
    <div className="space-y-2">
        {(items || []).map((item, idx) => (
            <div key={idx} className="flex items-start gap-2">
                <div className="flex-1">
                    {renderItem(item, idx, (val) => {
                        const updated = [...items];
                        updated[idx] = val;
                        onUpdate(updated);
                    })}
                </div>
                {!disabled && (
                    <Button
                        variant="ghost" size="sm"
                        onClick={() => onUpdate(items.filter((_, i) => i !== idx))}
                        className="mt-1 text-red-500 hover:text-red-700 dark:text-red-400"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}
            </div>
        ))}
        {!disabled && (
            <Button variant="outline" size="sm" onClick={() => onUpdate([...(items || []), newItem()])}>
                <Plus className="h-4 w-4 mr-1" /> {addLabel}
            </Button>
        )}
    </div>
);

// ── Common exercise editor props ──

export interface ExerciseEditorProps {
    exercise: any;
    onChange: (updates: any) => void;
    disabled: boolean;
    t: (key: string) => string;
}

// ── Feedback fields (shared across types) ──

const FeedbackFields: React.FC<ExerciseEditorProps> = ({ exercise, onChange, disabled, t }) => (
    <div className="grid gap-4 md:grid-cols-2 mt-4 pt-4 border-t dark:border-slate-600">
        <Field label={t('editor.fields.feedbackSuccess')}>
            <Input
                value={exercise.feedback?.success || ''}
                onChange={(e) => onChange({ feedback: { ...exercise.feedback, success: e.target.value } })}
                disabled={disabled}
                placeholder={t('editor.fields.feedbackSuccessPlaceholder')}
                className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50"
            />
        </Field>
        <Field label={t('editor.fields.feedbackError')}>
            <Input
                value={exercise.feedback?.error || ''}
                onChange={(e) => onChange({ feedback: { ...exercise.feedback, error: e.target.value } })}
                disabled={disabled}
                placeholder={t('editor.fields.feedbackErrorPlaceholder')}
                className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50"
            />
        </Field>
    </div>
);

// ── Type-specific editors ──

const IntroNarrativeEditor: React.FC<ExerciseEditorProps> = ({ exercise, onChange, disabled, t }) => (
    <div className="space-y-4">
        <Field label={t('editor.fields.transcript')}>
            <Textarea
                value={exercise.content?.transcript || ''}
                onChange={(e) => onChange({ content: { ...exercise.content, transcript: e.target.value } })}
                disabled={disabled} rows={4}
                className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50"
            />
        </Field>
    </div>
);

const MultipleChoiceEditor: React.FC<ExerciseEditorProps> = ({ exercise, onChange, disabled, t }) => {
    const content = exercise.content || {};
    const options = content.options || [];
    return (
        <div className="space-y-4">
            <Field label={t('editor.fields.question')}>
                <Input
                    value={content.question || ''}
                    onChange={(e) => onChange({ content: { ...content, question: e.target.value } })}
                    disabled={disabled}
                    className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50"
                />
            </Field>
            <Field label={t('editor.fields.options')}>
                <DynamicList
                    items={options}
                    onUpdate={(opts) => onChange({ content: { ...content, options: opts } })}
                    addLabel={t('editor.fields.addOption')}
                    disabled={disabled}
                    newItem={() => ({ id: `opt_${Date.now()}`, text: '' })}
                    renderItem={(item, _idx, onItemChange) => (
                        <Input
                            value={item.text || ''} placeholder={t('editor.fields.optionText')}
                            onChange={(e) => onItemChange({ ...item, text: e.target.value })}
                            disabled={disabled}
                            className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50"
                        />
                    )}
                />
            </Field>
            <Field label={t('editor.fields.correctOption')}>
                <select
                    value={exercise.correct_answer?.correctOptionId || ''}
                    onChange={(e) => onChange({ correct_answer: { correctOptionId: e.target.value } })}
                    disabled={disabled}
                    className="w-full rounded-md border px-3 py-2 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50"
                >
                    <option value="">--</option>
                    {options.map((opt: any) => (
                        <option key={opt.id} value={opt.id}>{opt.text || opt.id}</option>
                    ))}
                </select>
            </Field>
            <FeedbackFields exercise={exercise} onChange={onChange} disabled={disabled} t={t} />
        </div>
    );
};

const TrueFalseEditor: React.FC<ExerciseEditorProps> = ({ exercise, onChange, disabled, t }) => {
    const content = exercise.content || {};
    return (
        <div className="space-y-4">
            <Field label={t('editor.fields.statement')}>
                <Textarea
                    value={content.statement || ''}
                    onChange={(e) => onChange({ content: { ...content, statement: e.target.value } })}
                    disabled={disabled} rows={2}
                    className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50"
                />
            </Field>
            <div className="flex items-center gap-3">
                <Switch
                    checked={exercise.correct_answer?.isTrue ?? true}
                    onCheckedChange={(v) => onChange({ correct_answer: { isTrue: v } })}
                    disabled={disabled}
                />
                <Label className="dark:text-slate-300">{t('editor.fields.isTrue')}</Label>
            </div>
            <FeedbackFields exercise={exercise} onChange={onChange} disabled={disabled} t={t} />
        </div>
    );
};

const MathChallengeEditor: React.FC<ExerciseEditorProps> = ({ exercise, onChange, disabled, t }) => {
    const content = exercise.content || {};
    return (
        <div className="space-y-4">
            <Field label={t('editor.fields.question')}>
                <Input
                    value={content.question || ''}
                    onChange={(e) => onChange({ content: { ...content, question: e.target.value } })}
                    disabled={disabled}
                    className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50"
                />
            </Field>
            <Field label={t('editor.fields.correctValue')}>
                <Input
                    type="number"
                    value={exercise.correct_answer?.correctValue ?? ''}
                    onChange={(e) => onChange({ correct_answer: { correctValue: parseFloat(e.target.value) } })}
                    disabled={disabled}
                    className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50"
                />
            </Field>
            <FeedbackFields exercise={exercise} onChange={onChange} disabled={disabled} t={t} />
        </div>
    );
};

const TapActionEditor: React.FC<ExerciseEditorProps> = ({ exercise, onChange, disabled, t }) => {
    const content = exercise.content || {};
    const items = content.items || [];
    return (
        <div className="space-y-4">
            <Field label={t('editor.fields.instruction')}>
                <Input
                    value={content.instruction || ''}
                    onChange={(e) => onChange({ content: { ...content, instruction: e.target.value } })}
                    disabled={disabled}
                    className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50"
                />
            </Field>
            <Field label={t('editor.fields.items')}>
                <DynamicList
                    items={items}
                    onUpdate={(its) => onChange({
                        content: { ...content, items: its },
                        correct_answer: { targetIds: its.filter((i: any) => i.isTarget).map((i: any) => i.id) }
                    })}
                    addLabel={t('editor.fields.addItem')}
                    disabled={disabled}
                    newItem={() => ({ id: `item_${Date.now()}`, text: '', isTarget: false })}
                    renderItem={(item, _idx, onItemChange) => (
                        <div className="flex items-center gap-2">
                            <Input value={item.text || ''} placeholder={t('editor.fields.itemText')}
                                onChange={(e) => onItemChange({ ...item, text: e.target.value })}
                                disabled={disabled} className="flex-1 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50" />
                            <div className="flex items-center gap-1 shrink-0">
                                <Switch checked={item.isTarget || false}
                                    onCheckedChange={(v) => onItemChange({ ...item, isTarget: v })} disabled={disabled} />
                                <span className="text-xs dark:text-slate-400">🎯</span>
                            </div>
                        </div>
                    )}
                />
            </Field>
        </div>
    );
};

const MatchingPairsEditor: React.FC<ExerciseEditorProps> = ({ exercise, onChange, disabled, t }) => {
    const content = exercise.content || {};
    const pairs = content.pairs || [];
    return (
        <div className="space-y-4">
            <Field label={t('editor.fields.pairs')}>
                <DynamicList
                    items={pairs}
                    onUpdate={(ps) => onChange({ content: { ...content, pairs: ps } })}
                    addLabel={t('editor.fields.addPair')}
                    disabled={disabled}
                    newItem={() => ({ id: `pair_${Date.now()}`, left: '', right: '' })}
                    renderItem={(item, _idx, onItemChange) => (
                        <div className="grid grid-cols-2 gap-2">
                            <Input value={item.left || ''} placeholder={t('editor.fields.left')}
                                onChange={(e) => onItemChange({ ...item, left: e.target.value })}
                                disabled={disabled} className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50" />
                            <Input value={item.right || ''} placeholder={t('editor.fields.right')}
                                onChange={(e) => onItemChange({ ...item, right: e.target.value })}
                                disabled={disabled} className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50" />
                        </div>
                    )}
                />
            </Field>
        </div>
    );
};

const WordScrambleEditor: React.FC<ExerciseEditorProps> = ({ exercise, onChange, disabled, t }) => {
    const content = exercise.content || {};
    return (
        <div className="space-y-4">
            <Field label={t('editor.fields.word')}>
                <Input value={content.word || ''}
                    onChange={(e) => onChange({ content: { ...content, word: e.target.value } })}
                    disabled={disabled} className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50" />
            </Field>
            <Field label={t('editor.fields.hint')}>
                <Input value={content.hint || ''}
                    onChange={(e) => onChange({ content: { ...content, hint: e.target.value } })}
                    disabled={disabled} className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50" />
            </Field>
            <Field label={t('editor.fields.question')}>
                <Input value={content.question || ''}
                    onChange={(e) => onChange({ content: { ...content, question: e.target.value } })}
                    disabled={disabled} className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50" />
            </Field>
        </div>
    );
};

const EstimationSliderEditor: React.FC<ExerciseEditorProps> = ({ exercise, onChange, disabled, t }) => {
    const content = exercise.content || {};
    return (
        <div className="space-y-4">
            <Field label={t('editor.fields.question')}>
                <Input value={content.question || ''}
                    onChange={(e) => onChange({ content: { ...content, question: e.target.value } })}
                    disabled={disabled} className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50" />
            </Field>
            <div className="grid grid-cols-4 gap-3">
                <Field label={t('editor.fields.min')}>
                    <Input type="number" value={content.min ?? 0}
                        onChange={(e) => onChange({ content: { ...content, min: parseFloat(e.target.value) } })}
                        disabled={disabled} className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50" />
                </Field>
                <Field label={t('editor.fields.max')}>
                    <Input type="number" value={content.max ?? 100}
                        onChange={(e) => onChange({ content: { ...content, max: parseFloat(e.target.value) } })}
                        disabled={disabled} className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50" />
                </Field>
                <Field label={t('editor.fields.step')}>
                    <Input type="number" value={content.step ?? 1}
                        onChange={(e) => onChange({ content: { ...content, step: parseFloat(e.target.value) } })}
                        disabled={disabled} className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50" />
                </Field>
                <Field label={t('editor.fields.unit')}>
                    <Input value={content.unit || ''}
                        onChange={(e) => onChange({ content: { ...content, unit: e.target.value } })}
                        disabled={disabled} className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50" />
                </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <Field label={t('editor.fields.correctValue')}>
                    <Input type="number" value={exercise.correct_answer?.correctValue ?? ''}
                        onChange={(e) => onChange({ correct_answer: { ...exercise.correct_answer, correctValue: parseFloat(e.target.value) } })}
                        disabled={disabled} className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50" />
                </Field>
                <Field label={t('editor.fields.tolerance')}>
                    <Input type="number" value={exercise.correct_answer?.tolerance ?? ''}
                        onChange={(e) => onChange({ correct_answer: { ...exercise.correct_answer, tolerance: parseFloat(e.target.value) } })}
                        disabled={disabled} className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50" />
                </Field>
            </div>
            <FeedbackFields exercise={exercise} onChange={onChange} disabled={disabled} t={t} />
        </div>
    );
};

// ── Shared input style ──
const inputCls = "dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50";

// ── Foundation: fill_blank ──
const FillBlankEditor: React.FC<ExerciseEditorProps> = ({ exercise, onChange, disabled, t }) => {
    const c = exercise.content || {};
    return (
        <div className="space-y-4">
            <Field label={t('editor.fields.instruction')}>
                <Input value={c.instruction || ''} onChange={(e) => onChange({ content: { ...c, instruction: e.target.value } })} disabled={disabled} className={inputCls} />
            </Field>
            <Field label="Segments">
                <DynamicList items={c.segments || []} onUpdate={(s) => onChange({ content: { ...c, segments: s } })}
                    addLabel={t('editor.fields.addItem')} disabled={disabled}
                    newItem={() => ({ type: 'text', text: '' })}
                    renderItem={(item, _, onC) => (
                        <div className="flex gap-2">
                            <select value={item.type || 'text'} onChange={(e) => onC({ ...item, type: e.target.value })} disabled={disabled} className={`rounded border px-2 py-1 text-sm ${inputCls}`}>
                                <option value="text">Text</option><option value="blank">Blank</option>
                            </select>
                            <Input value={item.text || item.id || ''} onChange={(e) => onC({ ...item, [item.type === 'blank' ? 'id' : 'text']: e.target.value })} disabled={disabled} className={`flex-1 ${inputCls}`} placeholder={item.type === 'blank' ? 'blank_id' : 'Text'} />
                        </div>
                    )} />
            </Field>
            <Field label={t('editor.fields.options')}>
                <DynamicList items={c.options || []} onUpdate={(o) => onChange({ content: { ...c, options: o } })}
                    addLabel={t('editor.fields.addOption')} disabled={disabled}
                    newItem={() => ({ id: `opt_${Date.now()}`, text: '' })}
                    renderItem={(item, _, onC) => <Input value={item.text || ''} onChange={(e) => onC({ ...item, text: e.target.value })} disabled={disabled} className={inputCls} placeholder={t('editor.fields.optionText')} />} />
            </Field>
            <FeedbackFields exercise={exercise} onChange={onChange} disabled={disabled} t={t} />
        </div>
    );
};

// ── Foundation: classification ──
const ClassificationEditor: React.FC<ExerciseEditorProps> = ({ exercise, onChange, disabled, t }) => {
    const c = exercise.content || {};
    return (
        <div className="space-y-4">
            <Field label={t('editor.fields.instruction')}>
                <Input value={c.instruction || ''} onChange={(e) => onChange({ content: { ...c, instruction: e.target.value } })} disabled={disabled} className={inputCls} />
            </Field>
            <Field label={t('editor.fields.categories')}>
                <DynamicList items={c.categories || []} onUpdate={(cats) => onChange({ content: { ...c, categories: cats } })}
                    addLabel={t('editor.fields.addCategory')} disabled={disabled}
                    newItem={() => ({ id: `cat_${Date.now()}`, label: '' })}
                    renderItem={(item, _, onC) => <Input value={item.label || ''} onChange={(e) => onC({ ...item, label: e.target.value })} disabled={disabled} className={inputCls} placeholder={t('editor.fields.categoryLabel')} />} />
            </Field>
            <Field label={t('editor.fields.items')}>
                <DynamicList items={c.items || []} onUpdate={(its) => onChange({ content: { ...c, items: its } })}
                    addLabel={t('editor.fields.addItem')} disabled={disabled}
                    newItem={() => ({ id: `item_${Date.now()}`, text: '' })}
                    renderItem={(item, _, onC) => <Input value={item.text || ''} onChange={(e) => onC({ ...item, text: e.target.value })} disabled={disabled} className={inputCls} placeholder={t('editor.fields.itemText')} />} />
            </Field>
            <FeedbackFields exercise={exercise} onChange={onChange} disabled={disabled} t={t} />
        </div>
    );
};

// ── Foundation: sequencing ──
const SequencingEditor: React.FC<ExerciseEditorProps> = ({ exercise, onChange, disabled, t }) => {
    const c = exercise.content || {};
    return (
        <div className="space-y-4">
            <Field label={t('editor.fields.instruction')}>
                <Input value={c.instruction || ''} onChange={(e) => onChange({ content: { ...c, instruction: e.target.value } })} disabled={disabled} className={inputCls} />
            </Field>
            <Field label={`${t('editor.fields.items')} (en orden correcto)`}>
                <DynamicList items={c.items || []} onUpdate={(its) => onChange({ content: { ...c, items: its }, correct_answer: { sequence: its.map((i: any) => i.id) } })}
                    addLabel={t('editor.fields.addItem')} disabled={disabled}
                    newItem={() => ({ id: `step_${Date.now()}`, text: '' })}
                    renderItem={(item, idx, onC) => (
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 w-5">{idx + 1}</span>
                            <Input value={item.text || ''} onChange={(e) => onC({ ...item, text: e.target.value })} disabled={disabled} className={`flex-1 ${inputCls}`} />
                        </div>
                    )} />
            </Field>
            <FeedbackFields exercise={exercise} onChange={onChange} disabled={disabled} t={t} />
        </div>
    );
};

// ── Foundation: story_mode ──
const StoryModeEditor: React.FC<ExerciseEditorProps> = ({ exercise, onChange, disabled, t }) => {
    const { i18n } = useTranslation();
    const c = exercise.content || {};
    const characterCode = exercise.character_code || 'dina'; // Default fallback for preview
    const gestureOptions = getGestureLabels(characterCode);

    return (
        <div className="space-y-4">
            <Field label={t('editor.fields.pages')}>
                <DynamicList items={c.pages || []} onUpdate={(p) => onChange({ content: { ...c, pages: p } })}
                    addLabel={t('editor.fields.addPage')} disabled={disabled}
                    newItem={() => ({ id: `page_${Date.now()}`, text: '', character_mood: 'happy' })}
                    renderItem={(item, idx, onC) => (
                        <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border dark:border-slate-600">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-400">📄 {idx + 1}</span>
                                <div className="flex items-center gap-2">
                                    <Label className="text-[10px] uppercase font-bold text-gray-400">{t('editor.fields.pageMood')}</Label>
                                    <Select
                                        value={item.character_mood || 'happy'}
                                        onValueChange={(v) => onC({ ...item, character_mood: v })}
                                        disabled={disabled}
                                    >
                                        <SelectTrigger className="w-32 h-7 text-xs dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="dark:bg-slate-700 dark:border-slate-600">
                                            {gestureOptions.map((g) => (
                                                <SelectItem key={g.value} value={g.value} className="text-xs dark:text-slate-50">
                                                    {g.emoji} {i18n.language === 'en' ? g.labelEn : g.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {/* Mini Preview */}
                                    <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-900 dark:border-slate-600 border overflow-hidden flex items-center justify-center">
                                        {(() => {
                                            const cls = "w-full h-full";
                                            const mood = item.character_mood;
                                            switch (characterCode) {
                                                case 'dina': return <DinaCharacter className={cls} expression={(mood || 'happy') as any} />;
                                                case 'dr_rho': return <DrRhoCharacter className={cls} mood={(mood || 'wise') as any} />;
                                                case 'zara_vex': return <ZaraVexCharacter className={cls} mood={(mood || 'happy') as any} />;
                                                default: return <DinoCharacter className={cls} mood={(mood || 'happy') as any} showBubble={false} />;
                                            }
                                        })()}
                                    </div>
                                </div>
                            </div>
                            <Textarea value={item.text || ''} onChange={(e) => onC({ ...item, text: e.target.value })} disabled={disabled} rows={2} className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50" placeholder={t('editor.fields.pageText')} />
                        </div>
                    )} />
            </Field>
        </div>
    );
};

// ── Shared: OptionBased editor (used by multiple types) ──
const OptionBasedEditor: React.FC<ExerciseEditorProps & { questionLabel?: string }> = ({ exercise, onChange, disabled, t, questionLabel }) => {
    const c = exercise.content || {};
    const options = c.options || c.risk_options || [];
    const optKey = c.risk_options ? 'risk_options' : 'options';
    return (
        <div className="space-y-4">
            <Field label={questionLabel || t('editor.fields.question')}>
                <Textarea value={c.question || c.context || ''} onChange={(e) => onChange({ content: { ...c, [c.context !== undefined ? 'context' : 'question']: e.target.value } })} disabled={disabled} rows={2} className={inputCls} />
            </Field>
            {c.instruction !== undefined && (
                <Field label={t('editor.fields.instruction')}>
                    <Input value={c.instruction || ''} onChange={(e) => onChange({ content: { ...c, instruction: e.target.value } })} disabled={disabled} className={inputCls} />
                </Field>
            )}
            <Field label={t('editor.fields.options')}>
                <DynamicList items={options} onUpdate={(o) => onChange({ content: { ...c, [optKey]: o } })}
                    addLabel={t('editor.fields.addOption')} disabled={disabled}
                    newItem={() => ({ id: `opt_${Date.now()}`, text: '' })}
                    renderItem={(item, _, onC) => <Input value={item.text || item.title || ''} onChange={(e) => onC({ ...item, text: e.target.value })} disabled={disabled} className={inputCls} placeholder={t('editor.fields.optionText')} />} />
            </Field>
            <Field label={t('editor.fields.correctOption')}>
                <select value={exercise.correct_answer?.correctOptionId || exercise.correct_answer?.bestOffer || ''} onChange={(e) => onChange({ correct_answer: { correctOptionId: e.target.value } })} disabled={disabled} className={`w-full rounded-md border px-3 py-2 text-sm ${inputCls}`}>
                    <option value="">--</option>
                    {options.map((o: any) => <option key={o.id} value={o.id}>{o.text || o.title || o.id}</option>)}
                </select>
            </Field>
            <FeedbackFields exercise={exercise} onChange={onChange} disabled={disabled} t={t} />
        </div>
    );
};

// ── Shared: ItemsList editor (sequencing-like with correct order) ──
const ItemsOrderEditor: React.FC<ExerciseEditorProps & { itemFields?: string[] }> = ({ exercise, onChange, disabled, t }) => {
    const c = exercise.content || {};
    const items = c.items || c.expenses || c.goals || c.concepts || [];
    const listKey = c.expenses ? 'expenses' : c.goals ? 'goals' : c.concepts ? 'concepts' : 'items';
    const orderKey = c.concepts ? 'sequence' : 'order';
    return (
        <div className="space-y-4">
            <Field label={t('editor.fields.instruction')}>
                <Input value={c.instruction || c.question || ''} onChange={(e) => onChange({ content: { ...c, [c.question !== undefined ? 'question' : 'instruction']: e.target.value } })} disabled={disabled} className={inputCls} />
            </Field>
            <Field label={t('editor.fields.items')}>
                <DynamicList items={items} onUpdate={(its) => onChange({ content: { ...c, [listKey]: its }, correct_answer: { [orderKey]: its.map((i: any) => i.id) } })}
                    addLabel={t('editor.fields.addItem')} disabled={disabled}
                    newItem={() => ({ id: `item_${Date.now()}`, text: '', name: '' })}
                    renderItem={(item, idx, onC) => (
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 w-5">{idx + 1}</span>
                            <Input value={item.text || item.name || item.title || item.label || ''} onChange={(e) => onC({ ...item, text: e.target.value, name: e.target.value })} disabled={disabled} className={`flex-1 ${inputCls}`} />
                        </div>
                    )} />
            </Field>
            <FeedbackFields exercise={exercise} onChange={onChange} disabled={disabled} t={t} />
        </div>
    );
};

// ── Interactive: roleplay_chat ──
const RoleplayChatEditor: React.FC<ExerciseEditorProps> = ({ exercise, onChange, disabled, t }) => {
    const c = exercise.content || {};
    return (
        <div className="space-y-4">
            <Field label={t('editor.fields.context')}>
                <Textarea value={c.context || ''} onChange={(e) => onChange({ content: { ...c, context: e.target.value } })} disabled={disabled} rows={2} className={inputCls} />
            </Field>
            <Field label={t('editor.fields.dialogue')}>
                <DynamicList items={c.dialogue || []} onUpdate={(d) => onChange({ content: { ...c, dialogue: d } })}
                    addLabel={t('editor.fields.addItem')} disabled={disabled}
                    newItem={() => ({ sender: 'character', text: '' })}
                    renderItem={(item, _, onC) => (
                        <div className="flex gap-2">
                            <select value={item.sender || 'character'} onChange={(e) => onC({ ...item, sender: e.target.value })} disabled={disabled} className={`rounded border px-2 py-1 text-sm w-28 ${inputCls}`}>
                                <option value="character">Character</option><option value="user">User</option><option value="narrator">Narrator</option>
                            </select>
                            <Input value={item.text || ''} onChange={(e) => onC({ ...item, text: e.target.value })} disabled={disabled} className={`flex-1 ${inputCls}`} />
                        </div>
                    )} />
            </Field>
            <Field label={t('editor.fields.choices')}>
                <DynamicList items={c.choices || []} onUpdate={(ch) => onChange({ content: { ...c, choices: ch } })}
                    addLabel={t('editor.fields.addChoice')} disabled={disabled}
                    newItem={() => ({ id: `ch_${Date.now()}`, text: '' })}
                    renderItem={(item, _, onC) => <Input value={item.text || ''} onChange={(e) => onC({ ...item, text: e.target.value })} disabled={disabled} className={inputCls} />} />
            </Field>
            <Field label={t('editor.fields.correctOption')}>
                <select value={exercise.correct_answer?.correctOptionId || ''} onChange={(e) => onChange({ correct_answer: { correctOptionId: e.target.value } })} disabled={disabled} className={`w-full rounded-md border px-3 py-2 text-sm ${inputCls}`}>
                    <option value="">--</option>
                    {(c.choices || []).map((o: any) => <option key={o.id} value={o.id}>{o.text || o.id}</option>)}
                </select>
            </Field>
            <FeedbackFields exercise={exercise} onChange={onChange} disabled={disabled} t={t} />
        </div>
    );
};

// ── Interactive: quiz_battle ──
const QuizBattleEditor: React.FC<ExerciseEditorProps> = ({ exercise, onChange, disabled, t }) => {
    const c = exercise.content || {};
    return (
        <div className="space-y-4">
            <Field label="Questions">
                <DynamicList items={c.questions || []} onUpdate={(q) => onChange({ content: { ...c, questions: q } })}
                    addLabel={t('editor.fields.addItem')} disabled={disabled}
                    newItem={() => ({ id: `q_${Date.now()}`, question: '', options: [{ id: 'a', text: '' }, { id: 'b', text: '' }], correctId: 'a' })}
                    renderItem={(item, idx, onC) => (
                        <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border dark:border-slate-600">
                            <span className="text-xs font-bold text-gray-400">Q{idx + 1}</span>
                            <Input value={item.question || ''} onChange={(e) => onC({ ...item, question: e.target.value })} disabled={disabled} className={inputCls} placeholder={t('editor.fields.question')} />
                        </div>
                    )} />
            </Field>
            <Field label="Min Score">
                <Input type="number" value={exercise.correct_answer?.minScore ?? ''} onChange={(e) => onChange({ correct_answer: { minScore: parseInt(e.target.value) } })} disabled={disabled} className={inputCls} />
            </Field>
            <FeedbackFields exercise={exercise} onChange={onChange} disabled={disabled} t={t} />
        </div>
    );
};

// ── Economy: shop_sim ──
const ShopSimEditor: React.FC<ExerciseEditorProps> = ({ exercise, onChange, disabled, t }) => {
    const c = exercise.content || {};
    return (
        <div className="space-y-4">
            <Field label={t('editor.fields.instruction')}>
                <Input value={c.instruction || ''} onChange={(e) => onChange({ content: { ...c, instruction: e.target.value } })} disabled={disabled} className={inputCls} />
            </Field>
            <Field label={t('editor.fields.budget')}>
                <Input type="number" value={c.budget ?? ''} onChange={(e) => onChange({ content: { ...c, budget: parseFloat(e.target.value) } })} disabled={disabled} className={inputCls} />
            </Field>
            <Field label={t('editor.fields.products')}>
                <DynamicList items={c.products || []} onUpdate={(p) => onChange({ content: { ...c, products: p } })}
                    addLabel={t('editor.fields.addProduct')} disabled={disabled}
                    newItem={() => ({ id: `prod_${Date.now()}`, name: '', price: 0 })}
                    renderItem={(item, _, onC) => (
                        <div className="grid grid-cols-2 gap-2">
                            <Input value={item.name || ''} onChange={(e) => onC({ ...item, name: e.target.value })} disabled={disabled} className={inputCls} placeholder={t('editor.fields.productName')} />
                            <Input type="number" value={item.price ?? ''} onChange={(e) => onC({ ...item, price: parseFloat(e.target.value) })} disabled={disabled} className={inputCls} placeholder={t('editor.fields.price')} />
                        </div>
                    )} />
            </Field>
            <FeedbackFields exercise={exercise} onChange={onChange} disabled={disabled} t={t} />
        </div>
    );
};

// ── Economy: coin_counter ──
const CoinCounterEditor: React.FC<ExerciseEditorProps> = ({ exercise, onChange, disabled, t }) => {
    const c = exercise.content || {};
    return (
        <div className="space-y-4">
            <Field label={t('editor.fields.instruction')}>
                <Input value={c.instruction || ''} onChange={(e) => onChange({ content: { ...c, instruction: e.target.value } })} disabled={disabled} className={inputCls} />
            </Field>
            <Field label={t('editor.fields.targetAmount')}>
                <Input type="number" value={c.targetAmount ?? ''} onChange={(e) => onChange({ content: { ...c, targetAmount: parseFloat(e.target.value) } })} disabled={disabled} className={inputCls} />
            </Field>
            <Field label={t('editor.fields.coins')}>
                <DynamicList items={c.coins_available || []} onUpdate={(coins) => onChange({ content: { ...c, coins_available: coins } })}
                    addLabel={t('editor.fields.addItem')} disabled={disabled}
                    newItem={() => ({ value: 1, image: '' })}
                    renderItem={(item, _, onC) => (
                        <div className="flex gap-2">
                            <Input type="number" value={item.value ?? ''} onChange={(e) => onC({ ...item, value: parseFloat(e.target.value) })} disabled={disabled} className={`w-24 ${inputCls}`} placeholder={t('editor.fields.value')} />
                            <Input value={item.image || ''} onChange={(e) => onC({ ...item, image: e.target.value })} disabled={disabled} className={`flex-1 ${inputCls}`} placeholder="Image URL" />
                        </div>
                    )} />
            </Field>
        </div>
    );
};

// ── Economy: bill_splitter ──
const BillSplitterEditor: React.FC<ExerciseEditorProps> = ({ exercise, onChange, disabled, t }) => {
    const c = exercise.content || {};
    return (
        <div className="space-y-4">
            <Field label={t('editor.fields.instruction')}>
                <Input value={c.instruction || ''} onChange={(e) => onChange({ content: { ...c, instruction: e.target.value } })} disabled={disabled} className={inputCls} />
            </Field>
            <Field label="People">
                <DynamicList items={c.people || []} onUpdate={(p) => onChange({ content: { ...c, people: p } })}
                    addLabel={t('editor.fields.addItem')} disabled={disabled}
                    newItem={() => ({ id: `p_${Date.now()}`, name: '' })}
                    renderItem={(item, _, onC) => <Input value={item.name || ''} onChange={(e) => onC({ ...item, name: e.target.value })} disabled={disabled} className={inputCls} />} />
            </Field>
            <Field label={t('editor.fields.items')}>
                <DynamicList items={c.items || []} onUpdate={(i) => onChange({ content: { ...c, items: i } })}
                    addLabel={t('editor.fields.addItem')} disabled={disabled}
                    newItem={() => ({ id: `item_${Date.now()}`, name: '', price: 0 })}
                    renderItem={(item, _, onC) => (
                        <div className="grid grid-cols-2 gap-2">
                            <Input value={item.name || ''} onChange={(e) => onC({ ...item, name: e.target.value })} disabled={disabled} className={inputCls} />
                            <Input type="number" value={item.price ?? ''} onChange={(e) => onC({ ...item, price: parseFloat(e.target.value) })} disabled={disabled} className={inputCls} placeholder={t('editor.fields.price')} />
                        </div>
                    )} />
            </Field>
            <FeedbackFields exercise={exercise} onChange={onChange} disabled={disabled} t={t} />
        </div>
    );
};

// ── Economy: budget_builder ──
const BudgetBuilderEditor: React.FC<ExerciseEditorProps> = ({ exercise, onChange, disabled, t }) => {
    const c = exercise.content || {};
    return (
        <div className="space-y-4">
            <Field label={t('editor.fields.instruction')}>
                <Input value={c.instruction || ''} onChange={(e) => onChange({ content: { ...c, instruction: e.target.value } })} disabled={disabled} className={inputCls} />
            </Field>
            <Field label={t('editor.fields.budget')}>
                <Input type="number" value={c.budget ?? ''} onChange={(e) => onChange({ content: { ...c, budget: parseFloat(e.target.value) } })} disabled={disabled} className={inputCls} />
            </Field>
            <Field label={t('editor.fields.items')}>
                <DynamicList items={c.items || []} onUpdate={(i) => onChange({ content: { ...c, items: i } })}
                    addLabel={t('editor.fields.addItem')} disabled={disabled}
                    newItem={() => ({ id: `item_${Date.now()}`, name: '', cost: 0 })}
                    renderItem={(item, _, onC) => (
                        <div className="grid grid-cols-2 gap-2">
                            <Input value={item.name || ''} onChange={(e) => onC({ ...item, name: e.target.value })} disabled={disabled} className={inputCls} />
                            <Input type="number" value={item.cost ?? ''} onChange={(e) => onC({ ...item, cost: parseFloat(e.target.value) })} disabled={disabled} className={inputCls} placeholder="Cost" />
                        </div>
                    )} />
            </Field>
            <Field label={t('editor.fields.categories')}>
                <DynamicList items={c.categories || []} onUpdate={(cats) => onChange({ content: { ...c, categories: cats } })}
                    addLabel={t('editor.fields.addCategory')} disabled={disabled}
                    newItem={() => ('')}
                    renderItem={(item, _, onC) => <Input value={item || ''} onChange={(e) => onC(e.target.value)} disabled={disabled} className={inputCls} placeholder={t('editor.fields.categoryLabel')} />} />
            </Field>
            <FeedbackFields exercise={exercise} onChange={onChange} disabled={disabled} t={t} />
        </div>
    );
};

// ── Shared: Exploratory editor (instruction + structured content, no correct answer) ──
const ExploratoryEditor: React.FC<ExerciseEditorProps> = ({ exercise, onChange, disabled, t }) => {
    const c = exercise.content || {};
    return (
        <div className="space-y-4">
            <Field label={t('editor.fields.instruction')}>
                <Textarea value={c.instruction || c.question || c.scenario || ''} onChange={(e) => onChange({ content: { ...c, instruction: e.target.value } })} disabled={disabled} rows={3} className={inputCls} />
            </Field>
            {c.goal !== undefined && (
                <Field label="Goal">
                    <Input value={c.goal || ''} onChange={(e) => onChange({ content: { ...c, goal: e.target.value } })} disabled={disabled} className={inputCls} />
                </Field>
            )}
            {c.targetIncome !== undefined && (
                <Field label={t('editor.fields.targetAmount')}>
                    <Input type="number" value={c.targetIncome ?? ''} onChange={(e) => onChange({ content: { ...c, targetIncome: parseFloat(e.target.value) } })} disabled={disabled} className={inputCls} />
                </Field>
            )}
            {c.initialFund !== undefined && (
                <Field label="Initial Fund">
                    <Input type="number" value={c.initialFund ?? ''} onChange={(e) => onChange({ content: { ...c, initialFund: parseFloat(e.target.value) } })} disabled={disabled} className={inputCls} />
                </Field>
            )}
            {c.initialScore !== undefined && (
                <Field label="Initial Score">
                    <Input type="number" value={c.initialScore ?? ''} onChange={(e) => onChange({ content: { ...c, initialScore: parseInt(e.target.value) } })} disabled={disabled} className={inputCls} />
                </Field>
            )}
            {c.monthlyPayment !== undefined && (
                <Field label="Monthly Payment">
                    <Input type="number" value={c.monthlyPayment ?? ''} onChange={(e) => onChange({ content: { ...c, monthlyPayment: parseFloat(e.target.value) } })} disabled={disabled} className={inputCls} />
                </Field>
            )}
            {c.inflationRate !== undefined && (
                <Field label="Inflation Rate (%)">
                    <Input type="number" value={c.inflationRate ?? ''} onChange={(e) => onChange({ content: { ...c, inflationRate: parseFloat(e.target.value) } })} disabled={disabled} className={inputCls} />
                </Field>
            )}
            {c.budget !== undefined && (
                <Field label={t('editor.fields.budget')}>
                    <Input type="number" value={c.budget ?? ''} onChange={(e) => onChange({ content: { ...c, budget: parseFloat(e.target.value) } })} disabled={disabled} className={inputCls} />
                </Field>
            )}
            {(c.strategies || c.events || c.streams || c.debts || c.pieces || c.assets || c.scenarios || c.causes || c.boxes || c.offers) && (
                <Field label={t('editor.fields.items')}>
                    <Textarea value={JSON.stringify(c.strategies || c.events || c.streams || c.debts || c.pieces || c.assets || c.scenarios || c.causes || c.boxes || c.offers || [], null, 2)}
                        onChange={(e) => {
                            try {
                                const parsed = JSON.parse(e.target.value);
                                const key = c.strategies ? 'strategies' : c.events ? 'events' : c.streams ? 'streams' : c.debts ? 'debts' : c.pieces ? 'pieces' : c.assets ? 'assets' : c.scenarios ? 'scenarios' : c.causes ? 'causes' : c.boxes ? 'boxes' : 'offers';
                                onChange({ content: { ...c, [key]: parsed } });
                            } catch { /* ignore */ }
                        }}
                        disabled={disabled} rows={6} className={`font-mono text-xs ${inputCls}`} />
                </Field>
            )}
            {(c.product) && (
                <div className="grid grid-cols-3 gap-3">
                    <Field label="Product Name"><Input value={c.product?.name || ''} onChange={(e) => onChange({ content: { ...c, product: { ...c.product, name: e.target.value } } })} disabled={disabled} className={inputCls} /></Field>
                    <Field label="Base Price"><Input type="number" value={c.product?.basePrice ?? ''} onChange={(e) => onChange({ content: { ...c, product: { ...c.product, basePrice: parseFloat(e.target.value) } } })} disabled={disabled} className={inputCls} /></Field>
                    <Field label="Base Year"><Input type="number" value={c.product?.baseYear ?? ''} onChange={(e) => onChange({ content: { ...c, product: { ...c.product, baseYear: parseInt(e.target.value) } } })} disabled={disabled} className={inputCls} /></Field>
                </div>
            )}
            {(c.scarcity || c.abundance) && (
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Scarcity Thought"><Textarea value={c.scarcity?.thought || ''} onChange={(e) => onChange({ content: { ...c, scarcity: { ...c.scarcity, thought: e.target.value } } })} disabled={disabled} rows={2} className={inputCls} /></Field>
                    <Field label="Abundance Thought"><Textarea value={c.abundance?.thought || ''} onChange={(e) => onChange({ content: { ...c, abundance: { ...c.abundance, thought: e.target.value } } })} disabled={disabled} rows={2} className={inputCls} /></Field>
                </div>
            )}
        </div>
    );
};

// ── Spot Trap (items with isTrap flag, like tap_action) ──
const SpotTrapEditor: React.FC<ExerciseEditorProps> = ({ exercise, onChange, disabled, t }) => {
    const c = exercise.content || {};
    return (
        <div className="space-y-4">
            <Field label={t('editor.fields.instruction')}>
                <Input value={c.instruction || ''} onChange={(e) => onChange({ content: { ...c, instruction: e.target.value } })} disabled={disabled} className={inputCls} />
            </Field>
            <Field label="Messages">
                <DynamicList items={c.messages || []} onUpdate={(msgs) => onChange({ content: { ...c, messages: msgs }, correct_answer: { trapIds: msgs.filter((m: any) => m.isTrap).map((m: any) => m.id) } })}
                    addLabel={t('editor.fields.addItem')} disabled={disabled}
                    newItem={() => ({ id: `msg_${Date.now()}`, sender: '', text: '', isTrap: false })}
                    renderItem={(item, _, onC) => (
                        <div className="flex items-center gap-2">
                            <Input value={item.sender || ''} onChange={(e) => onC({ ...item, sender: e.target.value })} disabled={disabled} className={`w-24 ${inputCls}`} placeholder={t('editor.fields.sender')} />
                            <Input value={item.text || ''} onChange={(e) => onC({ ...item, text: e.target.value })} disabled={disabled} className={`flex-1 ${inputCls}`} />
                            <div className="flex items-center gap-1 shrink-0">
                                <Switch checked={item.isTrap || false} onCheckedChange={(v) => onC({ ...item, isTrap: v })} disabled={disabled} />
                                <span className="text-xs dark:text-slate-400">🪤</span>
                            </div>
                        </div>
                    )} />
            </Field>
            <FeedbackFields exercise={exercise} onChange={onChange} disabled={disabled} t={t} />
        </div>
    );
};

// ── Mystery Investment ──
const MysteryInvestmentEditor: React.FC<ExerciseEditorProps> = ({ exercise, onChange, disabled, t }) => {
    const c = exercise.content || {};
    return (
        <div className="space-y-4">
            <Field label={t('editor.fields.instruction')}>
                <Input value={c.instruction || ''} onChange={(e) => onChange({ content: { ...c, instruction: e.target.value } })} disabled={disabled} className={inputCls} />
            </Field>
            <Field label="Total Coins">
                <Input type="number" value={c.totalCoins ?? ''} onChange={(e) => onChange({ content: { ...c, totalCoins: parseInt(e.target.value) } })} disabled={disabled} className={inputCls} />
            </Field>
            <Field label="Boxes">
                <DynamicList items={c.boxes || []} onUpdate={(b) => onChange({ content: { ...c, boxes: b } })}
                    addLabel={t('editor.fields.addItem')} disabled={disabled}
                    newItem={() => ({ id: `box_${Date.now()}`, name: '', type: 'safe', minReturn: 0, maxReturn: 10 })}
                    renderItem={(item, _, onC) => (
                        <div className="grid grid-cols-4 gap-2">
                            <Input value={item.name || ''} onChange={(e) => onC({ ...item, name: e.target.value })} disabled={disabled} className={inputCls} placeholder="Name" />
                            <select value={item.type || 'safe'} onChange={(e) => onC({ ...item, type: e.target.value })} disabled={disabled} className={`rounded border px-2 py-1 text-sm ${inputCls}`}>
                                <option value="safe">Safe</option><option value="moderate">Moderate</option><option value="risky">Risky</option>
                            </select>
                            <Input type="number" value={item.minReturn ?? ''} onChange={(e) => onC({ ...item, minReturn: parseFloat(e.target.value) })} disabled={disabled} className={inputCls} placeholder="Min" />
                            <Input type="number" value={item.maxReturn ?? ''} onChange={(e) => onC({ ...item, maxReturn: parseFloat(e.target.value) })} disabled={disabled} className={inputCls} placeholder="Max" />
                        </div>
                    )} />
            </Field>
            <Field label="Min Boxes Required">
                <Input type="number" value={exercise.correct_answer?.minBoxes ?? ''} onChange={(e) => onChange({ correct_answer: { minBoxes: parseInt(e.target.value) } })} disabled={disabled} className={inputCls} />
            </Field>
            <FeedbackFields exercise={exercise} onChange={onChange} disabled={disabled} t={t} />
        </div>
    );
};

// ── Interest Calculator ──
const InterestCalculatorEditor: React.FC<ExerciseEditorProps> = ({ exercise, onChange, disabled, t }) => {
    const c = exercise.content || {};
    return (
        <div className="space-y-4">
            <Field label={t('editor.fields.instruction')}>
                <Input value={c.instruction || ''} onChange={(e) => onChange({ content: { ...c, instruction: e.target.value } })} disabled={disabled} className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Type">
                    <select value={c.type || 'simple'} onChange={(e) => onChange({ content: { ...c, type: e.target.value } })} disabled={disabled} className={`w-full rounded border px-3 py-2 text-sm ${inputCls}`}>
                        <option value="simple">Simple</option><option value="compound">Compound</option>
                    </select>
                </Field>
                <Field label="Default Principal"><Input type="number" value={c.defaultPrincipal ?? ''} onChange={(e) => onChange({ content: { ...c, defaultPrincipal: parseFloat(e.target.value) } })} disabled={disabled} className={inputCls} /></Field>
                <Field label="Default Rate (%)"><Input type="number" value={c.defaultRate ?? ''} onChange={(e) => onChange({ content: { ...c, defaultRate: parseFloat(e.target.value) } })} disabled={disabled} className={inputCls} /></Field>
                <Field label="Default Time (years)"><Input type="number" value={c.defaultTime ?? ''} onChange={(e) => onChange({ content: { ...c, defaultTime: parseInt(e.target.value) } })} disabled={disabled} className={inputCls} /></Field>
            </div>
        </div>
    );
};

// ── Editor registry ──

const EDITOR_REGISTRY: Record<string, React.FC<ExerciseEditorProps>> = {
    // Foundation
    intro_narrative: IntroNarrativeEditor,
    multiple_choice: MultipleChoiceEditor,
    true_false: TrueFalseEditor,
    fill_blank: FillBlankEditor,
    classification: ClassificationEditor,
    matching_pairs: MatchingPairsEditor,
    sequencing: SequencingEditor,
    tap_action: TapActionEditor,
    story_mode: StoryModeEditor,
    math_challenge: MathChallengeEditor,
    word_scramble: WordScrambleEditor,
    // Interactive
    roleplay_chat: RoleplayChatEditor,
    estimation_slider: EstimationSliderEditor,
    risk_reward: OptionBasedEditor,
    concept_builder: ItemsOrderEditor,
    quiz_battle: QuizBattleEditor,
    // Economy
    shop_sim: ShopSimEditor,
    coin_counter: CoinCounterEditor,
    price_detective: OptionBasedEditor,
    bill_splitter: BillSplitterEditor,
    budget_builder: BudgetBuilderEditor,
    expense_timeline: ItemsOrderEditor,
    subscription_tracker: ExploratoryEditor,
    // Savings
    savings_race: ExploratoryEditor,
    emergency_fund: ExploratoryEditor,
    goal_roadmap: ItemsOrderEditor,
    interest_calculator: InterestCalculatorEditor,
    portfolio_builder: ExploratoryEditor,
    mystery_investment: MysteryInvestmentEditor,
    passive_income: ExploratoryEditor,
    opportunity_cost: OptionBasedEditor,
    market_reaction: OptionBasedEditor,
    // Advanced
    inflation_simulator: ExploratoryEditor,
    credit_score: ExploratoryEditor,
    debt_strategy: ExploratoryEditor,
    tax_puzzle: ExploratoryEditor,
    salary_comparison: OptionBasedEditor,
    spot_trap: SpotTrapEditor,
    impact_meter: ExploratoryEditor,
    mindset_comparison: ExploratoryEditor,
};

export function getExerciseEditor(type: string): React.FC<ExerciseEditorProps> {
    return EDITOR_REGISTRY[type] || ExploratoryEditor;
}
