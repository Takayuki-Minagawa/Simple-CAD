import type {
  Annotation,
  ConstructionLine,
  Dimension,
  Grid,
  Member,
  Section,
} from '@/domain/structural/types';
import { generateId } from '@/domain/idGenerator';
import { quantize } from '@/domain/geometry/precision';
import { parseDxfEntities, parseDxfHeader, type DxfEntity } from './dxfParser';
import {
  SectionRegistry,
  classifyDxfLayer,
  convertCircleToMember,
  convertDimensionEntity,
  convertLineToMember,
  convertPolylineToMembers,
  readSimpleCadMetadata,
  reserveMetadataId,
} from './dxfConverters';

export { DXF_MATERIAL, DXF_MATERIAL_ID, isRectangle, isSquarish } from './dxfConverters';

export interface DxfImportResult {
  sourceVersion?: string;
  error?: string;
  annotations: Annotation[];
  members: Member[];
  dimensions: Dimension[];
  grids: Grid[];
  constructionLines: ConstructionLine[];
  autoSections: Section[];
  primitiveCount: number;
  warnings: string[];
}

export interface DxfImportOptions {
  /** When true, convert geometry entities to structural members. Default: false (annotations only). */
  convertGeometry?: boolean;
  /**
   * Override the source unit→mm scale. When omitted the scale is read from the
   * HEADER `$INSUNITS` variable, falling back to a bounding-box heuristic.
   */
  unitScale?: number;
}

/**
 * Map a DXF `$INSUNITS` code to a millimetre scale factor.
 * Returns null for "unitless" (0) or unknown codes so the caller can fall back
 * to a heuristic.
 */
export function insUnitsToMm(code: number | undefined): number | null {
  const surveyFootMm = (1200 / 3937) * 1000;
  switch (code) {
    case 1:
      return 25.4; // inches
    case 2:
      return 304.8; // feet
    case 3:
      return 1_609_344; // miles
    case 4:
      return 1; // millimetres
    case 5:
      return 10; // centimetres
    case 6:
      return 1000; // metres
    case 7:
      return 1e6; // kilometres
    case 8:
      return 0.0000254; // microinches (1µin = 2.54e-5 mm)
    case 9:
      return 0.0254; // mils (1 mil = 0.001 in = 0.0254 mm)
    case 10:
      return 914.4; // yards
    case 11:
      return 1e-7; // angstroms
    case 12:
      return 1e-6; // nanometres
    case 13:
      return 1e-3; // microns / micrometres
    case 14:
      return 100; // decimetres (1 dm = 100 mm)
    case 15:
      return 10_000; // dekametres
    case 16:
      return 100_000; // hectometres
    case 17:
      return 1e12; // gigametres
    case 18:
      return 149_597_870_700_000; // astronomical units
    case 19:
      return 9.4607304725808e18; // light years
    case 20:
      return 3.085677581491367e19; // parsecs
    case 21:
      return surveyFootMm;
    case 22:
      return surveyFootMm / 12;
    case 23:
      return surveyFootMm * 3;
    case 24:
      return surveyFootMm * 5280;
    default:
      return null; // 0 = unitless / unknown
  }
}

/**
 * Heuristic unit guess from the drawing magnitude when no `$INSUNITS` is present.
 * Structural drawings in mm have extents in the thousands; metre-unit drawings
 * are in the tens. Returns the mm scale and whether a guess was made.
 */
export function heuristicUnitScale(
  maxExtent: number,
  measurement?: number,
): { scale: number; guessed: boolean } {
  if (!Number.isFinite(maxExtent) || maxExtent <= 0) return { scale: 1, guessed: false };
  // $MEASUREMENT=0 is the only reliable hint for a unitless imperial drawing.
  if (measurement === 0) return { scale: 25.4, guessed: true };
  // A typical building is >= ~3m. If the largest extent is under ~200, the
  // drawing is almost certainly in metres (a 50m building → 50 units).
  if (maxExtent < 200) return { scale: 1000, guessed: true };
  return { scale: 1, guessed: false };
}

function entityExtent(entities: DxfEntity[]): number {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const acc = (x: number | undefined, y: number | undefined) => {
    if (typeof x === 'number' && Number.isFinite(x)) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
    if (typeof y === 'number' && Number.isFinite(y)) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  };
  for (const e of entities) {
    acc(e.startPoint?.x, e.startPoint?.y);
    acc(e.endPoint?.x, e.endPoint?.y);
    acc(e.dimExt1?.x, e.dimExt1?.y);
    acc(e.dimExt2?.x, e.dimExt2?.y);
    acc(e.dimLineOrigin?.x, e.dimLineOrigin?.y);
    if (e.center && Number.isFinite(e.radius)) {
      const radius = Math.abs(e.radius ?? 0);
      acc(e.center.x - radius, e.center.y - radius);
      acc(e.center.x + radius, e.center.y + radius);
    } else {
      acc(e.center?.x, e.center?.y);
    }
    for (const v of e.vertices ?? []) {
      acc(v.x, v.y);
    }
  }
  const xRange = Number.isFinite(minX) ? maxX - minX : 0;
  const yRange = Number.isFinite(minY) ? maxY - minY : 0;
  return Math.max(xRange, yRange);
}

function scaleEntityToMillimetres(entity: DxfEntity, scale: number): DxfEntity {
  const scalar = (value: number | undefined) =>
    value === undefined ? undefined : quantize(value * scale);
  const point = (value: { x: number; y: number; z?: number } | undefined) =>
    value
      ? {
          x: quantize(value.x * scale),
          y: quantize(value.y * scale),
          ...(value.z !== undefined ? { z: quantize(value.z * scale) } : {}),
        }
      : undefined;

  return {
    ...entity,
    startPoint: point(entity.startPoint),
    endPoint: point(entity.endPoint),
    center: point(entity.center),
    vertices: entity.vertices?.map((vertex) => point(vertex)!),
    dimLineOrigin: point(entity.dimLineOrigin),
    dimExt1: point(entity.dimExt1),
    dimExt2: point(entity.dimExt2),
    radius: scalar(entity.radius),
    textHeight: scalar(entity.textHeight),
    majorAxisEndpoint: point(entity.majorAxisEndpoint),
  };
}

/**
 * Import DXF using a simple line-based parser.
 * Supports: LINE, LWPOLYLINE, POLYLINE, CIRCLE, ARC, TEXT, MTEXT, SPLINE, HATCH, ELLIPSE, DIMENSION
 * Unsupported entities are skipped with warnings.
 */
export function importDxf(
  content: string,
  defaultStory: string,
  options: DxfImportOptions = {},
): DxfImportResult {
  const annotations: Annotation[] = [];
  const members: Member[] = [];
  const dimensions: Dimension[] = [];
  const grids: Grid[] = [];
  const constructionLines: ConstructionLine[] = [];
  const warnings: string[] = [];
  let primitiveCount = 0;
  let error: string | undefined;
  const header = parseDxfHeader(content);

  const convertGeometry = options.convertGeometry ?? false;
  const sections = new SectionRegistry();
  const usedIds = new Set<string>();
  let unitScale = 1;

  try {
    const entities = parseDxfEntities(content);
    if (
      header.acadVersion &&
      ![
        'AC1006',
        'AC1009',
        'AC1012',
        'AC1014',
        'AC1015',
        'AC1018',
        'AC1021',
        'AC1024',
        'AC1027',
        'AC1032',
      ].includes(header.acadVersion)
    ) {
      warnings.push(`未確認のDXF形式 ${header.acadVersion}: 対応エンティティのみ読み込みます`);
    }

    // Determine the source unit → mm scale (3-3 / B4).
    if (
      typeof options.unitScale === 'number' &&
      Number.isFinite(options.unitScale) &&
      options.unitScale > 0
    ) {
      unitScale = options.unitScale;
    } else {
      const fromHeader = insUnitsToMm(header.insUnits);
      if (fromHeader !== null) {
        unitScale = fromHeader;
        if (unitScale !== 1) {
          warnings.push(
            `$INSUNITS=${header.insUnits} を検出: 座標を mm に ${unitScale}倍 でスケールしました`,
          );
        }
      } else {
        const guess = heuristicUnitScale(entityExtent(entities), header.measurement);
        unitScale = guess.scale;
        if (guess.guessed) {
          const assumed = unitScale === 25.4 ? 'インチ' : 'メートル';
          warnings.push(
            `$INSUNITS が無いため図面範囲から単位を推定: ${assumed}単位とみなし ${unitScale}倍 でスケールしました（誤りの場合は単位を指定してください）`,
          );
        }
      }
    }

    if (
      typeof options.unitScale === 'number' &&
      (!Number.isFinite(options.unitScale) || options.unitScale <= 0)
    ) {
      warnings.push(
        `無効な単位倍率 ${options.unitScale} は使用せず、DXFヘッダーから単位を解決しました`,
      );
    }
    if (convertGeometry && options.unitScale === undefined) {
      if (insUnitsToMm(header.insUnits) === null && unitScale === 1) {
        warnings.push(
          '$INSUNITS が無いため mm と仮定しました（必要に応じて単位を指定してください）',
        );
      }
    }

    const warnedLayers = new Set<string>();
    for (const rawEntity of entities) {
      // Convert source coordinates first. Converter defaults (200mm wall,
      // 3000mm storey, etc.) are already expressed in internal mm and must not
      // be multiplied by the source unit scale.
      const entity = scaleEntityToMillimetres(rawEntity, unitScale);
      const role = classifyDxfLayer(entity.layer);
      const points = [
        entity.startPoint,
        entity.endPoint,
        entity.center,
        entity.dimExt1,
        entity.dimExt2,
        entity.dimLineOrigin,
        ...(entity.vertices ?? []),
      ];
      if (
        entity.type !== 'TEXT' &&
        entity.type !== 'MTEXT' &&
        points.some((point) => point && !isFiniteDxfPoint(point))
      ) {
        primitiveCount++;
        warnings.push(`${entity.type} の座標が有限でないためスキップしました`);
        continue;
      }
      if (convertGeometry && entity.hasBulge) {
        primitiveCount++;
        warnings.push(
          `${entity.type} の円弧区間（bulge）は構造部材へ変換できないためスキップしました`,
        );
        continue;
      }
      if (
        convertGeometry &&
        role === 'unknown' &&
        ['LINE', 'LWPOLYLINE', 'POLYLINE', 'CIRCLE'].includes(entity.type)
      ) {
        const layer = entity.layer?.trim() || '(レイヤーなし)';
        if (!warnedLayers.has(layer)) {
          warnings.push(`レイヤー ${layer} は部材種別が不明なため形状から自動判定しました`);
          warnedLayers.add(layer);
        }
      }
      switch (entity.type) {
        case 'LINE':
          primitiveCount++;
          if (convertGeometry) {
            if (role === 'grid') {
              const grid = convertGridLine(entity, grids, usedIds);
              if (grid) grids.push(grid);
            } else if (role === 'construction') {
              const line = convertConstructionLine(entity, defaultStory, usedIds);
              if (line) constructionLines.push(line);
            } else if (role === 'column' || role === 'slab') {
              warnings.push(
                `${role === 'column' ? 'COLUMN' : 'SLAB'} レイヤーの LINE は部材形状を表せないためスキップしました`,
              );
            } else if (role !== 'dimension' && role !== 'annotation') {
              const member = convertLineToMember(entity, defaultStory, sections, usedIds, role);
              if (member) {
                if (isZeroLength(member)) {
                  warnings.push(
                    `長さ0の ${entity.type} をレイヤー ${entity.layer ?? '(なし)'} でスキップしました`,
                  );
                } else {
                  members.push(member);
                }
              }
            }
          }
          break;
        case 'LWPOLYLINE':
        case 'POLYLINE':
          primitiveCount++;
          if (convertGeometry) {
            if (!['grid', 'dimension', 'annotation', 'construction'].includes(role)) {
              const polyMembers = convertPolylineToMembers(
                entity,
                defaultStory,
                sections,
                usedIds,
                role,
              );
              members.push(...polyMembers.filter((member) => !isZeroLength(member)));
            }
          }
          break;
        case 'CIRCLE':
          primitiveCount++;
          if (convertGeometry) {
            const colMember =
              role !== 'column' && role !== 'unknown'
                ? null
                : convertCircleToMember(entity, defaultStory, sections, usedIds);
            if (colMember) members.push(colMember);
          }
          break;
        case 'ARC':
        case 'SPLINE':
        case 'HATCH':
        case 'ELLIPSE':
          primitiveCount++;
          warnings.push(`未対応エンティティ: ${entity.type} をスキップ`);
          break;
        case 'DIMENSION':
          primitiveCount++;
          if (convertGeometry) {
            const dim = convertDimensionEntity(entity, defaultStory, usedIds);
            if (dim) dimensions.push(dim);
          }
          break;
        case 'TEXT':
        case 'MTEXT':
          if (
            entity.startPoint &&
            entity.text &&
            role !== 'dimension' &&
            role !== 'grid' &&
            isFiniteDxfPoint(entity.startPoint)
          ) {
            const hasValidTextHeight =
              entity.textHeight !== undefined &&
              Number.isFinite(entity.textHeight) &&
              entity.textHeight > 0;
            const fontSize = hasValidTextHeight ? entity.textHeight! : 250;
            if (entity.textHeight !== undefined && !hasValidTextHeight) {
              warnings.push(`${entity.type} の文字高さが無効なため 250mm を使用しました`);
            }
            annotations.push({
              id: generateId('ann', usedIds),
              type: 'text',
              story: defaultStory,
              x: entity.startPoint.x,
              y: entity.startPoint.y,
              text: entity.text,
              fontSize,
              ...(Number.isFinite(entity.rotation) ? { rotation: entity.rotation } : {}),
            });
          } else if (entity.text && role !== 'dimension' && role !== 'grid') {
            warnings.push(`${entity.type} の挿入点が有限座標でないためスキップしました`);
          }
          primitiveCount++;
          break;
        default:
          warnings.push(`未対応エンティティ: ${entity.type} をスキップ`);
      }
    }
  } catch (e) {
    error = `DXF parse error: ${String(e)}`;
    warnings.push(error);
  }

  return {
    sourceVersion: header.acadVersion,
    ...(error ? { error } : {}),
    annotations,
    members,
    dimensions,
    grids,
    constructionLines,
    autoSections: convertGeometry ? sections.getAllSections() : [],
    primitiveCount,
    warnings,
  };
}

function isFiniteDxfPoint(point: { x: number; y: number; z?: number }): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    (point.z === undefined || Number.isFinite(point.z))
  );
}

function convertGridLine(entity: DxfEntity, existing: Grid[], usedIds: Set<string>): Grid | null {
  if (!entity.startPoint || !entity.endPoint) return null;
  const dx = Math.abs(entity.endPoint.x - entity.startPoint.x);
  const dy = Math.abs(entity.endPoint.y - entity.startPoint.y);
  if (dx === 0 && dy === 0) return null;
  const metadata = readSimpleCadMetadata<Partial<Grid>>(entity, 'GRID');
  const axis: Grid['axis'] =
    metadata?.axis === 'X' || metadata?.axis === 'Y' ? metadata.axis : dy >= dx ? 'X' : 'Y';
  const position =
    axis === 'X'
      ? (entity.startPoint.x + entity.endPoint.x) / 2
      : (entity.startPoint.y + entity.endPoint.y) / 2;
  const sameAxisCount = existing.filter((grid) => grid.axis === axis).length + 1;
  return {
    id: reserveMetadataId(metadata?.id, 'grid', usedIds),
    axis,
    name: typeof metadata?.name === 'string' ? metadata.name : `${axis}${sameAxisCount}`,
    position: quantize(position),
  };
}

function convertConstructionLine(
  entity: DxfEntity,
  story: string,
  usedIds: Set<string>,
): ConstructionLine | null {
  if (!entity.startPoint || !entity.endPoint) return null;
  const dx = entity.endPoint.x - entity.startPoint.x;
  const dy = entity.endPoint.y - entity.startPoint.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;
  const metadata = readSimpleCadMetadata<Partial<ConstructionLine>>(entity, 'CONSTRUCTION');
  return {
    id: reserveMetadataId(metadata?.id, 'construction', usedIds),
    story,
    type: metadata?.type === 'ray' ? 'ray' : 'xline',
    origin: { x: entity.startPoint.x, y: entity.startPoint.y },
    direction: { x: dx / length, y: dy / length },
  };
}

function isZeroLength(member: Member): boolean {
  if (member.type === 'slab') return false;
  return (
    member.start.x === member.end.x &&
    member.start.y === member.end.y &&
    member.start.z === member.end.z
  );
}

/** Helper to retrieve auto-generated sections from an import result */
export function getAutoSections(result: DxfImportResult): Section[] {
  return result.autoSections;
}
