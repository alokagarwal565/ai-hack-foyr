import { useEffect, useRef } from 'react';
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

  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [canvasRef]);

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
