import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Point2D } from '@/domain/geometry/types';
import { CoordinateInputBar } from '../CoordinateInputDialog';

describe('CoordinateInputBar', () => {
  it('reports a live ghost point without looping when the parent callback changes identity', () => {
    function Harness() {
      const [ghost, setGhost] = useState<Point2D | null>(null);
      return (
        <>
          <CoordinateInputBar
            lastPoint={null}
            previewPoint={null}
            onSubmit={() => undefined}
            onGhostChange={(point) => setGhost(point)}
          />
          <output>{ghost ? `${ghost.x},${ghost.y}` : 'none'}</output>
        </>
      );
    }

    render(<Harness />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '100,200' } });

    expect(screen.getByText('100,200')).toBeInTheDocument();
  });
});
