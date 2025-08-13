export interface Shape {
  id: string;
  type: 'rectangle' | 'circle' | 'line';
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  x2?: number;
  y2?: number;
  color: string;
  strokeWidth: number;
  selected?: boolean;
}

export interface CanvasState {
  shapes: Shape[];
  mode: 'manual' | 'ai';
  selectedTool: 'select' | 'rectangle' | 'circle' | 'line';
  selectedColor: string;
  selectedShapeId?: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}
