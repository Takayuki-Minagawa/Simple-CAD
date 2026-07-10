import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AnalysisResultsMetadata } from '@/domain/structural/types';
import { getViewerLabels } from '../viewerLabels';
import { AnalysisResultsPanel } from '../AnalysisResultsPanel';

describe('AnalysisResultsPanel', () => {
  it('keeps an imported scale maximum stable after the live value is lowered', () => {
    const results: AnalysisResultsMetadata = {
      source: 'solver',
      analysisType: 'static',
      generatedAt: '2026-07-11T00:00:00Z',
      deformationScale: 500,
    };
    const { rerender } = render(
      <AnalysisResultsPanel
        labels={getViewerLabels('en')}
        results={results}
        scale={500}
        setScale={vi.fn()}
      />,
    );
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('max', '500');

    rerender(
      <AnalysisResultsPanel
        labels={getViewerLabels('en')}
        results={results}
        scale={100}
        setScale={vi.fn()}
      />,
    );

    expect(screen.getByRole('slider')).toHaveAttribute('max', '500');
  });
});
