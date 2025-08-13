import { Groq } from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || process.env.GROQ_KEY || 'default_key',
});

export interface CommandInterpretation {
  action: 'draw' | 'delete' | 'clear' | 'modify' | 'select' | 
          'create_task' | 'complete_task' | 'update_task' | 'filter_tasks' |
          'create_layout' | 'add_block' | 'arrange_layout' | 'modify_block';
  
  // Canvas shapes
  shapes?: Array<{
    type: 'rectangle' | 'circle' | 'line';
    x: number;
    y: number;
    width?: number;
    height?: number;
    radius?: number;
    x2?: number;
    y2?: number;
    color?: string;
  }>;
  
  // Task operations
  tasks?: Array<{
    id?: string;
    title: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high';
    category?: string;
    dueDate?: string;
    completed?: boolean;
  }>;
  
  // Layout operations  
  layout?: {
    name?: string;
    gridConfig: {
      columns: number;
      rows?: number;
      gap?: number;
    };
    blocks?: Array<{
      type: 'text' | 'image' | 'container' | 'widget';
      content: any;
      position: { col: number; row: number; colSpan?: number; rowSpan?: number };
      style?: any;
    }>;
  };
  
  // Filters and parameters
  filters?: {
    completed?: boolean;
    priority?: string;
    category?: string;
    dateRange?: { start: string; end: string };
  };
  
  message: string;
  error?: string;
  appType?: 'canvas' | 'tasks' | 'layout';
}

export class GroqService {
  private static instance: GroqService;

  public static getInstance(): GroqService {
    if (!GroqService.instance) {
      GroqService.instance = new GroqService();
    }
    return GroqService.instance;
  }

  async interpretCommand(command: string, context: any = {}, appType: 'canvas' | 'tasks' | 'layout' = 'canvas'): Promise<CommandInterpretation> {
    try {
      let systemPrompt = '';
      
      if (appType === 'canvas') {
        systemPrompt = `You are an AI assistant for a drawing canvas application. Your job is to interpret user commands and convert them into specific drawing actions.

Available actions:
- draw: Create new shapes (rectangle, circle, line)
- delete: Remove specific shapes or all shapes
- clear: Clear the entire canvas
- modify: Change properties of existing shapes
- select: Select shapes for further operations

Current canvas has ${context.shapes?.length || 0} shapes.

For drawing commands, provide coordinates and dimensions. Use a 800x600 canvas size as reference.
For colors, use hex format (#RRGGBB).

Respond with a JSON object containing:
{
  "action": "draw|delete|clear|modify|select",
  "shapes": [array of shape objects if applicable],
  "message": "human-readable response",
  "appType": "canvas"
}

Example shape objects:
- Rectangle: {"type": "rectangle", "x": 100, "y": 100, "width": 50, "height": 30, "color": "#FF0000"}
- Circle: {"type": "circle", "x": 200, "y": 150, "radius": 25, "color": "#00FF00"}
- Line: {"type": "line", "x": 50, "y": 50, "x2": 150, "y2": 100, "color": "#0000FF"}`;
      
      } else if (appType === 'tasks') {
        systemPrompt = `You are an AI assistant for a task management system. Your job is to interpret user commands and convert them into specific task operations.

Available actions:
- create_task: Create new tasks
- complete_task: Mark tasks as completed or incomplete
- update_task: Modify existing tasks
- filter_tasks: Show filtered views of tasks

Current state: ${context.tasks?.length || 0} tasks total.

For task commands, understand priorities (low, medium, high), categories, and due dates.
Parse dates in natural language (today, tomorrow, next week, specific dates).

Respond with a JSON object containing:
{
  "action": "create_task|complete_task|update_task|filter_tasks",
  "tasks": [array of task objects if applicable],
  "filters": {filter criteria if applicable},
  "message": "human-readable response",
  "appType": "tasks"
}

Example task objects:
- {"title": "Review design mockups", "priority": "high", "category": "design", "dueDate": "2024-08-20"}
- {"title": "Morning routine", "priority": "medium", "description": "Exercise and meditation"}`;
      
      } else if (appType === 'layout') {
        systemPrompt = `You are an AI assistant for a dynamic layout grid builder. Your job is to interpret user commands and convert them into specific layout operations.

Available actions:
- create_layout: Create new layouts with grid configurations
- add_block: Add blocks (text, image, container, widget) to layouts
- arrange_layout: Rearrange or modify layout structure
- modify_block: Change block properties or content

Current state: ${context.layouts?.length || 0} layouts available.

For layout commands, understand grid systems, responsive design, and common layout patterns.
Think in terms of columns, rows, and positioning.

Respond with a JSON object containing:
{
  "action": "create_layout|add_block|arrange_layout|modify_block",
  "layout": {layout configuration object},
  "message": "human-readable response",
  "appType": "layout"
}

Example layout objects:
- 2-column: {"gridConfig": {"columns": 2, "gap": 20}, "blocks": [...]}
- Dashboard: {"gridConfig": {"columns": 12, "rows": 8}, "blocks": [sidebar, main, widgets]}`;
      }

      const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: command }
        ],
        temperature: 0.3,
        max_tokens: 1500,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from AI model');
      }

      // Try to parse JSON response
      try {
        const parsed = JSON.parse(response);
        return {
          action: parsed.action,
          shapes: parsed.shapes || [],
          tasks: parsed.tasks || [],
          layout: parsed.layout || undefined,
          filters: parsed.filters || undefined,
          message: parsed.message || 'Command processed',
          appType: appType,
        };
      } catch (parseError) {
        // If JSON parsing fails, return a basic interpretation
        return {
          action: appType === 'canvas' ? 'draw' : appType === 'tasks' ? 'create_task' : 'create_layout',
          shapes: [],
          tasks: [],
          message: response,
          error: 'Could not parse command structure',
          appType: appType,
        };
      }
    } catch (error) {
      console.error('Groq API error:', error);
      return {
        action: appType === 'canvas' ? 'draw' : appType === 'tasks' ? 'create_task' : 'create_layout',
        shapes: [],
        tasks: [],
        message: 'Sorry, I could not process your command at the moment.',
        error: error instanceof Error ? error.message : 'Unknown error',
        appType: appType,
      };
    }
  }

  async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    try {
      const transcription = await groq.audio.transcriptions.create({
        file: new File([audioBuffer], 'audio.wav', { type: 'audio/wav' }),
        model: 'whisper-large-v3-turbo',
      });

      return transcription.text || '';
    } catch (error) {
      console.error('Whisper transcription error:', error);
      return '';
    }
  }
}

export const groqService = GroqService.getInstance();
