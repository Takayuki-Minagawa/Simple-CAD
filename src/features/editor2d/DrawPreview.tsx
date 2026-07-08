import type { DrawState } from './useEditorInteraction';
import { isCreationTool, type EditorTool } from '@/app/store';
import { useEditorStore } from '@/app/store';
import { useI18n } from '@/i18n';
import type { SnapResult } from '@/domain/geometry/snap';
import type { Point2D } from '@/domain/geometry/types';
import { linearLength, polygonArea, polygonPerimeter } from '@/domain/geometry/measurement';

const SNAP_COLOR = '#ff6600';
const LABEL_COLOR = '#2563eb';
const POLAR_COLOR = '#16a34a';
const GHOST_COLOR = '#9333ea';

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
      return <polygon points={`${x},${y - r} ${x - r},${y + r} ${x + r},${y + r}`} {...common} />;
    case 'intersection':
      return (
        <g {...common}>
          <line
            x1={x - r}
            y1={y - r}
            x2={x + r}
            y2={y + r}
            stroke={SNAP_COLOR}
            strokeWidth={strokeWidth}
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={x - r}
            y1={y + r}
            x2={x + r}
            y2={y - r}
            stroke={SNAP_COLOR}
            strokeWidth={strokeWidth}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      );
    case 'perpendicular':
      // ⊥ glyph: vertical stroke + base stroke.
      return (
        <g>
          <line
            x1={x - r}
            y1={y - r}
            x2={x - r}
            y2={y + r}
            stroke={SNAP_COLOR}
            strokeWidth={strokeWidth}
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={x - r}
            y1={y + r}
            x2={x + r}
            y2={y + r}
            stroke={SNAP_COLOR}
            strokeWidth={strokeWidth}
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={x - r}
            y1={y}
            x2={x}
            y2={y}
            stroke={SNAP_COLOR}
            strokeWidth={strokeWidth}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      );
    case 'nearest':
      return <circle cx={x} cy={y} r={r} {...common} />;
    case 'grid':
    default:
      // Small cross.
      return (
        <g>
          <line
            x1={x - r * 0.6}
            y1={y}
            x2={x + r * 0.6}
            y2={y}
            stroke={SNAP_COLOR}
            strokeWidth={strokeWidth}
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={x}
            y1={y - r * 0.6}
            x2={x}
            y2={y + r * 0.6}
            stroke={SNAP_COLOR}
            strokeWidth={strokeWidth}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      );
  }
}

/**
 * Zoom-independent SVG text. The world Y axis is flipped (scale(1,-1)); the
 * transform un-flips the glyph and the `fontSize` is divided by zoom so the
 * label renders at a constant on-screen size (same approach as DimensionLayer).
 */
function PreviewLabel({
  x,
  y,
  text,
  zoom,
  color = LABEL_COLOR,
  anchor = 'middle',
}: {
  x: number;
  y: number;
  text: string;
  zoom: number;
  color?: string;
  anchor?: 'start' | 'middle' | 'end';
}) {
  const fontSize = 14 / zoom;
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      dominantBaseline="central"
      fontSize={fontSize}
      fill={color}
      stroke="var(--bg-panel, #fff)"
      strokeWidth={fontSize * 0.16}
      paintOrder="stroke"
      style={{ pointerEvents: 'none' }}
      transform={`scale(1,-1) translate(0,${-2 * y})`}
    >
      {text}
    </text>
  );
}

function segmentLength(a: Point2D, b: Point2D): number {
  return linearLength(a, b);
}

/** Signed angle of a→b in degrees, normalised to (-180, 180]. */
function segmentAngleDeg(a: Point2D, b: Point2D): number {
  const deg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  return deg;
}

/** Real-time length/angle labels for a single segment (beam/wall/dimension). */
function SegmentDimensionLabels({
  start,
  end,
  zoom,
  locale,
}: {
  start: Point2D;
  end: Point2D;
  zoom: number;
  locale: 'ja' | 'en';
}) {
  const len = segmentLength(start, end);
  if (len < 1e-6) return null;
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const angle = segmentAngleDeg(start, end);
  const off = 18 / zoom;
  const angleLabel = locale === 'ja' ? `角 ${angle.toFixed(1)}°` : `∠ ${angle.toFixed(1)}°`;
  return (
    <g>
      <PreviewLabel x={mid.x} y={mid.y + off} text={`${len.toFixed(0)}`} zoom={zoom} />
      <PreviewLabel
        x={start.x + off}
        y={start.y + off}
        text={angleLabel}
        zoom={zoom}
        anchor="start"
      />
    </g>
  );
}

interface Props {
  drawState: DrawState;
  activeTool: EditorTool;
  /** Live ghost point for a parsed (but unconfirmed) coordinate input (4-5). */
  ghostPoint?: Point2D | null;
}

export function DrawPreview({ drawState, activeTool, ghostPoint }: Props) {
  const { points, previewPos, snapResult, angleStep } = drawState;
  const zoom = useEditorStore((s) => s.zoom);
  const { locale } = useI18n();
  if (!previewPos) {
    // Still render the ghost point even with no preview position.
    if (!ghostPoint) return null;
  }

  const segmentTool =
    activeTool === 'beam' ||
    activeTool === 'wall' ||
    activeTool === 'dimension' ||
    activeTool === 'xline';
  const start = points.length >= 1 ? points[points.length - 1] : null;

  return (
    <g className="draw-preview">
      <g opacity={0.6}>
        {/* Snap indicator: distinct marker per snap type */}
        {snapResult && <SnapMarker snap={snapResult} zoom={zoom} />}

        {/* Tool preview lines */}
        {segmentTool && previewPos && points.length === 1 && (
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
        {activeTool === 'slab' && previewPos && points.length > 0 && (
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
        {activeTool === 'spline' && previewPos && points.length > 0 && (
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
        {isCreationTool(activeTool) && previewPos && (
          <g>
            <circle cx={previewPos.x} cy={previewPos.y} r={60} fill="var(--color-selection)" />
          </g>
        )}
      </g>

      {/* ── Real-time dimension / angle preview (4-2) ── */}
      {segmentTool && start && previewPos && (
        <SegmentDimensionLabels start={start} end={previewPos} zoom={zoom} locale={locale} />
      )}

      {/* Slab: per-edge lengths + provisional area/perimeter (4-2) */}
      {activeTool === 'slab' && previewPos && points.length >= 1 && (
        <SlabPreviewLabels points={points} preview={previewPos} zoom={zoom} locale={locale} />
      )}

      {/* ── Polar / ortho tracking guide + label (4-3) ── */}
      {angleStep != null && start && previewPos && (
        <PolarTrackingGuide start={start} preview={previewPos} zoom={zoom} locale={locale} />
      )}

      {/* ── Ghost point for live coordinate-input interpretation (4-5) ── */}
      {ghostPoint && <GhostPoint point={ghostPoint} zoom={zoom} locale={locale} />}
    </g>
  );
}

function SlabPreviewLabels({
  points,
  preview,
  zoom,
  locale,
}: {
  points: Point2D[];
  preview: Point2D;
  zoom: number;
  locale: 'ja' | 'en';
}) {
  const ring = [...points, preview];
  const off = 18 / zoom;
  const edges: { mid: Point2D; len: number }[] = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i];
    const b = ring[i + 1];
    edges.push({ mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, len: segmentLength(a, b) });
  }
  // Closing edge (preview -> first) when at least a triangle.
  if (ring.length >= 3) {
    const a = preview;
    const b = ring[0];
    edges.push({ mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, len: segmentLength(a, b) });
  }

  const closedRing = ring.length >= 3 ? ring : null;
  const area = closedRing ? polygonArea(closedRing) : 0;
  const perim = closedRing ? polygonPerimeter(closedRing) : 0;
  const centroid =
    closedRing && closedRing.length > 0
      ? {
          x: closedRing.reduce((s, p) => s + p.x, 0) / closedRing.length,
          y: closedRing.reduce((s, p) => s + p.y, 0) / closedRing.length,
        }
      : null;

  // mm² -> m² for readability.
  const areaM2 = area / 1e6;
  const perimText = (perim / 1000).toFixed(2);
  const areaLabel = locale === 'ja' ? `面積 ${areaM2.toFixed(2)}m²` : `Area ${areaM2.toFixed(2)}m²`;
  const perimLabel = locale === 'ja' ? `周 ${perimText}m` : `Perim ${perimText}m`;

  return (
    <g>
      {edges.map((e, i) => (
        <PreviewLabel
          key={i}
          x={e.mid.x}
          y={e.mid.y + off}
          text={`${e.len.toFixed(0)}`}
          zoom={zoom}
        />
      ))}
      {centroid && (
        <>
          <PreviewLabel
            x={centroid.x}
            y={centroid.y + off}
            text={areaLabel}
            zoom={zoom}
            color={POLAR_COLOR}
          />
          <PreviewLabel
            x={centroid.x}
            y={centroid.y - off}
            text={perimLabel}
            zoom={zoom}
            color={POLAR_COLOR}
          />
        </>
      )}
    </g>
  );
}

function PolarTrackingGuide({
  start,
  preview,
  zoom,
  locale,
}: {
  start: Point2D;
  preview: Point2D;
  zoom: number;
  locale: 'ja' | 'en';
}) {
  const len = segmentLength(start, preview);
  if (len < 1e-6) return null;
  // Extend the dotted guide a bit beyond the cursor.
  const ext = len + 40 / zoom + 200;
  const ux = (preview.x - start.x) / len;
  const uy = (preview.y - start.y) / len;
  const end = { x: start.x + ux * ext, y: start.y + uy * ext };
  let angle = segmentAngleDeg(start, preview);
  if (angle < 0) angle += 360;
  const off = 30 / zoom;
  const label = locale === 'ja' ? `極: ${angle.toFixed(0)}°` : `Polar: ${angle.toFixed(0)}°`;
  return (
    <g>
      <line
        x1={start.x - ux * ext}
        y1={start.y - uy * ext}
        x2={end.x}
        y2={end.y}
        stroke={POLAR_COLOR}
        strokeWidth={2 / zoom}
        strokeDasharray={`${8 / zoom} ${8 / zoom}`}
        vectorEffect="non-scaling-stroke"
        opacity={0.8}
      />
      <PreviewLabel
        x={preview.x + off}
        y={preview.y - off}
        text={label}
        zoom={zoom}
        color={POLAR_COLOR}
        anchor="start"
      />
    </g>
  );
}

function GhostPoint({
  point,
  zoom,
  locale,
}: {
  point: Point2D;
  zoom: number;
  locale: 'ja' | 'en';
}) {
  const r = 8 / zoom;
  const off = 14 / zoom;
  const label = locale === 'ja' ? '入力' : 'input';
  return (
    <g opacity={0.85}>
      <circle
        cx={point.x}
        cy={point.y}
        r={r}
        fill="none"
        stroke={GHOST_COLOR}
        strokeWidth={2 / zoom}
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={point.x - r * 1.6}
        y1={point.y}
        x2={point.x + r * 1.6}
        y2={point.y}
        stroke={GHOST_COLOR}
        strokeWidth={1.5 / zoom}
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={point.x}
        y1={point.y - r * 1.6}
        x2={point.x}
        y2={point.y + r * 1.6}
        stroke={GHOST_COLOR}
        strokeWidth={1.5 / zoom}
        vectorEffect="non-scaling-stroke"
      />
      <PreviewLabel
        x={point.x + off}
        y={point.y + off}
        text={label}
        zoom={zoom}
        color={GHOST_COLOR}
        anchor="start"
      />
    </g>
  );
}
