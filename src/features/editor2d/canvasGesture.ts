import type { Point2D } from '@/domain/geometry/types';

/** Fields shared by React canvas events and document-level drag events. */
export type CanvasMouseEvent = Pick<
  MouseEvent,
  'button' | 'clientX' | 'clientY' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey' | 'target'
>;

/** A screen-space threshold keeps selection gestures consistent at any zoom. */
export function isCanvasDrag(start: Point2D, end: Point2D): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) >= 4;
}

export function hasSelectionModifier(event: CanvasMouseEvent): boolean {
  return event.shiftKey || event.ctrlKey || event.metaKey;
}
