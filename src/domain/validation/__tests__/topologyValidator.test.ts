import { describe, it, expect } from 'vitest';
import { validateTopology } from '../topologyValidator';
import sampleProject from '@/samples/sample-project.json';
import type { ProjectData } from '@/domain/structural/types';

const validData = sampleProject as unknown as ProjectData;

describe('validateTopology', () => {
  it('passes for valid sample project (no errors)', () => {
    const result = validateTopology(validData);
    expect(result.ok).toBe(true);
    // Sample may legitimately produce warnings, but never errors.
    expect(result.errors.every((e) => e.level !== 'error')).toBe(true);
  });

  it('warns on duplicate story elevations', () => {
    const data: ProjectData = {
      ...validData,
      stories: [
        { id: '1F', name: '1F', elevation: 0, height: 3000 },
        { id: '2F', name: '2F', elevation: 0, height: 3000 },
      ],
    };
    const result = validateTopology(data);
    expect(result.errors.some((e) => e.level === 'warning' && e.message.includes('重複'))).toBe(
      true,
    );
  });

  it('warns on non-monotonic story elevation (逆順)', () => {
    const data: ProjectData = {
      ...validData,
      stories: [
        { id: '1F', name: '1F', elevation: 3000, height: 3000 },
        { id: '2F', name: '2F', elevation: 0, height: 3000 },
      ],
    };
    const result = validateTopology(data);
    expect(result.errors.some((e) => e.message.includes('逆順'))).toBe(true);
  });

  it('warns on broken adjacent EL continuity', () => {
    const data: ProjectData = {
      ...validData,
      stories: [
        { id: '1F', name: '1F', elevation: 0, height: 3000 },
        { id: '2F', name: '2F', elevation: 5000, height: 3000 }, // gap (3000 ≠ 5000)
      ],
      members: [],
    };
    const result = validateTopology(data);
    expect(result.errors.some((e) => e.message.includes('不一致'))).toBe(true);
  });

  it('warns on duplicate grid position per axis', () => {
    const data: ProjectData = {
      ...validData,
      grids: [
        { id: 'GX1', axis: 'X', name: 'X1', position: 0 },
        { id: 'GX2', axis: 'X', name: 'X2', position: 0 },
      ],
    };
    const result = validateTopology(data);
    expect(result.errors.some((e) => e.message.includes('position'))).toBe(true);
  });

  it('warns when slab level is outside story range', () => {
    const data: ProjectData = {
      ...validData,
      members: [
        {
          id: 'SLAB-BAD',
          type: 'slab',
          story: '1F',
          sectionId: 'SEC-SLAB180',
          materialId: 'MAT-RC-24',
          polygon: [
            { x: 0, y: 0 },
            { x: 1000, y: 0 },
            { x: 1000, y: 1000 },
            { x: 0, y: 1000 },
          ],
          level: 99000,
        },
      ],
    };
    const result = validateTopology(data);
    expect(result.errors.some((e) => e.message.includes('範囲'))).toBe(true);
  });

  it('warns when wall height exceeds story height', () => {
    const data: ProjectData = {
      ...validData,
      members: [
        {
          id: 'W-TALL',
          type: 'wall',
          story: '1F',
          sectionId: 'SEC-WALL200',
          materialId: 'MAT-RC-24',
          start: { x: 0, y: 0, z: 0 },
          end: { x: 4000, y: 0, z: 0 },
          height: 9000,
          thickness: 200,
        },
      ],
    };
    const result = validateTopology(data);
    expect(result.errors.some((e) => e.message.includes('階高'))).toBe(true);
  });

  it('warns on a floating beam endpoint (joint not satisfied)', () => {
    const data: ProjectData = {
      ...validData,
      members: [
        {
          id: 'B-FLOAT',
          type: 'beam',
          story: '1F',
          sectionId: 'SEC-B300x600',
          materialId: 'MAT-RC-24',
          start: { x: 12345, y: 67890, z: 3000 },
          end: { x: 22345, y: 67890, z: 3000 },
        },
      ],
    };
    const result = validateTopology(data);
    expect(result.errors.some((e) => e.message.includes('接合'))).toBe(true);
  });
});
