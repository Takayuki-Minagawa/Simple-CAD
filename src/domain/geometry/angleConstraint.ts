import type { Point2D } from './types';

export function constrainPointToAngle(
  origin: Point2D,
  target: Point2D,
  angleStepDegrees = 45,
): Point2D {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0 || angleStepDegrees <= 0) return target;

  const step = (angleStepDegrees * Math.PI) / 180;
  const angle = Math.atan2(dy, dx);
  const constrainedAngle = Math.round(angle / step) * step;

  return {
    x: origin.x + Math.cos(constrainedAngle) * distance,
    y: origin.y + Math.sin(constrainedAngle) * distance,
  };
}
