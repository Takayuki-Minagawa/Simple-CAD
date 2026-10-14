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

describe('CoordRow validation (R02)', () => {
  it('blocks a non-positive line weight, keeps the text editable and explains why', () => {
    const onChange = vi.fn();
    render(<CoordRow label="Line Weight" value={20} min={0} exclusiveMin onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: 'Line Weight' });

    fireEvent.change(input, { target: { value: '-20' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue('-20');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('0より大きい値にしてください');
    expect(input.getAttribute('aria-describedby')).toBe(alert.id);

    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('数値を入力してください');

    fireEvent.change(input, { target: { value: '25' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(25);
  });

  it('enforces a closed range', () => {
    const onChange = vi.fn();
    render(<CoordRow label="Opacity" value={0.1} min={0} max={1} onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: 'Opacity' });
    fireEvent.change(input, { target: { value: '2' } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('0〜1');
  });

  it('accepts metre suffixes for millimetre fields', () => {
    const onChange = vi.fn();
    render(<CoordRow label="End X (mm)" unit="mm" value={4000} onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: 'End X (mm)' });
    fireEvent.change(input, { target: { value: '4.5m' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(4500);
  });

  it('reports when the model did not accept an otherwise valid value', () => {
    // Parent that ignores every change (like the store rejecting zero-length geometry).
    const onChange = vi.fn();
    render(<CoordRow label="End X (mm)" unit="mm" value={3500} onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: 'End X (mm)' });
    fireEvent.change(input, { target: { value: '1000' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(1000);
    expect(screen.getByRole('alert')).toHaveTextContent('適用できませんでした');
    expect(input).toHaveValue('1000');
  });
});
