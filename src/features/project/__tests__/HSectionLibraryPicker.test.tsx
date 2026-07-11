import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HSectionLibraryPicker } from '../HSectionLibraryPicker';

describe('HSectionLibraryPicker', () => {
  it('adds the selected library geometry with the selected usage', () => {
    const onAdd = vi.fn();
    render(<HSectionLibraryPicker onAdd={onAdd} />);

    fireEvent.change(screen.getByLabelText('JIS H形鋼ライブラリ'), {
      target: { value: 'H400x200x8x13' },
    });
    fireEvent.change(screen.getByLabelText('用途'), { target: { value: 's_column_h' } });
    fireEvent.click(screen.getByRole('button', { name: 'ライブラリから追加' }));

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ depth: 400, width: 200, tw: 8, tf: 13 }),
      's_column_h',
    );
  });
});
