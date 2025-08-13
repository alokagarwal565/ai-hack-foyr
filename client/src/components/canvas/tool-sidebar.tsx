import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  MousePointer2, 
  Square, 
  Circle, 
  Minus, 
  Trash2, 
  RotateCcw,
  Brain,
  Edit
} from "lucide-react";

interface ToolSidebarProps {
  mode: 'manual' | 'ai';
  selectedTool: 'select' | 'rectangle' | 'circle' | 'line';
  selectedColor: string;
  onModeChange: (mode: 'manual' | 'ai') => void;
  onToolChange: (tool: 'select' | 'rectangle' | 'circle' | 'line') => void;
  onColorChange: (color: string) => void;
  onDeleteSelected: () => void;
  onClearCanvas: () => void;
}

const colors = [
  '#000000', '#EF4444', '#3B82F6', '#10B981', 
  '#F59E0B', '#8B5CF6', '#EC4899', '#6B7280'
];

export function ToolSidebar({
  mode,
  selectedTool,
  selectedColor,
  onModeChange,
  onToolChange,
  onColorChange,
  onDeleteSelected,
  onClearCanvas,
}: ToolSidebarProps) {
  return (
    <div className="w-16 bg-white border-r border-gray-200 flex flex-col items-center py-4 space-y-3">
      {/* Mode Toggle */}
      <div className="mb-4">
        <div className="bg-gray-100 rounded-lg p-1 flex flex-col space-y-1">
          <Button
            size="sm"
            variant={mode === 'manual' ? 'default' : 'ghost'}
            className={cn(
              "w-12 h-8 p-0",
              mode === 'manual' && "bg-blue-500 text-white hover:bg-blue-600"
            )}
            onClick={() => onModeChange('manual')}
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant={mode === 'ai' ? 'default' : 'ghost'}
            className={cn(
              "w-12 h-8 p-0",
              mode === 'ai' && "bg-emerald-500 text-white hover:bg-emerald-600"
            )}
            onClick={() => onModeChange('ai')}
          >
            <Brain className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Drawing Tools */}
      <div className="space-y-2">
        <Button
          size="sm"
          variant={selectedTool === 'select' ? 'default' : 'ghost'}
          className={cn(
            "w-12 h-12 p-0",
            selectedTool === 'select' && "bg-blue-500 text-white hover:bg-blue-600"
          )}
          onClick={() => onToolChange('select')}
          title="Select Tool"
        >
          <MousePointer2 className="w-5 h-5" />
        </Button>
        
        <Button
          size="sm"
          variant={selectedTool === 'rectangle' ? 'default' : 'ghost'}
          className={cn(
            "w-12 h-12 p-0",
            selectedTool === 'rectangle' && "bg-blue-500 text-white hover:bg-blue-600"
          )}
          onClick={() => onToolChange('rectangle')}
          title="Rectangle Tool"
        >
          <Square className="w-5 h-5" />
        </Button>
        
        <Button
          size="sm"
          variant={selectedTool === 'circle' ? 'default' : 'ghost'}
          className={cn(
            "w-12 h-12 p-0",
            selectedTool === 'circle' && "bg-blue-500 text-white hover:bg-blue-600"
          )}
          onClick={() => onToolChange('circle')}
          title="Circle Tool"
        >
          <Circle className="w-5 h-5" />
        </Button>
        
        <Button
          size="sm"
          variant={selectedTool === 'line' ? 'default' : 'ghost'}
          className={cn(
            "w-12 h-12 p-0",
            selectedTool === 'line' && "bg-blue-500 text-white hover:bg-blue-600"
          )}
          onClick={() => onToolChange('line')}
          title="Line Tool"
        >
          <Minus className="w-5 h-5" />
        </Button>
        
        <div className="w-full h-px bg-gray-200 my-2"></div>
        
        <Button
          size="sm"
          variant="ghost"
          className="w-12 h-12 p-0 hover:bg-red-100 hover:text-red-600"
          onClick={onDeleteSelected}
          title="Delete Selected"
        >
          <Trash2 className="w-5 h-5" />
        </Button>
        
        <Button
          size="sm"
          variant="ghost"
          className="w-12 h-12 p-0"
          onClick={onClearCanvas}
          title="Clear Canvas"
        >
          <RotateCcw className="w-5 h-5" />
        </Button>
      </div>
      
      {/* Color Palette */}
      <div className="mt-4 space-y-2">
        <div className="text-xs text-gray-500 text-center">Colors</div>
        <div className="flex flex-col space-y-1">
          {colors.map((color) => (
            <button
              key={color}
              className={cn(
                "w-8 h-8 rounded border-2 transition-all",
                selectedColor === color 
                  ? "border-blue-500 scale-110" 
                  : "border-gray-200 hover:border-gray-300"
              )}
              style={{ backgroundColor: color }}
              onClick={() => onColorChange(color)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
