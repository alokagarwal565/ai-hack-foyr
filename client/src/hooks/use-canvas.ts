import { useState, useCallback, useRef, useEffect } from 'react';
import { Shape, CanvasState } from '@/types/canvas';
import { apiRequest } from '@/lib/queryClient';

export function useCanvas() {
  const [canvasState, setCanvasState] = useState<CanvasState>({
    shapes: [],
    mode: 'manual',
    selectedTool: 'select',
    selectedColor: '#000000',
  });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });

  const drawShapes = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all shapes
    canvasState.shapes.forEach((shape) => {
      ctx.strokeStyle = shape.color;
      ctx.fillStyle = shape.color;
      ctx.lineWidth = shape.strokeWidth;

      if (shape.selected) {
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = shape.strokeWidth + 2;
      }

      ctx.beginPath();

      switch (shape.type) {
        case 'rectangle':
          if (shape.width && shape.height) {
            ctx.rect(shape.x, shape.y, shape.width, shape.height);
            ctx.stroke();
          }
          break;
        case 'circle':
          if (shape.radius) {
            ctx.arc(shape.x, shape.y, shape.radius, 0, 2 * Math.PI);
            ctx.stroke();
          }
          break;
        case 'line':
          if (shape.x2 !== undefined && shape.y2 !== undefined) {
            ctx.moveTo(shape.x, shape.y);
            ctx.lineTo(shape.x2, shape.y2);
            ctx.stroke();
          }
          break;
      }
    });
  }, [canvasState.shapes]);

  useEffect(() => {
    drawShapes();
  }, [drawShapes]);

  const setMode = useCallback((mode: 'manual' | 'ai') => {
    setCanvasState(prev => ({ ...prev, mode }));
  }, []);

  const setSelectedTool = useCallback((tool: 'select' | 'rectangle' | 'circle' | 'line') => {
    setCanvasState(prev => ({ ...prev, selectedTool: tool }));
  }, []);

  const setSelectedColor = useCallback((color: string) => {
    setCanvasState(prev => ({ ...prev, selectedColor: color }));
  }, []);

  const setShapes = useCallback((shapes: Shape[]) => {
    setCanvasState(prev => ({ ...prev, shapes }));
  }, []);

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || canvasState.mode === 'ai') return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    setStartPoint({ x, y });
    setIsDrawing(true);

    if (canvasState.selectedTool === 'select') {
      // Select shape at this position
      const clickedShape = findShapeAtPoint(x, y);
      if (clickedShape) {
        selectShape(clickedShape.id);
      } else {
        clearSelection();
      }
    }
  }, [canvasState.mode, canvasState.selectedTool, canvasState.shapes]);

  const handleMouseUp = useCallback(async (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || canvasState.mode === 'ai') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (canvasState.selectedTool !== 'select') {
      const newShape = createShape(startPoint, { x, y });
      if (newShape) {
        try {
          await apiRequest('POST', '/api/shapes', newShape);
        } catch (error) {
          console.error('Failed to create shape:', error);
        }
      }
    }

    setIsDrawing(false);
  }, [isDrawing, canvasState.mode, canvasState.selectedTool, canvasState.selectedColor, startPoint]);

  const createShape = useCallback((start: { x: number; y: number }, end: { x: number; y: number }): Partial<Shape> | null => {
    const { selectedTool, selectedColor } = canvasState;

    switch (selectedTool) {
      case 'rectangle':
        const width = Math.abs(end.x - start.x);
        const height = Math.abs(end.y - start.y);
        if (width < 5 || height < 5) return null; // Too small
        
        return {
          type: 'rectangle',
          x: Math.min(start.x, end.x),
          y: Math.min(start.y, end.y),
          width,
          height,
          color: selectedColor,
          strokeWidth: 2,
        };

      case 'circle':
        const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
        if (radius < 5) return null; // Too small
        
        return {
          type: 'circle',
          x: start.x,
          y: start.y,
          radius,
          color: selectedColor,
          strokeWidth: 2,
        };

      case 'line':
        const distance = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
        if (distance < 5) return null; // Too small
        
        return {
          type: 'line',
          x: start.x,
          y: start.y,
          x2: end.x,
          y2: end.y,
          color: selectedColor,
          strokeWidth: 2,
        };

      default:
        return null;
    }
  }, [canvasState.selectedTool, canvasState.selectedColor]);

  const findShapeAtPoint = useCallback((x: number, y: number): Shape | null => {
    // Check shapes in reverse order (top to bottom)
    for (let i = canvasState.shapes.length - 1; i >= 0; i--) {
      const shape = canvasState.shapes[i];
      
      switch (shape.type) {
        case 'rectangle':
          if (shape.width && shape.height &&
              x >= shape.x && x <= shape.x + shape.width &&
              y >= shape.y && y <= shape.y + shape.height) {
            return shape;
          }
          break;
        case 'circle':
          if (shape.radius) {
            const distance = Math.sqrt(Math.pow(x - shape.x, 2) + Math.pow(y - shape.y, 2));
            if (distance <= shape.radius) {
              return shape;
            }
          }
          break;
        case 'line':
          if (shape.x2 !== undefined && shape.y2 !== undefined) {
            // Simple line hit detection (within 5px of line)
            const distance = distanceToLine(x, y, shape.x, shape.y, shape.x2, shape.y2);
            if (distance <= 5) {
              return shape;
            }
          }
          break;
      }
    }
    
    return null;
  }, [canvasState.shapes]);

  const distanceToLine = (px: number, py: number, x1: number, y1: number, x2: number, y2: number): number => {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const selectShape = useCallback((shapeId: string) => {
    setCanvasState(prev => ({
      ...prev,
      shapes: prev.shapes.map(shape => ({
        ...shape,
        selected: shape.id === shapeId
      })),
      selectedShapeId: shapeId,
    }));
  }, []);

  const clearSelection = useCallback(() => {
    setCanvasState(prev => ({
      ...prev,
      shapes: prev.shapes.map(shape => ({ ...shape, selected: false })),
      selectedShapeId: undefined,
    }));
  }, []);

  const deleteSelected = useCallback(async () => {
    if (canvasState.selectedShapeId) {
      try {
        await apiRequest('DELETE', `/api/shapes/${canvasState.selectedShapeId}`);
      } catch (error) {
        console.error('Failed to delete shape:', error);
      }
    }
  }, [canvasState.selectedShapeId]);

  const clearCanvas = useCallback(async () => {
    try {
      await apiRequest('DELETE', '/api/shapes');
    } catch (error) {
      console.error('Failed to clear canvas:', error);
    }
  }, []);

  return {
    canvasRef,
    canvasState,
    setMode,
    setSelectedTool,
    setSelectedColor,
    setShapes,
    handleMouseDown,
    handleMouseUp,
    deleteSelected,
    clearCanvas,
  };
}
