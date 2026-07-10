import { Html } from '@react-three/drei';
import type { ViewerLabels } from './viewerLabels';
import { formatMm } from './measureUtils';
import type { AnalysisMemberResult } from '@/domain/structural/types';

export interface HoverInfo {
  /** Anchor position in CAD coordinates (mm). */
  position: { x: number; y: number; z: number };
  length: number | null;
  sectionName: string;
  storyName: string;
  memberType: string;
  result?: AnalysisMemberResult;
}

interface Props {
  hover: HoverInfo | null;
  labels: ViewerLabels;
}

/**
 * Small tooltip shown when hovering a member: length, section name and story.
 * Mounted inside the rotated/scaled CAD-coordinate group.
 */
export function HoverProbe({ hover, labels }: Props) {
  if (!hover) return null;
  const { position, length, sectionName, storyName, result } = hover;

  return (
    <Html position={[position.x, position.y, position.z]} zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
      <div
        style={{
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          transform: 'translate(12px, -50%)',
          padding: '4px 7px',
          borderRadius: 6,
          fontSize: 11,
          lineHeight: 1.4,
          color: '#fff',
          background: 'rgba(16,24,40,0.9)',
          border: '1px solid rgba(255,255,255,0.18)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
        }}
      >
        {length != null && (
          <div>
            {labels.measureLength}: <strong>{formatMm(length)} mm</strong>
          </div>
        )}
        <div>
          {labels.section}: <strong>{sectionName}</strong>
        </div>
        <div>
          {labels.story}: <strong>{storyName}</strong>
        </div>
        {result?.utilization != null && (
          <div>
            {labels.utilization}: <strong>{result.utilization.toFixed(3)}</strong>
          </div>
        )}
        {result?.axial != null && (
          <div>
            {labels.axial}: <strong>{result.axial.toFixed(2)} kN</strong>
          </div>
        )}
        {(result?.momentY != null || result?.momentZ != null) && (
          <div>
            {labels.moment}: <strong>{(result.momentY ?? 0).toFixed(2)} / {(result.momentZ ?? 0).toFixed(2)} kN·m</strong>
          </div>
        )}
      </div>
    </Html>
  );
}
