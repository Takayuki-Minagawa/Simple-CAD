import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { LAYER_NAMES, useEditorStore, useProjectStore } from '@/app/store';
import sampleProject from '@/samples/sample-project.json';
import type { ProjectData } from '@/domain/structural/types';
import { SvgCanvas } from '../SvgCanvas';
import { useEditorInteraction } from '../useEditorInteraction';

function Harness() {
  const interaction = useEditorInteraction();
  return (
    <SvgCanvas
      onWorldClick={interaction.handleClick}
      onWorldMouseDown={interaction.handleMouseDown}
      onWorldMouseMove={interaction.handleMouseMove}
      onWorldMouseUp={interaction.handleMouseUp}
      onWorldCancel={interaction.cancelRectangleSelection}
    >
      <line data-testid="inside" data-id="inside" x1={100} y1={100} x2={200} y2={100} />
      <line data-testid="outside" data-id="outside" x1={600} y1={100} x2={700} y2={100} />
      <g data-testid="drawing" data-point-count={interaction.drawState.points.length} />
    </SvgCanvas>
  );
}

function setupCanvas() {
  const result = render(<Harness />);
  return { ...result, svg: result.container.querySelector('svg')! };
}

function drag(
  svg: SVGSVGElement,
  options: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean } = {},
) {
  fireEvent.mouseDown(svg, { button: 0, clientX: 50, clientY: 450, ...options });
  fireEvent.mouseMove(svg, { clientX: 250, clientY: 350, ...options });
  fireEvent.mouseUp(svg, { button: 0, clientX: 250, clientY: 350, ...options });
  fireEvent.click(svg, { clientX: 250, clientY: 350, ...options });
}

describe('canvas gesture integration', () => {
  beforeEach(() => {
    const data = JSON.parse(JSON.stringify(sampleProject)) as ProjectData;
    const beam = data.members.find((member) => member.type === 'beam')!;
    data.members = [
      { ...beam, id: 'inside', start: { x: 100, y: 100, z: 3000 }, end: { x: 200, y: 100, z: 3000 } },
      { ...beam, id: 'outside', start: { x: 600, y: 100, z: 3000 }, end: { x: 700, y: 100, z: 3000 } },
    ];
    data.openings = [];
    data.annotations = [];
    data.dimensions = [];
    data.constructionLines = [];
    data.groups = [];
    useProjectStore.getState().loadProject(data);
    useEditorStore.setState({
      activeStory: '1F',
      activeTool: 'select',
      selectedIds: [],
      snapEnabled: false,
      pan: { x: 0, y: 500 },
      zoom: 1,
      layerVisibility: Object.fromEntries(LAYER_NAMES.map((name) => [name, true])) as Record<typeof LAYER_NAMES[number], boolean>,
      layerLocked: Object.fromEntries(LAYER_NAMES.map((name) => [name, false])) as Record<typeof LAYER_NAMES[number], boolean>,
    });
  });

  it('preserves a rectangle selection after the trailing browser click', () => {
    const { svg } = setupCanvas();
    drag(svg);
    expect(useEditorStore.getState().selectedIds).toEqual(['inside']);
  });

  it.each(['shiftKey', 'ctrlKey', 'metaKey'] as const)(
    'adds rectangle hits to the existing selection with %s',
    (modifier) => {
      useEditorStore.getState().setSelectedIds(['outside']);
      const { svg } = setupCanvas();
      drag(svg, { [modifier]: true });
      expect(useEditorStore.getState().selectedIds).toEqual(['outside', 'inside']);
    },
  );

  it('keeps the selection when a modifier-click hits empty canvas', () => {
    useEditorStore.getState().setSelectedIds(['outside']);
    const { svg } = setupCanvas();
    fireEvent.mouseDown(svg, { button: 0, clientX: 50, clientY: 450, shiftKey: true });
    fireEvent.mouseUp(svg, { button: 0, clientX: 50, clientY: 450, shiftKey: true });
    fireEvent.click(svg, { clientX: 50, clientY: 450, shiftKey: true });
    expect(useEditorStore.getState().selectedIds).toEqual(['outside']);
  });

  it('finishes outside the SVG using the release position and permits the next click', () => {
    const { svg, getByTestId } = setupCanvas();
    fireEvent.mouseDown(svg, { button: 0, clientX: 50, clientY: 450 });
    // The release is deliberately newer than the last delivered mousemove.
    fireEvent.mouseMove(window, { clientX: 60, clientY: 440 });
    fireEvent.mouseUp(window, { button: 0, clientX: 250, clientY: 350 });
    expect(useEditorStore.getState().selectedIds).toEqual(['inside']);

    const outside = getByTestId('outside');
    fireEvent.mouseDown(outside, { button: 0, clientX: 600, clientY: 400 });
    fireEvent.mouseUp(outside, { button: 0, clientX: 600, clientY: 400 });
    fireEvent.click(outside, { clientX: 600, clientY: 400 });
    expect(useEditorStore.getState().selectedIds).toEqual(['outside']);
  });

  it('supports crossing selection while respecting locked and hidden layers', () => {
    const { svg } = setupCanvas();
    fireEvent.mouseDown(svg, { button: 0, clientX: 150, clientY: 450 });
    fireEvent.mouseUp(svg, { button: 0, clientX: 50, clientY: 350 });
    fireEvent.click(svg, { clientX: 50, clientY: 350 });
    expect(useEditorStore.getState().selectedIds).toEqual(['inside']);

    act(() => useEditorStore.getState().setLayerLocked('member-beam', true));
    drag(svg);
    expect(useEditorStore.getState().selectedIds).toEqual([]);
    act(() => {
      useEditorStore.getState().setLayerLocked('member-beam', false);
      useEditorStore.getState().toggleLayerVisibility('member-beam');
    });
    drag(svg);
    expect(useEditorStore.getState().selectedIds).toEqual([]);
  });

  it('treats a tiny screen movement as a click even when zoomed far out', () => {
    useEditorStore.setState({ zoom: 0.001, selectedIds: ['outside'] });
    const { svg } = setupCanvas();
    fireEvent.mouseDown(svg, { button: 0, clientX: 0, clientY: 500 });
    fireEvent.mouseUp(svg, { button: 0, clientX: 1, clientY: 499 });
    fireEvent.click(svg, { clientX: 1, clientY: 499 });
    expect(useEditorStore.getState().selectedIds).toEqual([]);
  });

  it('selects a small world-space rectangle when it is a clear drag on screen', () => {
    const data = useProjectStore.getState().data!;
    const beam = data.members[0];
    if (beam.type !== 'beam') throw new Error('Expected a beam fixture');
    useProjectStore.getState().loadProject({
      ...data,
      members: [{ ...beam, start: { x: 1, y: 1, z: 3000 }, end: { x: 2, y: 1, z: 3000 } }],
    });
    useEditorStore.setState({ zoom: 10, pan: { x: 0, y: 500 } });
    const { svg } = setupCanvas();
    fireEvent.mouseDown(svg, { button: 0, clientX: 0, clientY: 500 });
    fireEvent.mouseUp(svg, { button: 0, clientX: 30, clientY: 480 });
    fireEvent.click(svg, { clientX: 30, clientY: 480 });
    expect(useEditorStore.getState().selectedIds).toEqual(['inside']);
  });

  it('stops middle-button panning after release outside the canvas', () => {
    const { svg } = setupCanvas();
    fireEvent.mouseDown(svg, { button: 1, clientX: 20, clientY: 20 });
    fireEvent.mouseMove(window, { clientX: 40, clientY: 50 });
    fireEvent.mouseUp(window, { button: 1, clientX: 60, clientY: 70 });
    expect(useEditorStore.getState().pan).toEqual({ x: 40, y: 550 });
    fireEvent.mouseMove(svg, { clientX: 200, clientY: 200 });
    expect(useEditorStore.getState().pan).toEqual({ x: 40, y: 550 });
  });

  it('cancels an unfinished drag on window blur', () => {
    useEditorStore.getState().setSelectedIds(['outside']);
    const { svg } = setupCanvas();
    fireEvent.mouseDown(svg, { button: 0, clientX: 50, clientY: 450 });
    fireEvent.mouseMove(window, { clientX: 250, clientY: 350 });
    fireEvent.blur(window);
    fireEvent.mouseUp(window, { button: 0, clientX: 250, clientY: 350 });
    fireEvent.click(svg, { clientX: 250, clientY: 350 });
    expect(useEditorStore.getState().selectedIds).toEqual(['outside']);
  });

  it('cancels an unfinished rectangle when changing tools', () => {
    const { svg, getByTestId } = setupCanvas();
    fireEvent.mouseDown(svg, { button: 0, clientX: 50, clientY: 450 });
    fireEvent.mouseMove(window, { clientX: 250, clientY: 350 });
    act(() => useEditorStore.getState().setActiveTool('beam'));
    fireEvent.mouseUp(window, { button: 0, clientX: 250, clientY: 350 });
    fireEvent.click(svg, { clientX: 250, clientY: 350 });
    expect(useEditorStore.getState().selectedIds).toEqual([]);
    expect(getByTestId('drawing')).toHaveAttribute('data-point-count', '0');

    fireEvent.mouseDown(svg, { button: 0, clientX: 100, clientY: 300 });
    fireEvent.mouseUp(svg, { button: 0, clientX: 100, clientY: 300 });
    fireEvent.click(svg, { clientX: 100, clientY: 300 });
    expect(getByTestId('drawing')).toHaveAttribute('data-point-count', '1');
  });

  it('suppresses a cancelled gesture click when the active story changes', () => {
    const { svg, getByTestId } = setupCanvas();
    fireEvent.mouseDown(svg, { button: 0, clientX: 150, clientY: 400 });
    fireEvent.mouseMove(window, { clientX: 151, clientY: 399 });
    act(() => useEditorStore.getState().setActiveStory('2F'));
    fireEvent.mouseUp(window, { button: 0, clientX: 151, clientY: 399 });
    fireEvent.click(getByTestId('inside'), { clientX: 151, clientY: 399 });
    expect(useEditorStore.getState().selectedIds).toEqual([]);
  });
});
