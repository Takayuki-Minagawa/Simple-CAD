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
  rotation?: number;
  hasBulge?: boolean;
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
  /** Simple-CAD metadata carried in registered XDATA (or legacy code 999 comments). */
  metadata?: string[];
}

export interface DxfHeader {
  acadVersion?: string;
  codePage?: string;
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
  const lines = content.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/);
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

    if (currentVar === '$ACADVER' && code === 1) {
      header.acadVersion = value;
      currentVar = null;
    } else if (currentVar === '$DWGCODEPAGE' && code === 3) {
      header.codePage = value;
      currentVar = null;
    } else if (currentVar === '$INSUNITS' && code === 70) {
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
  const lines = content.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/);
  if (content.startsWith('AutoCAD Binary DXF')) {
    throw new Error('バイナリDXFは未対応です。テキストDXFとして保存してください。');
  }
  if (
    !/0\s*[\r\n]+\s*SECTION\s*[\r\n]+\s*2\s*[\r\n]+\s*ENTITIES(?:\s|$)/.test(content) ||
    !/0\s*[\r\n]+\s*EOF\s*$/.test(content)
  ) {
    throw new Error('DXFのENTITIESセクションまたはEOFがありません。ファイルを確認してください。');
  }
  const entities: DxfEntity[] = [];
  let inEntities = false;
  let current: DxfEntity | null = null;
  let inVertex = false;
  let xdataApp = '';
  let metadataIndex = -1;

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
        inVertex = true;
        xdataApp = '';
        continue;
      }
      if (current && current.type === 'POLYLINE' && value === 'SEQEND') {
        entities.push(current);
        current = null;
        continue;
      }
      if (current) entities.push(current);
      current = { type: value };
      inVertex = false;
      xdataApp = '';
      metadataIndex = -1;
      continue;
    }

    if (!current) continue;

    if (code === 1001) {
      xdataApp = value;
      if (value === 'SIMPLECAD') {
        current.metadata ??= [];
        metadataIndex = current.metadata.push('') - 1;
      }
      continue;
    }
    if (code >= 1000) {
      if (code === 1000 && xdataApp === 'SIMPLECAD' && metadataIndex >= 0) {
        current.metadata![metadataIndex] += value;
      }
      continue;
    }
    // POLYLINE header coordinates are an elevation/dummy point, not a vertex.
    if (current.type === 'POLYLINE' && !inVertex && [10, 20, 30].includes(code)) continue;
    if (current.type === 'POLYLINE' && inVertex && [8, 70].includes(code)) continue;

    switch (code) {
      case 8:
        current.layer = decodeDxfUnicode(value);
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
        if (code === 1 || current.type === 'MTEXT') {
          current.text = (current.text ?? '') + (lines[i + 1] ?? '');
        }
        break;
      case 42:
        if (['LWPOLYLINE', 'POLYLINE'].includes(current.type) && Number(value) !== 0) {
          current.hasBulge = true;
        }
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
        if (current.type === 'TEXT' || current.type === 'MTEXT') {
          current.rotation = parseFloat(value);
        }
        break;
      case 51:
        current.endAngle = parseFloat(value);
        break;
      case 999:
        current.metadata ??= [];
        current.metadata.push(value);
        break;
    }
  }

  if (current) entities.push(current);
  for (const entity of entities) {
    if (entity.text !== undefined)
      entity.text = normalizeDxfText(entity.text, entity.type === 'MTEXT');
    if (
      entity.type === 'MTEXT' &&
      entity.endPoint &&
      (entity.endPoint.x !== 0 || entity.endPoint.y !== 0)
    ) {
      entity.rotation = (Math.atan2(entity.endPoint.y, entity.endPoint.x) * 180) / Math.PI;
    }
  }
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

function decodeDxfUnicode(value: string): string {
  return value.replace(/\\U\+([0-9a-f]{4})/gi, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
}

function normalizeDxfText(value: string, multiline: boolean): string {
  if (!multiline) return decodeDxfUnicode(value);
  // Parse escapes in one pass so a literal \\P is not treated as a paragraph.
  return value.replace(
    /\\U\+([0-9a-f]{4})|\\([\\{}P~])/gi,
    (token, hex: string | undefined, escaped: string) => {
      if (hex) return String.fromCharCode(parseInt(hex, 16));
      if (escaped === 'P') return '\n';
      if (escaped === '~') return ' ';
      return escaped ?? token;
    },
  );
}
