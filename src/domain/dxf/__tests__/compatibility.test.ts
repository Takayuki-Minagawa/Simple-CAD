import { describe, expect, it } from 'vitest';
import sampleProject from '@/samples/sample-project.json';
import type { ProjectData } from '@/domain/structural/types';
import { exportDxf, exportDxfWithWarnings } from '@/domain/export/dxfExport';
import { importDxf } from '@/domain/import/dxfImport';
import { parseDxfEntities, parseDxfHeader } from '@/domain/import/dxfParser';
import { decodeDxfBytes, DXF_VERSIONS, type DxfVersion } from '../format';

const base = sampleProject as ProjectData;
const drawing = (entities: string[], version = 'AC1032') =>
  [
    '0',
    'SECTION',
    '2',
    'HEADER',
    '9',
    '$ACADVER',
    '1',
    version,
    '9',
    '$INSUNITS',
    '70',
    '4',
    '0',
    'ENDSEC',
    '0',
    'SECTION',
    '2',
    'ENTITIES',
    ...entities,
    '0',
    'ENDSEC',
    '0',
    'EOF',
  ].join('\n');

// Read records independently of the application's entity parser.
function records(content: string) {
  const lines = content.split('\n');
  const result: { type: string; tags: [number, string][] }[] = [];
  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = Number(lines[i]);
    if (code === 0) result.push({ type: lines[i + 1], tags: [] });
    else result.at(-1)?.tags.push([code, lines[i + 1]]);
  }
  return result;
}

describe('DXF format compatibility', () => {
  it.each(Object.keys(DXF_VERSIONS) as DxfVersion[])('exports and reimports %s', (version) => {
    const note = ' 日本語の注記 '.repeat(80) + '\n2行目 {柱} \\P 😀';
    const project: ProjectData = {
      ...base,
      grids: base.grids.map((g) => ({ ...g, name: g.name + '通り芯'.repeat(60) })),
      annotations: [
        {
          id: 'note',
          type: 'text',
          story: '1F',
          x: 1234,
          y: 5678,
          fontSize: 200,
          text: note,
          rotation: 30,
        },
      ],
    };
    const { content } = exportDxfWithWarnings(project, '1F', { version });
    expect(parseDxfHeader(content)).toMatchObject({ acadVersion: version, insUnits: 4 });
    if (version === 'AC1015') {
      expect(content).not.toMatch(/[\u0080-\uffff]/);
      expect(content).toContain('\\U+65E5');
    } else {
      expect(content).toContain('日本語');
    }
    const result = importDxf(decodeDxfBytes(new TextEncoder().encode(content)), '1F', {
      convertGeometry: true,
    });
    expect(result.error).toBeUndefined();
    expect(result.sourceVersion).toBe(version);
    expect(result.grids).toEqual(project.grids);
    expect(result.members.map((member) => member.id)).toEqual(
      project.members.filter((member) => member.story === '1F').map((member) => member.id),
    );
    expect(result.dimensions).toEqual(project.dimensions.filter((d) => d.story === '1F'));
    expect(result.annotations[0]).toMatchObject({ text: note, x: 1234, y: 5678 });

    expect(result.annotations[0].rotation).toBeCloseTo(30);

    const all = records(content);
    const handles = all.flatMap((record) =>
      record.tags.filter(([code]) => code === 5 || code === 105).map(([, value]) => value),
    );
    expect(new Set(handles).size).toBe(handles.length);
    const blocks = all
      .filter((r) => r.type === 'BLOCK')
      .map((r) => r.tags.find(([c]) => c === 2)?.[1]);
    for (const dim of all.filter((r) => r.type === 'DIMENSION')) {
      expect(blocks).toContain(dim.tags.find(([c]) => c === 2)?.[1]);
      expect(dim.tags).toContainEqual([100, 'AcDbAlignedDimension']);
    }
    const mtext = all.find((r) => r.type === 'MTEXT')!;
    const chunks = mtext.tags.filter(([c]) => c === 1 || c === 3);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.at(-1)?.[0]).toBe(1);
    for (const [, chunk] of chunks)
      expect(new TextEncoder().encode(chunk).length).toBeLessThanOrEqual(250);
  });

  it('defaults to 2018 and rejects invalid targets', () => {
    expect(parseDxfHeader(exportDxf(base, '1F')).acadVersion).toBe('AC1032');
    expect(() => exportDxf(base, 'missing')).toThrow('階');
    expect(() => exportDxf(base, '1F', [], { version: 'AC2015' as DxfVersion })).toThrow('形式');
  });

  it('decodes legacy Japanese Shift-JIS and modern UTF-8', () => {
    const header = new TextEncoder().encode(
      '0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n9\n$DWGCODEPAGE\n3\nANSI_932\n0\nENDSEC\n',
    );
    const bytes = new Uint8Array([...header, 0x93, 0xfa, 0x96, 0x7b]); // 日本
    expect(decodeDxfBytes(bytes)).toContain('日本');
    const modern = drawing(['0', 'TEXT', '10', '0', '20', '0', '1', '梁']);
    expect(decodeDxfBytes(new TextEncoder().encode(modern))).toBe(modern);
  });

  it('rejects binary, truncated and non-DXF input with an actionable error', () => {
    expect(() => decodeDxfBytes(new TextEncoder().encode('AutoCAD Binary DXF\r\n'))).toThrow(
      'バイナリ',
    );
    for (const content of ['hello', drawing([]).replace(/0\nEOF$/, ''), 'AutoCAD Binary DXF']) {
      const result = importDxf(content, '1F', { convertGeometry: true });
      expect(result.error).toBeDefined();
      expect(result.members).toEqual([]);
    }
  });

  it('preserves split Unicode escapes, spaces and MTEXT paragraphs', () => {
    const result = importDxf(
      drawing([
        '0',
        'MTEXT',
        '10',
        '12',
        '20',
        '34',
        '40',
        '200',
        '3',
        '  A\\U+6',
        '1',
        '5E5\\PB  ',
        '50',
        '90',
      ]),
      '1F',
    );
    expect(result.annotations[0]).toMatchObject({ text: '  A日\nB  ', rotation: 90 });
  });

  it('does not interpret DIMENSION style names as user text', () => {
    const entities = parseDxfEntities(drawing(['0', 'DIMENSION', '3', 'STANDARD', '1', '500']));
    expect(entities[0].text).toBe('500');
  });

  it('ignores classic POLYLINE dummy points and vertex flags', () => {
    const entities = parseDxfEntities(
      drawing(
        [
          '0',
          'POLYLINE',
          '8',
          'WALL',
          '70',
          '1',
          '10',
          '0',
          '20',
          '0',
          '30',
          '0',
          '0',
          'VERTEX',
          '8',
          '0',
          '70',
          '0',
          '10',
          '100',
          '20',
          '200',
          '0',
          'VERTEX',
          '8',
          '0',
          '70',
          '0',
          '10',
          '1100',
          '20',
          '200',
          '0',
          'SEQEND',
        ],
        'AC1015',
      ),
    );
    expect(entities).toHaveLength(1);
    expect(entities[0]).toMatchObject({
      layer: 'WALL',
      closed: true,
      vertices: [
        { x: 100, y: 200 },
        { x: 1100, y: 200 },
      ],
    });
  });

  it('warns instead of flattening bulged polylines or importing nonfinite geometry', () => {
    const result = importDxf(
      drawing([
        '0',
        'LWPOLYLINE',
        '8',
        'WALL',
        '10',
        '0',
        '20',
        '0',
        '42',
        '1',
        '10',
        '1000',
        '20',
        '0',
        '0',
        'LINE',
        '8',
        'WALL',
        '10',
        'NaN',
        '20',
        '0',
        '11',
        '1000',
        '21',
        '0',
      ]),
      '1F',
      { convertGeometry: true },
    );
    expect(result.members).toEqual([]);
    expect(result.warnings).toHaveLength(2);
  });

  it.each([NaN, Infinity, -1, 0])('ignores invalid unit scale %s', (unitScale) => {
    const result = importDxf(
      drawing(['0', 'LINE', '8', 'WALL', '10', '0', '20', '0', '11', '1000', '21', '0']),
      '1F',
      { convertGeometry: true, unitScale },
    );
    expect(result.members[0]).toMatchObject({ end: { x: 1000 } });
    expect(result.warnings.some((w) => w.includes('無効な単位倍率'))).toBe(true);
  });
});
