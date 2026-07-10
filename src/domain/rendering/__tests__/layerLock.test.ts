import { describe, expect, it } from 'vitest';
import sampleProject from '@/samples/sample-project.json';
import type { ProjectData } from '@/domain/structural/types';
import { entityLayerForId, isEntityLayerInteractive } from '../layerLock';

describe('entity layer interaction', () => {
  const data = sampleProject as unknown as ProjectData;

  it('maps selectable IDs to their owning layer', () => {
    const beam = data.members.find((member) => member.type === 'beam')!;
    expect(entityLayerForId(data, beam.id)).toBe('member-beam');
    expect(entityLayerForId(data, data.openings[0].id)).toBe('opening');
    expect(entityLayerForId(data, data.annotations[0].id)).toBe('annotation');
  });

  it('rejects entities on either a locked or hidden layer', () => {
    const beam = data.members.find((member) => member.type === 'beam')!;
    expect(isEntityLayerInteractive(data, beam.id, { 'member-beam': true })).toBe(false);
    expect(
      isEntityLayerInteractive(
        data,
        beam.id,
        { 'member-beam': false },
        { 'member-beam': false },
      ),
    ).toBe(false);
    expect(
      isEntityLayerInteractive(
        data,
        beam.id,
        { 'member-beam': false },
        { 'member-beam': true },
      ),
    ).toBe(true);
  });
});
