import type { AnimationEvent, ReactNode } from 'react';
import type { CopyRole } from './copyBudget';
import { Glyph } from './glyphs';
import { useOneShot } from './motion';
import './controls.css';

/*
 * The shared control set of the rebuilt frontend (Frontend Bible 02; S03.1).
 * Every rebuilt surface imports its controls from here and never from the
 * legacy application (02 rule 23).
 */
export { Button, ButtonGroup, ButtonLink, IconButton, type ButtonProps, type ButtonSize, type ButtonVariant, type IconButtonVariant } from './buttons';
export { ConfirmDialog, DestructiveAction, Dialog, Menu, Popover, Sheet, Tooltip,
  type ConfirmDialogProps, type DialogProps, type MenuItem, type MenuTriggerProps, type PopoverTriggerProps, type SheetProps, type TooltipTriggerProps } from './overlays';
export { RebuildProvider, useAnnounce, useToast, type Politeness, type ToastOptions, type ToastTone } from './feedback';
export { useRebuildEnvironment, type RebuildEnvironment, type RebuildTheme } from './layers';
export { AuthShell, BrandMark, CONSOLE_TAB_LIMIT, ConsoleShell, DashboardLayout, DataTable, LearnerShell, permittedStaffItems, SingleStateScreen, SiteShell, SkipLink,
  STAFF_PERMISSIONS, StaffShell, TutorShell, useDocumentMeta, useRouteFocus,
  type ConsoleShellProps, type LearnerShellProps, type ShellCommonProps, type ShellLinkAction, type ShellNavItem, type SingleStateHue, type SiteShellProps,
  type StaffGrants, type StaffNavItem, type StaffPermission, type TableColumn } from './shells';
export { Disclosure } from './disclosure';
export { Checkbox, PictureChoice, RadioGroup, SegmentedControl, SelectField, Slider, Stepper, Switch, TextAreaField, TextField,
  type ChoiceOption, type PictureOption, type SelectOption, type StepLabels, type TextFieldProps } from './fields';
export { Art, Banner, Card, Chip, ChipGroup, ChoiceChip, EmptyState, ErrorState, InlineNotice, List, ListRow, LoadingState, MentorAvatar, Pill, ProgressBar, ReplyChip, RewardChip, Skeleton,
  type CardTone, type NoticeTone, type PillTone, type StatusTone } from './display';
export { Glyph, GLYPH_BUDGET, GLYPH_FAMILIES, SYSTEM_GLYPHS, type GlyphName } from './glyphs';
export { BarChart, niceMax, Sparkline, TrendChart, type VizBar, type VizLabels, type VizPoint, type VizSeries } from './charts';
export { activeIdleMotion, Celebration, celebrationPart, CountUp, IDLE_MOTION_KINDS, useIdleMotion, useOneShot,
  type CelebrationPart, type CelebrationState, type IdleMotionKind } from './motion';
export { isMilestone, type Milestone } from './milestones';
export { RebuildRoot } from './root';
export { MENTOR_CHARACTERS, MENTOR_NAMES, type MentorCharacter } from './assets';

export function Copy({ role, children, as: Tag = 'p' }: { role: CopyRole; children: ReactNode; as?: 'p' | 'span' | 'h1' | 'h2' }) {
  return <Tag data-copy-role={role}>{children}</Tag>;
}

/** In-house system glyphs, class A. No identity or character pictograms. */
export function StatusMark({ correct }: { correct: boolean }) {
  return <Glyph name={correct ? 'check' : 'cross'} />;
}

/**
 * Answer option on the full-bleed lesson screen (02 `answer-idle` /
 * `answer-selected`): a rounded rectangle that chooses one of several. It
 * follows the feedback grammar of 02 §9.2: selecting bumps, a correct answer
 * bumps again, "not yet" wobbles. Never a celebration.
 */
export function AnswerChoice({ label, selected, disabled, onSelect, verdict = null }: {
  label: ReactNode; selected: boolean; disabled?: boolean; onSelect: () => void; verdict?: 'correct' | 'retry' | null;
}) {
  const [bump, settleBump] = useOneShot(selected ? (verdict === 'correct' ? 'correct' : 'selected') : null);
  const [wobble, settleWobble] = useOneShot(selected && verdict === 'retry' ? 'retry' : null);
  const motion = wobble ? ' lf-choice--wobble' : bump ? ' lf-choice--bump' : '';
  // Bump and wobble are the row's only animations and never overlap.
  const settle = (event: AnimationEvent<HTMLButtonElement>) => {
    if (event.target !== event.currentTarget) return;
    settleBump();
    settleWobble();
  };
  return <button type="button"
    className={`lf-choice${motion}`} data-copy-role="option" aria-pressed={selected}
    disabled={disabled} onClick={onSelect} onAnimationEnd={settle}>
    <span className="lf-choice-marker" aria-hidden="true">{selected ? '●' : '○'}</span>
    {label}
  </button>;
}
