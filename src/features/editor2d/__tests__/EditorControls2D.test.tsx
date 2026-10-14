import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '@/app/store';
import { useI18n } from '@/i18n';
import { EditorControls2D } from '../EditorControls2D';

describe('EditorControls2D toggle states (R06)', () => {
  beforeEach(() => {
    useI18n.getState().setLocale('ja');
    useEditorStore.setState({ orthoMode: false, polarTrackingEnabled: false, snapEnabled: true });
  });

  it('reflects ortho mode through aria-pressed for both click and keyboard-driven changes', () => {
    render(<EditorControls2D canZoomSelection={false} onZoomExtents={() => undefined} onZoomSelection={() => undefined} />);
    const ortho = screen.getByRole('button', { name: '直交モード (F8)' });
    expect(ortho).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(ortho);
    expect(ortho).toHaveAttribute('aria-pressed', 'true');
    // The F8 shortcut path goes through the same store action.
    act(() => useEditorStore.getState().toggleOrthoMode());
    expect(screen.getByRole('button', { name: '直交モード (F8)' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks every snap toggle with its pressed state', () => {
    render(<EditorControls2D canZoomSelection={false} onZoomExtents={() => undefined} onZoomSelection={() => undefined} />);
    expect(screen.getByRole('button', { name: 'スナップ' })).toHaveAttribute('aria-pressed', 'true');
    const pressed = screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed'));
    expect(pressed.length).toBeGreaterThanOrEqual(9);
  });
});
