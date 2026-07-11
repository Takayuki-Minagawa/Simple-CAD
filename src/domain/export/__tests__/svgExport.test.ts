import { describe, expect, it } from 'vitest';
import sampleProject from '@/samples/sample-project.json';
import type { ProjectData } from '@/domain/structural/types';
import { exportSvg } from '../svgExport';

describe('exportSvg security', () => {
  it('escapes text/attributes and rejects active paint/font/id values in the downloaded SVG', () => {
    const base = sampleProject as ProjectData;
    const payload = `</text><script>alert('xss')</script><text>`;
    const attributePayload = `red" onload="alert(1)`;
    const project: ProjectData = {
      ...base,
      project: { ...base.project, name: payload },
      members: base.members.map((member, index) =>
        index === 0
          ? {
              ...member,
              color: `url(javascript:alert(1))`,
              ...(member.type === 'slab' ? { fillColor: attributePayload } : {}),
            }
          : member,
      ),
      annotations: [
        {
          ...base.annotations[0],
          text: payload,
          color: attributePayload,
          fontFamily: `sans-serif"/><script>alert(2)</script>`,
        },
      ],
      dimensions: [
        {
          ...base.dimensions[0],
          text: payload,
          color: `url(https://attacker.invalid/paint.svg)`,
        },
      ],
      sheets: base.sheets.map((sheet, index) =>
        index === 0
          ? {
              ...sheet,
              titleBlock: { ...sheet.titleBlock, note: payload },
              viewports: [
                {
                  id: `bad" onload="alert(3)`,
                  sheetId: sheet.id,
                  viewId: base.views.find((view) => view.type === 'plan')!.id,
                  x: 20,
                  y: 20,
                  width: 100,
                  height: 100,
                  scale: '1:100',
                },
              ],
            }
          : sheet,
      ),
    };

    const svg = exportSvg(project, project.sheets[0].id);
    const document = new DOMParser().parseFromString(svg, 'image/svg+xml');

    expect(document.querySelector('parsererror')).toBeNull();
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('[onload]')).toBeNull();
    expect(svg).not.toContain('javascript:');
    expect(svg).not.toContain('attacker.invalid');
    expect(svg).not.toContain(' onload=');
    expect(document.documentElement.textContent).toContain(payload);
  });
});
