import { fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  AnswerChoice, Banner, Button, ButtonGroup, Card, Checkbox, Chip, ChipGroup, ChoiceChip, EmptyState, ErrorState, Glyph, GLYPH_BUDGET,
  GLYPH_FAMILIES, IconButton, InlineNotice, List, ListRow, LoadingState, MentorAvatar, Pill, ProgressBar, RadioGroup, RewardChip,
  SegmentedControl, SelectField, Slider, StatusMark, Stepper, Switch, SYSTEM_GLYPHS, TextField,
} from './controls';
import { resolveMentorRender } from './assets';

/** Every visible string sits inside an element that declares its copy role (02 rule 19). */
function expectCopyRoles(container: HTMLElement) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    const owner = node.parentElement!;
    if (owner.closest('option')) continue;
    expect(owner.closest('[data-copy-role]'), `"${node.textContent}" has no copy role`).not.toBeNull();
  }
  for (const control of container.querySelectorAll('button, a')) {
    expect(control.closest('[data-copy-role]') ?? control.querySelector('[data-copy-role]'), control.outerHTML).not.toBeNull();
  }
}

describe('buttons', () => {
  it('keeps the first-generation markup byte-for-byte for existing callers', () => {
    // The pre-S03.1 implementation, kept here as the reference the refactor must match.
    const legacy = (variant: string, label: string, extra = '') => `<button${extra} type="button" class="lf-button lf-button--${variant}" data-copy-role="action">${label}</button>`;
    expect(renderToStaticMarkup(<Button>{'Go back'}</Button>)).toBe(legacy('secondary', 'Go back'));
    expect(renderToStaticMarkup(<Button variant="accent" disabled>Check</Button>)).toBe(legacy('accent', 'Check', ' disabled=""'));
    expect(renderToStaticMarkup(<Button variant="success" type="submit">Save</Button>))
      .toBe('<button type="submit" class="lf-button lf-button--success" data-copy-role="action">Save</button>');
    expect(renderToStaticMarkup(<StatusMark correct />)).toBe('<svg viewBox="0 0 24 24" aria-hidden="true" class="lf-system-glyph" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l4 4L19 6"></path></svg>');
    expect(renderToStaticMarkup(<StatusMark correct={false} />)).toContain('<path d="M6 6l12 12M18 6L6 18"></path>');
    expect(renderToStaticMarkup(<AnswerChoice label="Save" selected={false} onSelect={() => undefined} />))
      .toBe('<button type="button" class="lf-choice" data-copy-role="option" aria-pressed="false"><span class="lf-choice-marker" aria-hidden="true">○</span>Save</button>');
    expect(renderToStaticMarkup(<AnswerChoice label="Save" selected disabled onSelect={() => undefined} />))
      .toBe('<button type="button" class="lf-choice" data-copy-role="option" aria-pressed="true" disabled=""><span class="lf-choice-marker" aria-hidden="true">●</span>Save</button>');
  });

  it('offers every Bible colour role and size as a class, never an inline colour', () => {
    for (const variant of ['accent', 'brand', 'success', 'reward', 'sky', 'mint', 'berry', 'danger', 'secondary', 'inverse'] as const) {
      render(<Button variant={variant}>{variant}</Button>);
      const button = screen.getByRole('button', { name: variant });
      expect(button).toHaveClass('lf-button', `lf-button--${variant}`);
      expect(button.getAttribute('style')).toBeNull();
    }
    render(<><Button size="sm">small</Button><Button size="lg">large</Button></>);
    expect(screen.getByRole('button', { name: 'small' })).toHaveClass('lf-button--sm');
    expect(screen.getByRole('button', { name: 'large' })).toHaveClass('lf-button--lg');
  });

  it('holds a pending press: focusable, announced as busy, shows the pending label and refuses a second press or submit', () => {
    const onClick = vi.fn(), onSubmit = vi.fn((event: Event) => event.preventDefault());
    render(<form onSubmit={(event) => onSubmit(event.nativeEvent)}><Button type="submit" pending pendingLabel="Saving…" onClick={onClick}>Save</Button></form>);
    const button = screen.getByRole('button', { name: 'Saving…' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
    button.focus();
    expect(button).toHaveFocus();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('requires an accessible name on icon buttons and renders a system glyph only', () => {
    const onClick = vi.fn();
    render(<IconButton glyph="close" label="Close" onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Close' });
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('groups buttons in a wrapping row that is a named group only when labelled', () => {
    const { container } = render(<ButtonGroup><Button>A</Button></ButtonGroup>);
    expect(container.firstElementChild).toHaveClass('lf-button-group');
    expect(container.firstElementChild).not.toHaveAttribute('role');
    render(<ButtonGroup label="Actions"><Button>B</Button></ButtonGroup>);
    expect(screen.getByRole('group', { name: 'Actions' })).toBeInTheDocument();
  });
});

describe('system glyphs', () => {
  it('stays inside the closed list of at most 24 glyph families, all from one in-house source', () => {
    expect(GLYPH_FAMILIES.length).toBeLessThanOrEqual(GLYPH_BUDGET);
    expect(GLYPH_FAMILIES.flat().sort()).toEqual(Object.keys(SYSTEM_GLYPHS).sort());
    for (const paths of Object.values(SYSTEM_GLYPHS)) for (const d of paths) expect(d).toMatch(/^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/);
  });
  it('draws with the stroke spec and is always hidden from assistive technology', () => {
    const { container } = render(<Glyph name="search" />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    expect(svg).toHaveAttribute('stroke-width', '2');
    expect(svg).toHaveAttribute('fill', 'none');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('fields', () => {
  it('labels an input, puts help before it and an error with a glyph directly after it', () => {
    const { container } = render(<TextField label="Goal name" help="Choose something." error="Add a goal name." value="" onChange={() => undefined} />);
    const input = screen.getByLabelText('Goal name');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const described = input.getAttribute('aria-describedby')!.split(' ').map((id) => document.getElementById(id)!.textContent);
    expect(described).toEqual(['Choose something.', 'Add a goal name.']);
    const error = container.querySelector('.lf-input-error')!;
    expect(error.querySelector('svg')).not.toBeNull();
    expect(error.previousElementSibling).toHaveClass('lf-input-box');
    expect(container.querySelector('.lf-input-help')!.nextElementSibling).toHaveClass('lf-input-box');
    expectCopyRoles(container);
  });

  it('supports number and date inputs natively and no error state when valid', () => {
    render(<><TextField type="number" label="Coins" value="4" onChange={() => undefined} /><TextField type="date" label="Start" value="2026-09-24" onChange={() => undefined} /></>);
    expect(screen.getByLabelText('Coins')).toHaveAttribute('type', 'number');
    expect(screen.getByLabelText('Coins')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText('Start')).toHaveAttribute('type', 'date');
  });

  it('reveals and hides a password with a named toggle that controls the input', () => {
    render(<TextField type="password" label="Passphrase" revealLabels={{ show: 'Show passphrase', hide: 'Hide passphrase' }} value="x" onChange={() => undefined} />);
    const input = screen.getByLabelText('Passphrase');
    expect(input).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Show passphrase' }));
    expect(input).toHaveAttribute('type', 'text');
    const hide = screen.getByRole('button', { name: 'Hide passphrase' });
    expect(hide).toHaveAttribute('aria-controls', input.id);
    fireEvent.click(hide);
    expect(input).toHaveAttribute('type', 'password');
  });

  it('renders a labelled native select with its options', () => {
    const onChange = vi.fn();
    render(<SelectField label="Pocket" value="save" onChange={onChange} options={[{ value: 'save', label: 'Save' }, { value: 'spend', label: 'Spend' }]} />);
    const select = screen.getByLabelText('Pocket');
    fireEvent.change(select, { target: { value: 'spend' } });
    expect(onChange).toHaveBeenCalledOnce();
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('keeps the checkbox a native, labelled input with an error description', () => {
    const onChange = vi.fn();
    const { container } = render(<Checkbox label="Remind me" error="Needed." checked={false} onChange={onChange} />);
    const box = screen.getByRole('checkbox', { name: 'Remind me' });
    fireEvent.click(container.querySelector('.lf-check-label')!);
    expect(onChange).toHaveBeenCalledOnce();
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(document.getElementById(box.getAttribute('aria-describedby')!)).toHaveTextContent('Needed.');
  });
});

describe('choose-one controls', () => {
  it('groups radios under a legend and reports the chosen value', () => {
    const onValueChange = vi.fn();
    const { container } = render(<RadioGroup legend="How often?" name="often" value="weekly" onValueChange={onValueChange}
      options={[{ value: 'daily', label: 'Every day' }, { value: 'weekly', label: 'Every week' }]} />);
    expect(screen.getByRole('group', { name: 'How often?' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Every week' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Every day' }));
    expect(onValueChange).toHaveBeenCalledWith('daily');
    expectCopyRoles(container);
  });

  it('marks the selected segment with a check as well as a fill', () => {
    const onValueChange = vi.fn();
    const { container } = render(<SegmentedControl legend="View" name="view" value="chart" onValueChange={onValueChange}
      options={[{ value: 'chart', label: 'Chart' }, { value: 'table', label: 'Table' }]} />);
    const [chart, table] = container.querySelectorAll('.lf-segmented-option');
    expect(chart!.querySelector('svg')).not.toBeNull();
    expect(table!.querySelector('svg')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Table' }));
    expect(onValueChange).toHaveBeenCalledWith('table');
  });

  it('switches with a state word and a check, and ignores presses while pending', () => {
    const onCheckedChange = vi.fn();
    const { rerender } = render(<Switch label="Sounds" checked={false} onCheckedChange={onCheckedChange} stateLabels={{ on: 'On', off: 'Off' }} />);
    const toggle = screen.getByRole('switch', { name: 'Sounds' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle).toHaveTextContent('Off');
    expect(toggle.querySelector('.lf-toggle-thumb svg')).toBeNull();
    fireEvent.click(toggle);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    rerender(<Switch label="Sounds" checked pending onCheckedChange={onCheckedChange} stateLabels={{ on: 'On', off: 'Off' }} />);
    expect(toggle).toHaveTextContent('On');
    expect(toggle.querySelector('.lf-toggle-thumb svg')).not.toBeNull();
    expect(toggle).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(toggle);
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
  });
});

describe('numeric controls', () => {
  it('slides natively and always states the value as text', () => {
    const onValueChange = vi.fn();
    render(<Slider label="Save" valueText="15 coins" min={0} max={50} step={5} value={15} onValueChange={onValueChange} />);
    const slider = screen.getByRole('slider', { name: 'Save' });
    expect(slider).toHaveAttribute('aria-valuetext', '15 coins');
    fireEvent.change(slider, { target: { value: '20' } });
    expect(onValueChange).toHaveBeenCalledWith(20);
    expect(screen.getByText('15 coins').tagName).toBe('OUTPUT');
  });

  it('steps within bounds and disables the button at each bound', () => {
    const onValueChange = vi.fn();
    const { rerender } = render(<Stepper label="Share" value={0} min={0} max={2} onValueChange={onValueChange} labels={{ decrease: 'Less', increase: 'More' }} />);
    expect(screen.getByRole('button', { name: 'Share: Less' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Share: More' }));
    expect(onValueChange).toHaveBeenCalledWith(1);
    rerender(<Stepper label="Share" value={2} min={0} max={2} onValueChange={onValueChange} labels={{ decrease: 'Less', increase: 'More' }} />);
    expect(screen.getByRole('button', { name: 'Share: More' })).toBeDisabled();
    expect(screen.getByRole('group', { name: 'Share' })).toBeInTheDocument();
  });
});

describe('display components', () => {
  it('pairs every status chip with a glyph and a word, and keeps reward gold for coins', () => {
    const { container } = render(<ChipGroup><Chip tone="success" glyph="check">Approved</Chip><RewardChip>40 coins</RewardChip><Pill tone="inverse">Simulation</Pill></ChipGroup>);
    expect(container.querySelector('.lf-status-chip--success svg')).not.toBeNull();
    expect(container.querySelector('.lf-status-chip--reward')).toHaveAttribute('data-copy-role', 'data');
    expectCopyRoles(container);
  });

  it('toggles a choice chip with aria-pressed and a check', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<ChoiceChip selected={false} onToggle={onToggle}>Save</ChoiceChip>);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onToggle).toHaveBeenCalledOnce();
    rerender(<ChoiceChip selected onToggle={onToggle}>Save</ChoiceChip>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Save' }).querySelector('svg')).not.toBeNull();
  });

  it('names cards by their heading and lists rows with an optional press target', () => {
    const onPress = vi.fn();
    const { container } = render(<>
      <Card tone="mint" heading="Money basics"><p data-copy-role="body">3 lessons left.</p></Card>
      <List label="Lessons"><ListRow title="Needs and wants" supporting="Lesson 2 of 5" onPress={onPress} /><ListRow title="Feed the cat" trailing={<span data-copy-role="data">5</span>} /></List>
    </>);
    expect(screen.getByRole('region', { name: 'Money basics' })).toHaveClass('lf-card--mint');
    expect(screen.getByRole('list', { name: 'Lessons' }).children).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /Needs and wants/ }));
    expect(onPress).toHaveBeenCalledOnce();
    expectCopyRoles(container);
  });

  it('announces banners: errors as alerts, everything else as status, each with its glyph', () => {
    render(<><Banner tone="success">Correct.</Banner><Banner tone="retry">Almost.</Banner><Banner tone="error">Could not save.</Banner></>);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save.');
    expect(screen.getAllByRole('status')).toHaveLength(2);
    for (const banner of document.querySelectorAll('.lf-banner')) expect(banner.querySelector('svg')).not.toBeNull();
    // A wrong answer is a retry: never the error hue.
    expect(screen.getByText('Almost.').closest('.lf-banner')).toHaveClass('lf-banner--retry');
  });

  it('keeps inline notices silent unless asked to announce', () => {
    const { container, rerender } = render(<InlineNotice tone="info">Saved.</InlineNotice>);
    expect(container.firstElementChild).not.toHaveAttribute('role');
    rerender(<InlineNotice tone="error" live>Failed.</InlineNotice>);
    expect(screen.getByRole('alert')).toHaveTextContent('Failed.');
  });

  it('exposes progress as a labelled progressbar with a text value and clamps the drawn width', () => {
    const { container } = render(<ProgressBar label="Lesson progress" value={7} max={5} valueText="7 of 5" />);
    const bar = screen.getByRole('progressbar', { name: 'Lesson progress' });
    expect(bar).toHaveAttribute('aria-valuetext', '7 of 5');
    expect((container.querySelector('.lf-progress-fill') as HTMLElement).style.inlineSize).toBe('100%');
  });

  it('shows loading as a status with words and static skeleton lines', () => {
    const { container } = render(<LoadingState label="Loading…" lines={4} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    expect(container.querySelectorAll('.lf-skeleton-line')).toHaveLength(4);
    expect(container.querySelector('.lf-skeleton')).toHaveAttribute('aria-hidden', 'true');
  });

  it('gives empty and error states a heading, and a retry that holds while in flight', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<><EmptyState heading="No tasks yet" body="New tasks show up here." />
      <ErrorState heading="We could not load this." retryLabel="Try again" retryingLabel="Trying again…" onRetry={onRetry} /></>);
    expect(screen.getByRole('region', { name: 'No tasks yet' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
    rerender(<><EmptyState heading="No tasks yet" /><ErrorState heading="We could not load this." retryLabel="Try again" retryingLabel="Trying again…" retrying onRetry={onRetry} /></>);
    fireEvent.click(screen.getByRole('button', { name: 'Trying again…' }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert')).toHaveTextContent('We could not load this.');
  });

  it('ignores an empty-state art id that is not a registered class B asset', () => {
    const { container } = render(<EmptyState heading="Nothing" artAssetId="https://example.com/stock.png" />);
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('Mentor avatar slot', () => {
  it('shows a manifest render of the real model in a catalogue pose', () => {
    render(<MentorAvatar renderId="lesson.dina.square.light" label="Dina" />);
    const slot = screen.getByRole('img', { name: 'Dina' });
    const image = slot.querySelector('img')!;
    expect(image).toHaveAttribute('src', '/rebuild/mentor-stills/dina-square-light.png');
    expect(image).toHaveAttribute('data-character', 'dina');
    expect(image).toHaveAttribute('data-pose', 'think.wait');
    expect(slot).not.toHaveAttribute('data-refused');
  });

  it('refuses anything that is not a square real-model render, with no letter or glyph fallback', () => {
    for (const id of ['lesson.result.medal', 'lesson.dina.young.light', 'unknown', '/rebuild/mentor-stills/dina-square-light.png']) {
      const { container, unmount } = render(<MentorAvatar renderId={id} label="Dina" />);
      const slot = container.querySelector('[data-slot="mentor-avatar"]')!;
      expect(slot).toHaveAttribute('data-refused', 'true');
      expect(slot.querySelector('img, svg')).toBeNull();
      expect(slot.textContent).toBe('');
      expect(slot).toHaveAttribute('aria-hidden', 'true');
      unmount();
    }
  });

  it('validates provenance: character, own source model and catalogue pose', () => {
    expect(resolveMentorRender('lesson.dina.square.dark')).toMatchObject({ character: 'dina', sourceModel: '/scenes/dina.glb', poseId: 'think.wait' });
    expect(resolveMentorRender('lesson.result.medal')).toBeNull();
  });
});
