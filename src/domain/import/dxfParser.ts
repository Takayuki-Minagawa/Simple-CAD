export interface DxfPoint {
  x: number;
  y: number;
  z?: number;
}

export interface DxfEntity {
  type: string;
  layer?: string;
  startPoint?: DxfPoint;
  endPoint?: DxfPoint;
  vertices?: DxfPoint[];
  text?: string;
  textHeight?: number;
  center?: DxfPoint;
  radius?: number;
  majorAxisEndpoint?: { x: number; y: number };
  minorAxisRatio?: number;
  startAngle?: number;
  endAngle?: number;
  // DIMENSION entity fields
  dimLineOrigin?: { x: number; y: number };
  dimExt1?: { x: number; y: number };
  dimExt2?: { x: number; y: number };
  closed?: boolean;
}

export interface DxfHeader {
  /** $INSUNITS code (4 = mm, 6 = m, 1 = inch, …). Undefined when absent. */
  insUnits?: number;
  /** $MEASUREMENT (0 = imperial, 1 = metric). */
  measurement?: number;
}

/**
 * Parse the HEADER section variables we care about for unit handling (3-3 / B4).
 * Returns an empty object when there is no HEADER section.
 */
export function parseDxfHeader(content: string): DxfHeader {
  const lines = content.split(/\r?\n/);
  const header: DxfHeader = {};
  let inHeader = false;
  let currentVar: string | null = null;

  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = parseInt(lines[i].trim(), 10);
    const value = lines[i + 1]?.trim() ?? '';

    if (code === 0 && value === 'SECTION') {
      const nextCode = parseInt(lines[i + 2]?.trim() ?? '', 10);
      const nextVal = lines[i + 3]?.trim() ?? '';
      if (nextCode === 2 && nextVal === 'HEADER') {
        inHeader = true;
        i += 2;
        continue;
      }
    }

    if (!inHeader) continue;

    if (code === 0 && value === 'ENDSEC') break;

    if (code === 9) {
      currentVar = value;
      continue;
    }

    if (currentVar === '$INSUNITS' && code === 70) {
      header.insUnits = parseInt(value, 10);
      currentVar = null;
    } else if (currentVar === '$MEASUREMENT' && code === 70) {
      header.measurement = parseInt(value, 10);
      currentVar = null;
    }
  }

  return header;
}

function withX(point: DxfPoint | undefined, x: number): DxfPoint {
  return { ...point, x, y: point?.y ?? 0 };
}

function withY(point: DxfPoint | undefined, y: number): DxfPoint {
  return { ...point, x: point?.x ?? 0, y };
}

/**
 * Minimal DXF parser - extracts entity types and basic properties.
 */
export function parseDxfEntities(content: string): DxfEntity[] {
  const lines = content.split(/\r?\n/);
  const entities: DxfEntity[] = [];
  let inEntities = false;
  let current: DxfEntity | null = null;

  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = parseInt(lines[i].trim(), 10);
    const value = lines[i + 1]?.trim() ?? '';

    if (code === 0 && value === 'SECTION') {
      const nextCode = parseInt(lines[i + 2]?.trim() ?? '', 10);
      const nextVal = lines[i + 3]?.trim() ?? '';
      if (nextCode === 2 && nextVal === 'ENTITIES') {
        inEntities = true;
        i += 2;
        continue;
      }
    }

    if (code === 0 && value === 'ENDSEC') {
      if (current) entities.push(current);
      current = null;
      inEntities = false;
      continue;
    }

    if (!inEntities) continue;

    if (code === 0) {
      // Classic POLYLINE: accumulate VERTEX rows into parent, finalize on SEQEND
      if (current && current.type === 'POLYLINE' && value === 'VERTEX') {
        continue;
      }
      if (current && current.type === 'POLYLINE' && value === 'SEQEND') {
        entities.push(current);
        current = null;
        continue;
      }
      if (current) entities.push(current);
      current = { type: value };
      continue;
    }

    if (!current) continue;

    switch (code) {
      case 8:
        current.layer = value;
        break;
      case 10:
        assignPrimaryX(current, parseFloat(value));
        break;
      case 20:
        assignPrimaryY(current, parseFloat(value));
        break;
      case 30:
        assignPrimaryZ(current, parseFloat(value));
        break;
      case 11:
        if (current.type === 'ELLIPSE') {
          current.majorAxisEndpoint = withX(current.majorAxisEndpoint, parseFloat(value));
        } else {
          current.endPoint = withX(current.endPoint, parseFloat(value));
        }
        break;
      case 21:
        if (current.type === 'ELLIPSE') {
          current.majorAxisEndpoint = withY(current.majorAxisEndpoint, parseFloat(value));
        } else {
          current.endPoint = withY(current.endPoint, parseFloat(value));
        }
        break;
      case 31:
        if (current.endPoint) {
          current.endPoint.z = parseFloat(value);
        }
        break;
      case 13:
        // DIMENSION: first extension line origin X
        if (isDimensionEntity(current.type)) {
          current.dimExt1 = withX(current.dimExt1, parseFloat(value));
        }
        break;
      case 23:
        // DIMENSION: first extension line origin Y
        if (isDimensionEntity(current.type)) {
          current.dimExt1 = withY(current.dimExt1, parseFloat(value));
        }
        break;
      case 14:
        // DIMENSION: second extension line origin X
        if (isDimensionEntity(current.type)) {
          current.dimExt2 = withX(current.dimExt2, parseFloat(value));
        }
        break;
      case 24:
        // DIMENSION: second extension line origin Y
        if (isDimensionEntity(current.type)) {
          current.dimExt2 = withY(current.dimExt2, parseFloat(value));
        }
        break;
      case 70:
        // For LWPOLYLINE: flag for closed polyline (bit 0 = closed)
        if (current.type === 'LWPOLYLINE' || current.type === 'POLYLINE') {
          current.closed = (parseInt(value, 10) & 1) !== 0;
        }
        break;
      case 1:
      case 3:
        current.text = current.text ? `${current.text} ${normalizeDxfText(value)}` : normalizeDxfText(value);
        break;
      case 40:
        if (current.type === 'CIRCLE' || current.type === 'ARC') {
          current.radius = parseFloat(value);
        } else if (current.type === 'ELLIPSE') {
          current.minorAxisRatio = parseFloat(value);
        } else {
          current.textHeight = parseFloat(value);
        }
        break;
      case 50:
        current.startAngle = parseFloat(value);
        break;
      case 51:
        current.endAngle = parseFloat(value);
        break;
    }
  }

  if (current) entities.push(current);
  return entities;
}

function isVertexEntity(type: string): boolean {
  return type === 'LWPOLYLINE' || type === 'POLYLINE' || type === 'SPLINE' || type === 'HATCH';
}

function isCenterEntity(type: string): boolean {
  return type === 'CIRCLE' || type === 'ARC' || type === 'ELLIPSE';
}

function isDimensionEntity(type: string): boolean {
  return type === 'DIMENSION';
}

function assignPrimaryX(entity: DxfEntity, value: number) {
  if (isCenterEntity(entity.type)) {
    entity.center = withX(entity.center, value);
    return;
  }
  if (isDimensionEntity(entity.type)) {
    entity.dimLineOrigin = withX(entity.dimLineOrigin, value);
    return;
  }
  if (isVertexEntity(entity.type)) {
    entity.vertices ??= [];
    entity.vertices.push({ x: value, y: 0 });
    return;
  }
  entity.startPoint = withX(entity.startPoint, value);
}

function assignPrimaryY(entity: DxfEntity, value: number) {
  if (isCenterEntity(entity.type)) {
    entity.center = withY(entity.center, value);
    return;
  }
  if (isDimensionEntity(entity.type)) {
    entity.dimLineOrigin = withY(entity.dimLineOrigin, value);
    return;
  }
  if (isVertexEntity(entity.type)) {
    entity.vertices ??= [];
    const last = entity.vertices[entity.vertices.length - 1];
    if (last) {
      last.y = value;
    } else {
      entity.vertices.push({ x: 0, y: value });
    }
    return;
  }
  entity.startPoint = withY(entity.startPoint, value);
}

function assignPrimaryZ(entity: DxfEntity, value: number) {
  if (isCenterEntity(entity.type)) {
    if (entity.center) entity.center.z = value;
    return;
  }
  if (isVertexEntity(entity.type)) {
    entity.vertices ??= [];
    const last = entity.vertices[entity.vertices.length - 1];
    if (last) {
      last.z = value;
    }
    return;
  }
  if (isDimensionEntity(entity.type)) {
    // z not used for dimensions
    return;
  }
  if (entity.startPoint) entity.startPoint.z = value;
}

function normalizeDxfText(value: string): string {
  return value.replace(/\\P/g, ' ').trim();
}
