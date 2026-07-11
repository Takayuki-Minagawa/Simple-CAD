import { useRef, useCallback, useEffect, type ReactNode } from 'react';
import { useEditorStore } from '@/app/store';
import { screenToWorld } from '@/domain/geometry/transform';
import { useShallow } from 'zustand/react/shallow';

interface Props {
  children: ReactNode;
  onWorldClick?: (worldPos: { x: number; y: number }, e: React.MouseEvent) => void;
  onWorldMouseMove?: (worldPos: { x: number; y: number }, e: React.MouseEvent) => void;
  onWorldMouseDown?: (worldPos: { x: number; y: number }, e: React.MouseEvent) => void;
  onWorldMouseUp?: (worldPos: { x: number; y: number }, e: React.MouseEvent) => void;
  onWorldDoubleClick?: (worldPos: { x: number; y: number }) => void;
}

export function SvgCanvas({
  children,
  onWorldClick,
  onWorldMouseMove,
  onWorldMouseDown,
  onWorldMouseUp,
  onWorldDoubleClick,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { pan, zoom, setPan, setZoom, setCursorWorld, activeTool } = useEditorStore(
    useShallow((state) => ({
      pan: state.pan,
      zoom: state.zoom,
      setPan: state.setPan,
      setZoom: state.setZoom,
      setCursorWorld: state.setCursorWorld,
      activeTool: state.activeTool,
    })),
  );
  const isPanningRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const pointerFrameRef = useRef<number | null>(null);
  const pendingPointerRef = useRef<{
    world: { x: number; y: number };
    event: React.MouseEvent;
  } | null>(null);

  const getWorldPos = useCallback(
    (e: React.MouseEvent) => {
      const rect = svgRef.current!.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      return screenToWorld({ x: sx, y: sy }, pan, zoom);
    },
    [pan, zoom],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.001, Math.min(10, zoom * factor));

      const rect = svgRef.current!.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      const newPanX = cx - (cx - pan.x) * (newZoom / zoom);
      const newPanY = cy - (cy - pan.y) * (newZoom / zoom);

      setPan({ x: newPanX, y: newPanY });
      setZoom(newZoom);
    },
    [pan, zoom, setPan, setZoom],
  );

  const flushPointerMove = useCallback(() => {
    pointerFrameRef.current = null;
    const pending = pendingPointerRef.current;
    pendingPointerRef.current = null;
    if (!pending) return;
    setCursorWorld(pending.world);
    onWorldMouseMove?.(pending.world, pending.event);
  }, [onWorldMouseMove, setCursorWorld]);

  useEffect(
    () => () => {
      if (pointerFrameRef.current != null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(pointerFrameRef.current);
      }
    },
    [],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Middle button or pan tool
      if (e.button === 1 || (e.button === 0 && activeTool === 'pan')) {
        isPanningRef.current = true;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
        e.preventDefault();
        return;
      }
      if (e.button === 0 && onWorldMouseDown) {
        onWorldMouseDown(getWorldPos(e), e);
      }
    },
    [activeTool, getWorldPos, onWorldMouseDown],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanningRef.current) {
        const dx = e.clientX - lastMouseRef.current.x;
        const dy = e.clientY - lastMouseRef.current.y;
        setPan({ x: pan.x + dx, y: pan.y + dy });
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
        return;
      }
      const world = getWorldPos(e);
      pendingPointerRef.current = { world, event: e };
      if (pointerFrameRef.current == null) {
        if (typeof requestAnimationFrame === 'function') {
          pointerFrameRef.current = requestAnimationFrame(flushPointerMove);
        } else {
          flushPointerMove();
        }
      }
    },
    [flushPointerMove, getWorldPos, pan, setPan],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      flushPointerMove();
      if (isPanningRef.current) {
        isPanningRef.current = false;
        return;
      }
      if (e.button === 0 && onWorldMouseUp) {
        onWorldMouseUp(getWorldPos(e), e);
      }
    },
    [flushPointerMove, getWorldPos, onWorldMouseUp],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool === 'pan') return;
      onWorldClick?.(getWorldPos(e), e);
    },
    [activeTool, getWorldPos, onWorldClick],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      onWorldDoubleClick?.(getWorldPos(e));
    },
    [getWorldPos, onWorldDoubleClick],
  );

  return (
    <svg
      ref={svgRef}
      style={{
        width: '100%',
        height: '100%',
        cursor: activeTool === 'pan' ? 'grab' : 'crosshair',
      }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={(e) => e.preventDefault()}
    >
      <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom}, ${-zoom})`}>
        {children}
      </g>
    </svg>
  );
}
