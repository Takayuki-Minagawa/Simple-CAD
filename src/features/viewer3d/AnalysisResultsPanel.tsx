import type { AnalysisResultsMetadata } from '@/domain/structural/types';
import { utilizationRange } from './analysisResults';
import type { ViewerLabels } from './viewerLabels';

interface AnalysisResultsPanelProps {
  labels: ViewerLabels;
  results: AnalysisResultsMetadata;
  scale: number;
  setScale: (scale: number) => void;
}

export function AnalysisResultsPanel({ labels, results, scale, setScale }: AnalysisResultsPanelProps) {
  const range = utilizationRange(results.memberResults);
  return (
    <div
      style={{
        position: 'absolute',
        left: 8,
        bottom: 32,
        zIndex: 10,
        width: 230,
        padding: '9px 10px',
        borderRadius: 8,
        background: 'rgba(16, 24, 40, 0.84)',
        color: '#fff',
        display: 'grid',
        gap: 7,
        fontSize: 11,
      }}
      role="status"
    >
      <strong>{labels.analysisResults}</strong>
      <span style={{ color: 'rgba(255,255,255,0.76)' }}>
        {results.solver ?? results.source} / {results.analysisType}
      </span>
      <label style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, alignItems: 'center' }}>
        <span>{labels.deformationScale}</span>
        <output>{scale.toFixed(1)}x</output>
        <input
          type="range"
          min={0}
          max={Math.max(200, Math.ceil(scale))}
          step={0.5}
          value={scale}
          onChange={(event) => setScale(Number(event.target.value))}
          style={{ gridColumn: '1 / -1', width: '100%' }}
          aria-label={labels.deformationScale}
        />
      </label>
      {range && (
        <div style={{ display: 'grid', gap: 3 }}>
          <span>{labels.utilization}: {range.min.toFixed(2)} - {range.max.toFixed(2)}</span>
          <div
            aria-hidden="true"
            style={{
              height: 7,
              borderRadius: 4,
              background: 'linear-gradient(90deg, #22c55e 0%, #f59e0b 66.7%, #dc2626 100%)',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.7)' }}>
            <span>0.0</span><span>1.0</span><span>1.5+</span>
          </div>
        </div>
      )}
      {(results.warnings?.length ?? 0) > 0 && (
        <span style={{ color: '#fde68a' }}>{labels.analysisWarnings}: {results.warnings!.length}</span>
      )}
    </div>
  );
}
