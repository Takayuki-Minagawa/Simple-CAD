import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CoordRow, VertexCoordInput } from '../PropertyInputs';

describe('CoordRow', () => {
  it('commits a fallback-equal value when it resolves a mixed selection', () => {
    const onChange = vi.fn();

    render(
      <CoordRow
        label="Rotation"
        value={0}
        mixed
        mixedLabel="Mixed"
        placeholder="—"
        onChange={onChange}
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Rotation' });

    expect(input).toHaveValue('');
    expect(screen.getByText('Mixed')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(0);
  });
});

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
