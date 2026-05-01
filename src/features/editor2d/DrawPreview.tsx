import type { DrawState } from './useEditorInteraction';
import { isCreationTool, type EditorTool } from '@/app/store';

interface Props {
  drawState: DrawState;
  activeTool: EditorTool;
}

export function DrawPreview({ drawState, activeTool }: Props) {
  const { points, previewPos, snapResult } = drawState;
  if (!previewPos) return null;

  return (
    <g className="draw-preview" opacity={0.6}>
      {/* Snap indicator */}
      {snapResult && (
        <g>
          <circle
            cx={snapResult.point.x}
            cy={snapResult.point.y}
            r={150}
            fill="none"
            stroke="#ff6600"
            strokeWidth={30}
          />
          <line
            x1={snapResult.point.x - 200}
            y1={snapResult.point.y}
            x2={snapResult.point.x + 200}
            y2={snapResult.point.y}
            stroke="#ff6600"
            strokeWidth={20}
          />
          <line
            x1={snapResult.point.x}
            y1={snapResult.point.y - 200}
            x2={snapResult.point.x}
            y2={snapResult.point.y + 200}
            stroke="#ff6600"
            strokeWidth={20}
          />
        </g>
      )}

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
