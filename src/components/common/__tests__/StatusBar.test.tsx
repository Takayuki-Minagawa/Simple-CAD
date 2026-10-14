import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '@/app/store';
import { useI18n } from '@/i18n';
import { StatusBar } from '../StatusBar';

describe('StatusBar machine-readable state (R01/R06)', () => {
  beforeEach(() => {
    useI18n.getState().setLocale('ja');
    useEditorStore.setState({ orthoMode: false, polarTrackingEnabled: false, polarAngleStep: 45, statusUnit: 'mm' });
  });

  it('labels the selector as a display unit and states that input is millimetres', () => {
    render(<StatusBar />);
    expect(screen.getByRole('combobox', { name: '表示単位' })).toHaveValue('mm');
    expect(screen.getByText('入力: mm')).toBeInTheDocument();
  });

  it('exposes ortho and polar tracking as text that follows the store', () => {
    const { rerender } = render(<StatusBar />);
    expect(screen.getByText(/^直交: OFF$/)).toBeInTheDocument();
    useEditorStore.getState().toggleOrthoMode();
    useEditorStore.getState().togglePolarTracking();
    useEditorStore.getState().setPolarAngleStep(30);
    rerender(<StatusBar />);
    expect(screen.getByText(/^直交: ON$/)).toBeInTheDocument();
    expect(screen.getByText(/^極: ON \(30°\)$/)).toBeInTheDocument();
  });
});
