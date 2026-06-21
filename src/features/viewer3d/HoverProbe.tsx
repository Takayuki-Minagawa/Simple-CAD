import { Html } from '@react-three/drei';
import type { ViewerLabels } from './viewerLabels';
import { formatMm } from './measureUtils';

export interface HoverInfo {
  /** Anchor position in CAD coordinates (mm). */
  position: { x: number; y: number; z: number };
  length: number | null;
  sectionName: string;
  storyName: string;
  memberType: string;
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
  const { position, length, sectionName, storyName } = hover;

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
      </div>
    </Html>
  );
}
