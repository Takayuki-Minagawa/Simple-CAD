import type { Point2D } from './types';

/**
 * World coordinates: mm, X right, Y up (structural convention)
 * Screen coordinates: px, X right, Y down (SVG/browser convention)
 *
 * The SVG canvas uses: transform="translate(panX, panY) scale(zoom, -zoom)"
 * which handles the Y-flip. These functions are for manual conversion when needed.
 */

export function worldToScreen(p: Point2D, pan: Point2D, zoom: number): Point2D {
  return {
    x: p.x * zoom + pan.x,
    y: -p.y * zoom + pan.y,
  };
}

export function screenToWorld(p: Point2D, pan: Point2D, zoom: number): Point2D {
  return {
    x: (p.x - pan.x) / zoom,
    y: -(p.y - pan.y) / zoom,
  };
}

/**
 * Snap a value to the nearest grid line.
 */
export function snapToGrid(value: number, gridSpacing: number): number {
  return Math.round(value / gridSpacing) * gridSpacing;
}

export function snapPointToGrid(p: Point2D, gridSpacing: number): Point2D {
  return {
    x: snapToGrid(p.x, gridSpacing),
    y: snapToGrid(p.y, gridSpacing),
  };
}
