import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import type { CopyRole } from './copyBudget';
import { Glyph } from './glyphs';
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
export { Checkbox, RadioGroup, SegmentedControl, SelectField, Slider, Stepper, Switch, TextField, type ChoiceOption, type SelectOption, type TextFieldProps } from './fields';
export { Banner, Card, Chip, ChipGroup, ChoiceChip, EmptyState, ErrorState, InlineNotice, List, ListRow, LoadingState, MentorAvatar, Pill, ProgressBar, RewardChip, Skeleton,
  type CardTone, type NoticeTone, type PillTone, type StatusTone } from './display';
export { Glyph, GLYPH_BUDGET, GLYPH_FAMILIES, SYSTEM_GLYPHS, type GlyphName } from './glyphs';

export function Copy({ role, children, as: Tag = 'p' }: { role: CopyRole; children: ReactNode; as?: 'p' | 'span' | 'h1' | 'h2' }) {
  return <Tag data-copy-role={role}>{children}</Tag>;
}

/**
 * The first-generation text field used by the age screen and the preview form.
 * New surfaces use `TextField`, which adds the Bible's error glyph and message
 * placement; this one stays until those surfaces are recomposed (S03 wave 2),
 * because changing it now would not be a pure refactor.
 */
export function Field({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  return <div className="lf-field">
    <label htmlFor={id} data-copy-role="body">{label}</label>
    <input {...props} id={id} aria-describedby={hint ? `${id}-hint` : undefined} />
    {hint ? <p id={`${id}-hint`} data-copy-role="body">{hint}</p> : null}
  </div>;
}

/** In-house system glyphs, class A. No identity or character pictograms. */
export function StatusMark({ correct }: { correct: boolean }) {
  return <Glyph name={correct ? 'check' : 'cross'} />;
}

/**
 * Answer option on the full-bleed lesson screen (02 `answer-idle` /
 * `answer-selected`): a rounded rectangle that chooses one of several.
 */
export function AnswerChoice({ label, selected, disabled, onSelect }: { label: ReactNode; selected: boolean; disabled?: boolean; onSelect: () => void }) {
  return <button type="button"
    className="lf-choice" data-copy-role="option" aria-pressed={selected}
    disabled={disabled} onClick={onSelect}>
    <span className="lf-choice-marker" aria-hidden="true">{selected ? '●' : '○'}</span>
    {label}
  </button>;
}
