import { useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Shape } from '@/types/canvas';

interface DrawingCanvasProps {
  shapes: Shape[];
  mode: 'manual' | 'ai';
  onMouseDown: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseUp: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

export function DrawingCanvas({
  shapes,
  mode,
  onMouseDown,
  onMouseUp,
  canvasRef,
}: DrawingCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);


  // Function to render all shapes on the canvas
  const renderShapes = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Detect possible face circle (largest circle) for contextual curves
    let faceCircle: any | null = null;
    for (const s of shapes) {
      if (s.type === 'circle' && typeof s.radius === 'number') {
        if (!faceCircle || (s.radius || 0) > (faceCircle.radius || 0)) {
          faceCircle = s;
        }
      }
    }

    // Render each shape
    shapes.forEach((shape, index) => {
      try {
        // Enhanced shape validation with fallbacks
        if (!shape || typeof shape.x !== 'number' || typeof shape.y !== 'number') {
          return;
        }

        // Validate shape type with fallback
        if (!shape.type || !['rectangle', 'circle', 'line', 'triangle', 'star'].includes(shape.type)) {
          return;
        }

        // Set default color if missing
        const color = shape.color || '#000000';
        const strokeWidth = shape.strokeWidth || 2;

        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = strokeWidth;

        // Highlight selected shapes
        if (shape.selected) {
          ctx.strokeStyle = '#2563EB';
          ctx.lineWidth = strokeWidth + 2;
        }

        ctx.beginPath();

        switch (shape.type) {
          case 'rectangle':
            if (typeof shape.width === 'number' && typeof shape.height === 'number') {
              ctx.rect(shape.x, shape.y, shape.width, shape.height);
              ctx.stroke();
            }
            break;
          case 'circle':
            if (typeof shape.radius === 'number') {
              ctx.arc(shape.x, shape.y, shape.radius, 0, 2 * Math.PI);
              ctx.stroke();
            }
            break;
          case 'triangle':
            if (typeof shape.width === 'number' && typeof shape.height === 'number') {
              const x1 = shape.x;
              const y1 = shape.y + shape.height; // Bottom left
              const x2 = shape.x + shape.width / 2;
              const y2 = shape.y; // Top
              const x3 = shape.x + shape.width;
              const y3 = shape.y + shape.height; // Bottom right
              
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
              ctx.lineTo(x3, y3);
              ctx.lineTo(x1, y1);
              ctx.stroke();
            }
            break;
          case 'star':
            if (typeof shape.radius === 'number') {
              const centerX = shape.x;
              const centerY = shape.y;
              const outerRadius = shape.radius;
              const innerRadius = shape.radius * 0.4;
              const points = 5;
              
              ctx.moveTo(centerX + outerRadius, centerY);
              
              for (let i = 0; i < points * 2; i++) {
                const angle = (i * Math.PI) / points;
                const radius = i % 2 === 0 ? outerRadius : innerRadius;
                const x = centerX + radius * Math.cos(angle - Math.PI / 2);
                const y = centerY + radius * Math.sin(angle - Math.PI / 2);
                
                if (i === 0) {
                  ctx.moveTo(x, y);
                } else {
                  ctx.lineTo(x, y);
                }
              }
              ctx.closePath();
              ctx.stroke();
            }
            break;
          case 'line':
            if (typeof shape.x2 === 'number' && typeof shape.y2 === 'number') {
              // Handle curved lines if style is specified
              if (shape.style === 'curve') {
                const midX = (shape.x + shape.x2) / 2;
                const lineLength = Math.sqrt(Math.pow(shape.x2 - shape.x, 2) + Math.pow(shape.y2 - shape.y, 2));
                
                let curveHeight = Math.min(lineLength * 0.3, 30);
                if (faceCircle && typeof faceCircle.radius === 'number') {
                  curveHeight = Math.min(Math.max(faceCircle.radius * 0.15, 12), Math.max(30, lineLength * 0.35));
                }

                let midY;
                if (shape.y === shape.y2) {
                  if (faceCircle && typeof faceCircle.y === 'number') {
                    const isBelowCenter = shape.y >= faceCircle.y;
                    midY = isBelowCenter ? shape.y - curveHeight : shape.y + curveHeight;
                  } else {
                    const isLikelySmile = shape.y < 300;
                    midY = isLikelySmile ? shape.y - curveHeight : shape.y + curveHeight;
                  }
                } else {
                  const avgY = (shape.y + shape.y2) / 2;
                  const yDiff = shape.y2 - shape.y;
                  midY = yDiff > 0 ? avgY + curveHeight : avgY - curveHeight;
                }

                ctx.moveTo(shape.x, shape.y);
                ctx.quadraticCurveTo(midX, midY, shape.x2, shape.y2);
              } else {
                ctx.moveTo(shape.x, shape.y);
                ctx.lineTo(shape.x2, shape.y2);
              }
              ctx.stroke();
            }
            break;
        }
      } catch (error) {
        console.error(`Error rendering shape at index ${index}:`, error);
      }
    });
  }, [shapes, canvasRef]);

  // Use requestAnimationFrame for smooth rendering updates
  useEffect(() => {
    let animationFrameId: number;
    
    const animate = () => {
      renderShapes();
      // We don't strictly need a loop here since shapes are static until updated,
      // but if we add animations later, this structure is ready.
      // For now, we just render once per dependency change.
    };

    animationFrameId = requestAnimationFrame(animate);
    
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [renderShapes]);

  // Optimized resize handler
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      
      // Only update if dimensions actually changed
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
        // Force immediate re-render to prevent flickering
        renderShapes();
      }
    };

    // Initial size
    handleResize();

    // Use ResizeObserver for more robust container resizing detection
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [renderShapes, canvasRef]);

  const getCursor = () => {
    if (mode === 'ai') return 'default';
    return 'crosshair';
  };

  return (
    <div 
      ref={containerRef}
      className="h-full bg-white rounded-lg shadow-sm border border-gray-200 relative overflow-hidden"
      style={{
        backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)',
        backgroundSize: '20px 20px'
      }}
    >
      <canvas
        ref={canvasRef}
        className={cn("absolute inset-0 w-full h-full")}
        style={{ cursor: getCursor() }}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
      />
      
      {/* AI Feedback Overlay */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 pointer-events-none">
        <div 
          className={cn(
            "bg-emerald-500 text-white px-4 py-2 rounded-lg shadow-lg transition-all duration-300",
            mode === 'ai' ? "animate-pulse opacity-100" : "opacity-0"
          )}
        >
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span className="text-sm font-medium">AI Mode Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}
