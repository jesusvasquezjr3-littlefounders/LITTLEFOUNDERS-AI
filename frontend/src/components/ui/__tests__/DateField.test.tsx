import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { DateField } from '../DateField';

/*
 * The date control that replaced a free-text box with a `^\d{4}-\d{2}-\d{2}$`
 * regex and the placeholder "1988-02-14".
 *
 * The behaviour worth pinning is the CONTRACT, not the typing sugar: an
 * incomplete or impossible entry emits '' and never a partial string, so a
 * caller can never mistake "half typed" for "valid" - which is the failure the
 * old field made easy, since '198' matched nothing and looked like nothing.
 */

function Harness({ onValue }: { onValue: (v: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <DateField
      label="Birth date"
      dayLabel="Day"
      monthLabel="Month"
      yearLabel="Year"
      value={value}
      onChange={(v) => {
        setValue(v);
        onValue(v);
      }}
    />
  );
}

function type(day: string, month: string, year: string) {
  fireEvent.change(screen.getByLabelText('Day'), { target: { value: day } });
  fireEvent.change(screen.getByLabelText('Month'), { target: { value: month } });
  fireEvent.change(screen.getByLabelText('Year'), { target: { value: year } });
}

describe('DateField', () => {
  it('emits an ISO date once all three segments make a real one', () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    type('09', '04', '2016');
    expect(onValue).toHaveBeenLastCalledWith('2016-04-09');
  });

  it('emits an empty string while the entry is incomplete, never a partial date', () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    fireEvent.change(screen.getByLabelText('Day'), { target: { value: '09' } });
    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '04' } });
    fireEvent.change(screen.getByLabelText('Year'), { target: { value: '20' } });
    // '2016-04-' or '20' reaching a caller would be read as a value.
    for (const call of onValue.mock.calls) expect(call[0]).toBe('');
  });

  it('refuses a date that does not exist', () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    // 31 February is in range on every segment and is still not a day. The
    // round trip through Date is what catches it: the constructor rolls it
    // forward, so the parts coming back out no longer match.
    type('31', '02', '2016');
    expect(onValue).toHaveBeenLastCalledWith('');
  });

  it('accepts 29 February in a leap year and rejects it otherwise', () => {
    const onValue = vi.fn();
    const { unmount } = render(<Harness onValue={onValue} />);
    type('29', '02', '2016');
    expect(onValue).toHaveBeenLastCalledWith('2016-02-29');
    unmount();

    const onValue2 = vi.fn();
    render(<Harness onValue={onValue2} />);
    type('29', '02', '2017');
    expect(onValue2).toHaveBeenLastCalledWith('');
  });

  it('ignores anything that is not a digit', () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    fireEvent.change(screen.getByLabelText('Day'), { target: { value: '0a9' } });
    expect(screen.getByLabelText('Day')).toHaveValue('09');
  });

  it('gives every segment a numeric keypad and its own accessible name', () => {
    render(<Harness onValue={vi.fn()} />);
    for (const name of ['Day', 'Month', 'Year']) {
      const el = screen.getByLabelText(name);
      expect(el).toHaveAttribute('inputMode', 'numeric');
    }
    // /DESIGN.md forbids native pickers as choice controls.
    expect(document.querySelector('input[type="date"]')).toBeNull();
  });
});
