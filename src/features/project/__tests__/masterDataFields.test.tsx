import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NumberField, OptionalNumberField } from '../masterDataFields';

describe('NumberField', () => {
  it('does not turn an empty draft into zero and commits a finite value on blur', () => {
    const onChange = vi.fn();
    render(<NumberField label="Width" value={300} onChange={onChange} />);
    const input = screen.getByLabelText('Width');

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue(300);

    fireEvent.change(input, { target: { value: '450' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(450);
  });

  it('restores the original draft on Escape without committing it', () => {
    const onChange = vi.fn();
    render(<NumberField label="Depth" value={600} onChange={onChange} />);
    const input = screen.getByLabelText('Depth');
    fireEvent.change(input, { target: { value: '900' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue(600);
  });

  it('does not commit an untouched value on blur or Enter', () => {
    const onChange = vi.fn();
    render(<NumberField label="Elevation" value={3000} onChange={onChange} />);
    const input = screen.getByLabelText('Elevation');

    fireEvent.blur(input);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('OptionalNumberField', () => {
  it('keeps decimal drafts local and commits once on blur', () => {
    const onChange = vi.fn();
    render(<OptionalNumberField label="Unit weight" value={78} onChange={onChange} />);
    const input = screen.getByLabelText('Unit weight');

    fireEvent.change(input, { target: { value: '78.5' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(78.5);
  });

  it('commits empty as undefined, Enter as a number, and cancels with Escape', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <OptionalNumberField label="Strength" value={24} onChange={onChange} />,
    );
    let input = screen.getByLabelText('Strength');

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith(undefined);

    rerender(<OptionalNumberField label="Strength" value={24} onChange={onChange} />);
    input = screen.getByLabelText('Strength');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '30' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith(30);

    rerender(<OptionalNumberField label="Strength" value={24} onChange={onChange} />);
    input = screen.getByLabelText('Strength');
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue(24);
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
