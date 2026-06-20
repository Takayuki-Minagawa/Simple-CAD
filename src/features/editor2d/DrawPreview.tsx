import type { DrawState } from './useEditorInteraction';
import { isCreationTool, type EditorTool } from '@/app/store';
import { useEditorStore } from '@/app/store';
import type { SnapResult } from '@/domain/geometry/snap';

const SNAP_COLOR = '#ff6600';

/**
 * Distinct snap markers per snap type (AutoCAD-style):
 *   endpoint=square, midpoint=triangle, intersection=X, perpendicular=⊥,
 *   nearest=circle, grid=small cross.
 * Marker geometry is sized in world units derived from `zoom` so it appears
 * constant on screen regardless of zoom level.
 */
function SnapMarker({ snap, zoom }: { snap: SnapResult; zoom: number }) {
  const { x, y } = snap.point;
  // Zoom-independent half-size and stroke (in world units).
  const r = 10 / zoom;
  const strokeWidth = 2 / zoom;
  const common = {
    fill: 'none',
    stroke: SNAP_COLOR,
    strokeWidth,
    vectorEffect: 'non-scaling-stroke' as const,
  };

  switch (snap.type) {
    case 'endpoint':
      return <rect x={x - r} y={y - r} width={r * 2} height={r * 2} {...common} />;
    case 'midpoint':
      return (
        <polygon
          points={`${x},${y - r} ${x - r},${y + r} ${x + r},${y + r}`}
          {...common}
        />
      );
    case 'intersection':
      return (
        <g {...common}>
          <line x1={x - r} y1={y - r} x2={x + r} y2={y + r} stroke={SNAP_COLOR} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
          <line x1={x - r} y1={y + r} x2={x + r} y2={y - r} stroke={SNAP_COLOR} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
        </g>
      );
    case 'perpendicular':
      // ⊥ glyph: vertical stroke + base stroke.
      return (
        <g>
          <line x1={x - r} y1={y - r} x2={x - r} y2={y + r} stroke={SNAP_COLOR} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
          <line x1={x - r} y1={y + r} x2={x + r} y2={y + r} stroke={SNAP_COLOR} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
          <line x1={x - r} y1={y} x2={x} y2={y} stroke={SNAP_COLOR} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
        </g>
      );
    case 'nearest':
      return <circle cx={x} cy={y} r={r} {...common} />;
    case 'grid':
    default:
      // Small cross.
      return (
        <g>
          <line x1={x - r * 0.6} y1={y} x2={x + r * 0.6} y2={y} stroke={SNAP_COLOR} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
          <line x1={x} y1={y - r * 0.6} x2={x} y2={y + r * 0.6} stroke={SNAP_COLOR} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
        </g>
      );
  }
}

interface Props {
  drawState: DrawState;
  activeTool: EditorTool;
}

export function DrawPreview({ drawState, activeTool }: Props) {
  const { points, previewPos, snapResult } = drawState;
  const zoom = useEditorStore((s) => s.zoom);
  if (!previewPos) return null;

  return (
    <g className="draw-preview" opacity={0.6}>
      {/* Snap indicator: distinct marker per snap type */}
      {snapResult && <SnapMarker snap={snapResult} zoom={zoom} />}

      {/* Tool preview lines */}
      {(activeTool === 'beam' || activeTool === 'wall' || activeTool === 'dimension' || activeTool === 'xline') &&
        points.length === 1 && (
          <line
            x1={points[0].x}
            y1={points[0].y}
            x2={previewPos.x}
            y2={previewPos.y}
            stroke="var(--color-selection)"
            strokeWidth={20}
            strokeDasharray="100 50"
          />
        )}

      {/* Slab polygon preview */}
      {activeTool === 'slab' && points.length > 0 && (
        <g>
          <polyline
            points={[...points, previewPos].map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="var(--color-slab)"
            strokeWidth={20}
            strokeDasharray="100 50"
          />
          {/* Close line */}
          {points.length >= 2 && (
            <line
              x1={previewPos.x}
              y1={previewPos.y}
              x2={points[0].x}
              y2={points[0].y}
              stroke="var(--color-slab)"
              strokeWidth={10}
              strokeDasharray="50 50"
              opacity={0.4}
            />
          )}
          {/* Vertices */}
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={80} fill="var(--color-slab)" />
          ))}
        </g>
      )}

      {/* Spline preview */}
      {activeTool === 'spline' && points.length > 0 && (
        <g>
          <polyline
            points={[...points, previewPos].map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="var(--color-selection)"
            strokeWidth={20}
            strokeDasharray="100 50"
          />
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={80} fill="var(--color-selection)" />
          ))}
        </g>
      )}

      {/* Cursor crosshair */}
      {isCreationTool(activeTool) && (
        <g>
          <circle cx={previewPos.x} cy={previewPos.y} r={60} fill="var(--color-selection)" />
        </g>
      )}
    </g>
  );
}
