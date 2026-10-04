import { useRef, useCallback, useEffect, type ReactNode } from 'react';
import { useEditorStore } from '@/app/store';
import { screenToWorld } from '@/domain/geometry/transform';
import { useShallow } from 'zustand/react/shallow';
import { isCanvasDrag, type CanvasMouseEvent } from './canvasGesture';

interface Props {
  children: ReactNode;
  onWorldClick?: (worldPos: { x: number; y: number }, e: CanvasMouseEvent) => void;
  onWorldMouseMove?: (worldPos: { x: number; y: number }, e: CanvasMouseEvent) => void;
  onWorldMouseDown?: (worldPos: { x: number; y: number }, e: CanvasMouseEvent) => void;
  onWorldMouseUp?: (worldPos: { x: number; y: number }, e: CanvasMouseEvent) => void;
  onWorldDoubleClick?: (worldPos: { x: number; y: number }) => void;
  onWorldCancel?: () => void;
}

export function SvgCanvas({
  children,
  onWorldClick,
  onWorldMouseMove,
  onWorldMouseDown,
  onWorldMouseUp,
  onWorldDoubleClick,
  onWorldCancel,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { pan, zoom, setPan, setZoom, setCursorWorld, activeTool, activeStory } = useEditorStore(
    useShallow((state) => ({
      pan: state.pan,
      zoom: state.zoom,
      setPan: state.setPan,
      setZoom: state.setZoom,
      setCursorWorld: state.setCursorWorld,
      activeTool: state.activeTool,
      activeStory: state.activeStory,
    })),
  );
  const gestureRef = useRef<{
    button: number;
    panning: boolean;
    start: { x: number; y: number };
    last: { x: number; y: number };
    dragged: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const pointerFrameRef = useRef<number | null>(null);
  const pendingPointerRef = useRef<{
    world: { x: number; y: number };
    event: CanvasMouseEvent;
  } | null>(null);

  const getWorldPos = useCallback(
    (e: CanvasMouseEvent) => {
      const rect = svgRef.current!.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const editor = useEditorStore.getState();
      return screenToWorld({ x: sx, y: sy }, editor.pan, editor.zoom);
    },
    [],
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
    if (pointerFrameRef.current != null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(pointerFrameRef.current);
    }
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

  const cancelGesture = useCallback(() => {
    if (gestureRef.current) suppressClickRef.current = true;
    gestureRef.current = null;
    pendingPointerRef.current = null;
    flushPointerMove();
    onWorldCancel?.();
  }, [flushPointerMove, onWorldCancel]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0 && e.button !== 1) return;
      suppressClickRef.current = false;
      const position = { x: e.clientX, y: e.clientY };
      const panning = e.button === 1 || activeTool === 'pan';
      gestureRef.current = {
        button: e.button,
        panning,
        start: position,
        last: position,
        dragged: false,
      };
      // Middle button or pan tool
      if (panning) {
        e.preventDefault();
        return;
      }
      if (e.button === 0 && onWorldMouseDown) {
        onWorldMouseDown(getWorldPos(e), e);
      }
    },
    [activeTool, getWorldPos, onWorldMouseDown],
  );

  const trackPointerMove = useCallback(
    (e: CanvasMouseEvent) => {
      const gesture = gestureRef.current;
      const position = { x: e.clientX, y: e.clientY };
      if (gesture) {
        gesture.dragged ||= isCanvasDrag(gesture.start, position);
      }
      if (gesture?.panning) {
        const currentPan = useEditorStore.getState().pan;
        setPan({
          x: currentPan.x + position.x - gesture.last.x,
          y: currentPan.y + position.y - gesture.last.y,
        });
        gesture.last = position;
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
    [flushPointerMove, getWorldPos, setPan],
  );

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      if (gestureRef.current) trackPointerMove(event);
    };
    const handleUp = (event: MouseEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.button !== event.button) return;
      trackPointerMove(event);
      flushPointerMove();
      gestureRef.current = null;
      suppressClickRef.current = gesture.dragged || gesture.panning;
      if (!gesture.panning) onWorldMouseUp?.(getWorldPos(event), event);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('blur', cancelGesture);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('blur', cancelGesture);
    };
  }, [cancelGesture, flushPointerMove, getWorldPos, onWorldMouseUp, trackPointerMove]);

  useEffect(() => {
    cancelGesture();
  }, [activeTool, activeStory, cancelGesture]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool === 'pan' || suppressClickRef.current) {
        return;
      }
      onWorldClick?.(getWorldPos(e), e);
    },
    [activeTool, getWorldPos, onWorldClick],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool === 'pan' || suppressClickRef.current) return;
      onWorldDoubleClick?.(getWorldPos(e));
    },
    [activeTool, getWorldPos, onWorldDoubleClick],
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
      onMouseMove={(event) => {
        // Active drags are handled once by the window listener, including outside the SVG.
        if (!gestureRef.current) trackPointerMove(event);
      }}
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
