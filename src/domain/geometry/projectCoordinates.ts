import type { ProjectData, Section } from '@/domain/structural/types';
import { COORD_PRECISION, quantize, quantizePoint2D, quantizePoint3D } from './precision';

/**
 * Normalize every persisted geometric coordinate at a domain write/import
 * boundary. This keeps project JSON deterministic without conflating storage
 * precision (0.001mm) with the structural joint merge tolerance (1mm).
 */
export function normalizeProjectCoordinates(
  data: ProjectData,
  step: number = COORD_PRECISION,
): ProjectData {
  const q = (value: number) => quantize(value, step);
  const q2 = <T extends { x: number; y: number }>(point: T): T =>
    ({ ...point, ...quantizePoint2D(point, step) }) as T;
  const q3 = <T extends { x: number; y: number; z: number }>(point: T): T =>
    ({ ...point, ...quantizePoint3D(point, step) }) as T;

  return {
    ...data,
    stories: data.stories.map((story) => ({
      ...story,
      elevation: q(story.elevation),
      height: q(story.height),
    })),
    grids: data.grids.map((grid) => ({ ...grid, position: q(grid.position) })),
    sections: data.sections.map((section) => normalizeSection(section, q)),
    members: data.members.map((member) => {
      const common = {
        ...member,
        ...(member.axisOffset
          ? { axisOffset: { dx: q(member.axisOffset.dx), dy: q(member.axisOffset.dy) } }
          : {}),
        ...(member.rigidZones
          ? {
              rigidZones: {
                ...(member.rigidZones.start !== undefined
                  ? { start: q(member.rigidZones.start) }
                  : {}),
                ...(member.rigidZones.end !== undefined
                  ? { end: q(member.rigidZones.end) }
                  : {}),
              },
            }
          : {}),
        ...(member.localAxis?.referenceVector
          ? {
              localAxis: {
                ...member.localAxis,
                referenceVector: q3(member.localAxis.referenceVector),
              },
            }
          : {}),
      };
      if (member.type === 'slab') {
        return {
          ...common,
          polygon: member.polygon.map(q2),
          level: q(member.level),
        };
      }
      return {
        ...common,
        start: q3(member.start),
        end: q3(member.end),
        ...(member.type === 'wall'
          ? { height: q(member.height), thickness: q(member.thickness) }
          : {}),
      };
    }),
    openings: data.openings.map((opening) => ({
      ...opening,
      position: q3(opening.position),
      width: q(opening.width),
      height: q(opening.height),
    })),
    annotations: data.annotations.map((annotation) => ({
      ...annotation,
      x: q(annotation.x),
      y: q(annotation.y),
      ...(annotation.points ? { points: annotation.points.map(q2) } : {}),
    })),
    dimensions: data.dimensions.map((dimension) => ({
      ...dimension,
      start: q2(dimension.start),
      end: q2(dimension.end),
      offset: q(dimension.offset),
    })),
    views: data.views.map((view) =>
      view.type === 'plan'
        ? {
            ...view,
            center: q2(view.center),
            width: q(view.width),
            height: q(view.height),
          }
        : view,
    ),
    sheets: data.sheets.map((sheet) => ({
      ...sheet,
      ...(sheet.viewports
        ? {
            viewports: sheet.viewports.map((viewport) => ({
              ...viewport,
              x: q(viewport.x),
              y: q(viewport.y),
              width: q(viewport.width),
              height: q(viewport.height),
            })),
          }
        : {}),
    })),
    ...(data.constructionLines
      ? {
          constructionLines: data.constructionLines.map((line) => ({
            ...line,
            origin: q2(line.origin),
            direction: q2(line.direction),
          })),
        }
      : {}),
    ...(data.externalRefs
      ? {
          externalRefs: data.externalRefs.map((reference) => ({
            ...reference,
            data: normalizeProjectCoordinates(reference.data, step),
            offsetX: q(reference.offsetX),
            offsetY: q(reference.offsetY),
          })),
        }
      : {}),
    ...(data.supports
      ? { supports: data.supports.map((support) => ({ ...support, position: q3(support.position) })) }
      : {}),
    ...(data.nodalLoads
      ? { nodalLoads: data.nodalLoads.map((load) => ({ ...load, position: q3(load.position) })) }
      : {}),
    ...(data.masses
      ? { masses: data.masses.map((mass) => ({ ...mass, position: q3(mass.position) })) }
      : {}),
    ...(data.diaphragms
      ? {
          diaphragms: data.diaphragms.map((diaphragm) => ({
            ...diaphragm,
            ...(diaphragm.masterPosition
              ? { masterPosition: q3(diaphragm.masterPosition) }
              : {}),
          })),
        }
      : {}),
    ...(data.analysisResults
      ? {
          analysisResults: {
            ...data.analysisResults,
            ...(data.analysisResults.nodeDisplacements
              ? {
                  nodeDisplacements: data.analysisResults.nodeDisplacements.map((result) => ({
                    ...result,
                    position: q3(result.position),
                  })),
                }
              : {}),
          },
        }
      : {}),
  };
}

function normalizeSection(section: Section, q: (value: number) => number): Section {
  if (section.kind === 's_pipe') {
    return { ...section, diameter: q(section.diameter), thickness: q(section.thickness) };
  }
  if (section.kind === 'rc_wall' || section.kind === 'rc_slab') {
    return {
      ...section,
      thickness: q(section.thickness),
      ...(section.cover !== undefined ? { cover: q(section.cover) } : {}),
    };
  }
  if (section.kind === 's_column_h' || section.kind === 's_beam_h') {
    return {
      ...section,
      width: q(section.width),
      depth: q(section.depth),
      ...(section.tw !== undefined ? { tw: q(section.tw) } : {}),
      ...(section.tf !== undefined ? { tf: q(section.tf) } : {}),
    };
  }
  return {
    ...section,
    width: q(section.width),
    depth: q(section.depth),
    ...(section.cover !== undefined ? { cover: q(section.cover) } : {}),
    ...(section.rebar
      ? {
          rebar: {
            ...section.rebar,
            ...(section.rebar.mainDiameter !== undefined
              ? { mainDiameter: q(section.rebar.mainDiameter) }
              : {}),
            ...(section.rebar.hoopDiameter !== undefined
              ? { hoopDiameter: q(section.rebar.hoopDiameter) }
              : {}),
            ...(section.rebar.hoopSpacing !== undefined
              ? { hoopSpacing: q(section.rebar.hoopSpacing) }
              : {}),
          },
        }
      : {}),
  };
}
