import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VertexCoordInput } from '../PropertyInputs';

describe('VertexCoordInput', () => {
  it('does not commit the rounded display value on an untouched blur', () => {
    const onChange = vi.fn();

    render(<VertexCoordInput value={1500.5} onChange={onChange} />);
    const input = screen.getByRole('textbox');

    expect(input).toHaveValue('1501');
    fireEvent.blur(input);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('commits a changed value', () => {
    const onChange = vi.fn();

    render(<VertexCoordInput value={1500.5} onChange={onChange} />);
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: '1502' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(1502);
  });
});
