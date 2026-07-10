import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import sampleProject from '@/samples/sample-project.json';
import type { ProjectData } from '@/domain/structural/types';
import { AnalysisModelSection } from '../AnalysisModelSection';
import { useI18n } from '@/i18n';

describe('AnalysisModelSection', () => {
  it('adds a support at the first story and emits one analysis-data patch', () => {
    const onUpdate = vi.fn();
    const onUpdateMember = vi.fn();
    render(
      <AnalysisModelSection
        data={sampleProject as unknown as ProjectData}
        onUpdate={onUpdate}
        onUpdateMember={onUpdateMember}
      />,
    );

    const heading = screen.getByRole('heading', { name: '支持条件 (0)' });
    const section = heading.closest('section');
    expect(section).not.toBeNull();
    fireEvent.click(within(section!).getByRole('button', { name: '追加' }));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0][0].supports).toEqual([
      expect.objectContaining({
        id: 'SUP-001',
        storyId: '1F',
        position: { x: 0, y: 0, z: 0 },
        restraints: { ux: true, uy: true, uz: true, rx: true, ry: true, rz: true },
      }),
    ]);

    const rigidStart = screen.getByLabelText('始点側剛域 (mm)');
    fireEvent.change(rigidStart, { target: { value: '120' } });
    fireEvent.blur(rigidStart);
    expect(onUpdateMember).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ rigidZones: expect.objectContaining({ start: 120 }) }),
    );
  });

  it('rounds stored local-axis radians before displaying degrees', () => {
    useI18n.getState().setLocale('en');
    const data = structuredClone(sampleProject) as unknown as ProjectData;
    const member = data.members.find((item) => item.type !== 'slab')!;
    member.localAxis = { rotation: 0.523599 };

    render(<AnalysisModelSection data={data} onUpdate={vi.fn()} onUpdateMember={vi.fn()} />);

    expect(screen.getByLabelText('Local-axis rotation (deg)')).toHaveValue(30);
  });
});
