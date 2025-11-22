import "dotenv/config";
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
    type: 'rectangle' | 'circle' | 'line' | 'triangle' | 'star';
    x: number;
    y: number;
    width?: number;
    height?: number;
    radius?: number;
    x2?: number;
    y2?: number;
    color?: string;
    strokeWidth?: number;
    style?: string; // For curved lines, etc.
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
        const shapeCount = context.shapesCount ?? context.shapes?.length ?? 0;
        const shapeSummary = context.shapesSummary ? `\nExisting shapes summary: ${context.shapesSummary}` : '';
        
        systemPrompt = `You are an AI assistant for a drawing canvas application. Your job is to interpret user commands and convert them into specific drawing actions.

Available actions:
- draw: Create new shapes (rectangle, circle, line, triangle, star)
- delete: Remove specific shapes or all shapes
- clear: Clear the entire canvas
- modify: Change properties of existing shapes
- select: Select shapes for further operations

For face commands (smile, sad, happy, etc.), if the canvas has existing shapes, use the "clear" action first, then use "draw" action separately.

Current canvas has ${shapeCount} shapes.${shapeSummary}

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
- Rectangle: {"type": "rectangle", "x": 100, "y": 100, "width": 50, "height": 30, "color": "#FF0000", "strokeWidth": 2}
- Circle: {"type": "circle", "x": 200, "y": 150, "radius": 25, "color": "#00FF00", "strokeWidth": 2}
- Line: {"type": "line", "x": 50, "y": 50, "x2": 150, "y2": 100, "color": "#0000FF", "strokeWidth": 2}
- Triangle: {"type": "triangle", "x": 100, "y": 100, "width": 60, "height": 60, "color": "#FF00FF", "strokeWidth": 2}
- Star: {"type": "star", "x": 300, "y": 200, "radius": 40, "color": "#FFD700", "strokeWidth": 2}

For complex drawings like faces, use multiple shapes with proper positioning:
- Face outline: Large circle
- Eyes: Two smaller circles positioned within the face
- Mouth: A curved line (use style: "curve" for smiles)
- Nose: A small rectangle or circle

For facial expressions, use these structures:

SMILEY FACE:
- Face: {"type": "circle", "x": 300, "y": 250, "radius": 80, "color": "#FFFFFF", "strokeWidth": 2}
- Left eye: {"type": "circle", "x": 270, "y": 220, "radius": 8, "color": "#000000", "strokeWidth": 2}
- Right eye: {"type": "circle", "x": 330, "y": 220, "radius": 8, "color": "#000000", "strokeWidth": 2}
- Smile: {"type": "line", "x": 250, "y": 280, "x2": 350, "y2": 280, "color": "#000000", "strokeWidth": 3, "style": "curve"}

SAD FACE:
- Face: {"type": "circle", "x": 300, "y": 250, "radius": 80, "color": "#FFFFFF", "strokeWidth": 2}
- Left eye: {"type": "circle", "x": 270, "y": 220, "radius": 8, "color": "#000000", "strokeWidth": 2}
- Right eye: {"type": "circle", "x": 330, "y": 220, "radius": 8, "color": "#000000", "strokeWidth": 2}
- Sad mouth: {"type": "line", "x": 250, "y": 320, "x2": 350, "y2": 320, "color": "#000000", "strokeWidth": 3, "style": "curve"}

NEUTRAL FACE:
- Face: {"type": "circle", "x": 300, "y": 250, "radius": 80, "color": "#FFFFFF", "strokeWidth": 2}
- Left eye: {"type": "circle", "x": 270, "y": 220, "radius": 8, "color": "#000000", "strokeWidth": 2}
- Right eye: {"type": "circle", "x": 330, "y": 220, "radius": 8, "color": "#000000", "strokeWidth": 2}
- Straight mouth: {"type": "line", "x": 250, "y": 300, "x2": 350, "y2": 300, "color": "#000000", "strokeWidth": 2}

IMPORTANT: For sad faces, the mouth curve should go DOWNWARD (higher y values). For happy faces, the mouth curve goes UPWARD (lower y values).

For stick figures:
- Head: {"type": "circle", "x": 300, "y": 100, "radius": 20, "color": "#000000", "strokeWidth": 2}
- Body: {"type": "line", "x": 300, "y": 120, "x2": 300, "y2": 200, "color": "#000000", "strokeWidth": 2}
- Arms: {"type": "line", "x": 250, "y": 150, "x2": 350, "y2": 150, "color": "#000000", "strokeWidth": 2}
- Legs: {"type": "line", "x": 300, "y": 200, "x2": 250, "y2": 250, "color": "#000000", "strokeWidth": 2} and {"type": "line", "x": 300, "y": 200, "x2": 350, "y2": 250, "color": "#000000", "strokeWidth": 2}

For houses:
- Main structure: {"type": "rectangle", "x": 200, "y": 200, "width": 200, "height": 150, "color": "#8B4513", "strokeWidth": 2}
- Roof: {"type": "triangle", "x": 200, "y": 200, "width": 200, "height": 80, "color": "#A0522D", "strokeWidth": 2}
- Door: {"type": "rectangle", "x": 280, "y": 280, "width": 40, "height": 70, "color": "#654321", "strokeWidth": 2}
- Windows: {"type": "rectangle", "x": 220, "y": 220, "width": 30, "height": 30, "color": "#87CEEB", "strokeWidth": 2}

For stars:
- 5-pointed star: {"type": "star", "x": 300, "y": 200, "radius": 40, "color": "#FFD700", "strokeWidth": 2}

IMPORTANT GUIDELINES:
1. Always position shapes logically so they don't overlap inappropriately
2. Use the full canvas space (800x600) and ensure proper spacing between related shapes
3. For faces, use "clear" action first if canvas has shapes, then "draw" action separately
4. Position eyes symmetrically within the face outline
5. For sad faces, the mouth should curve DOWNWARD (higher y values)
6. For happy faces, the mouth should curve UPWARD (lower y values)
7. Use appropriate colors: white for face outline, black for features
8. Ensure proper proportions: face should be larger than eyes, mouth should be appropriately sized
9. Always use single actions: "draw", "clear", or "delete" - never combine them
10. For curved lines, always include "style": "curve" property`;
      
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
        response_format: { type: "json_object" } // Force JSON output
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
        // Attempt to parse multiple JSON blocks or JSON within code fences/comments
        try {
          const sanitized = sanitizeAiResponse(response);
          const blocks = extractJsonBlocks(sanitized);

          if (blocks.length > 0) {
            // Merge actions and shapes in order
            const actions: string[] = [];
            const mergedShapes: any[] = [];
            let lastMessage = '';

            for (const block of blocks) {
              if (!block || typeof block !== 'object') continue;
              if (typeof block.action === 'string') actions.push(block.action);
              if (Array.isArray(block.shapes)) mergedShapes.push(...block.shapes);
              if (typeof block.message === 'string') lastMessage = block.message;
            }

            const action = actions.length > 0 ? actions.join('|') : (appType === 'canvas' ? 'draw' : 'create_task');

            return {
              action: action as any, // Allow compound actions like "clear|draw"
              shapes: mergedShapes,
              tasks: [],
              layout: undefined,
              filters: undefined,
              message: lastMessage || 'Command processed',
              appType,
            };
          }

          // Last resort: try to find first JSON object and parse it
          const first = findFirstJsonObject(sanitized);
          if (first) {
            const block = JSON.parse(first);
            return {
              action: block.action || (appType === 'canvas' ? 'draw' : 'create_task'),
              shapes: block.shapes || [],
              tasks: block.tasks || [],
              layout: block.layout || undefined,
              filters: block.filters || undefined,
              message: block.message || 'Command processed',
              appType,
            };
          }

          // Could not extract JSON blocks
          throw new Error('No JSON blocks found');
        } catch (e) {
          console.error('JSON parsing failed:', e);
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
        file: new File([new Uint8Array(audioBuffer)], 'audio.wav', { type: 'audio/wav' }),
        model: 'whisper-large-v3-turbo',
      });

      return transcription.text || '';
    } catch (error) {
      console.error('Whisper transcription error:', error);
      return '';
    }
  }
}

// --- Helper functions to robustly parse AI responses that may contain multiple JSON blocks,
// code fences, and comments.

function sanitizeAiResponse(text: string): string {
  // Remove triple backtick code fences and language hints
  let cleaned = text.replace(/```[a-zA-Z]*\n?/g, '');
  cleaned = cleaned.replace(/```/g, '');
  // Remove single-line comments // ...
  cleaned = cleaned.replace(/(^|\n)\s*\/\/.*(?=\n|$)/g, '$1');
  // Remove trailing commas before closing braces/brackets (best effort)
  cleaned = cleaned.replace(/,\s*(\]|\})/g, '$1');
  return cleaned.trim();
}

function extractJsonBlocks(text: string): any[] {
  const blocks: any[] = [];
  let i = 0;
  while (i < text.length) {
    // Find next opening brace
    const start = text.indexOf('{', i);
    if (start === -1) break;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let j = start; j < text.length; j++) {
      const ch = text[j];
      if (inString) {
        if (escape) {
          escape = false;
        } else if (ch === '\\') {
          escape = true;
        } else if (ch === '"') {
          inString = false;
        }
      } else {
        if (ch === '"') inString = true;
        else if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            const candidate = text.slice(start, j + 1);
            try {
              const obj = JSON.parse(candidate);
              blocks.push(obj);
              i = j + 1;
              break;
            } catch {
              // Not a valid JSON block; continue scanning
            }
          }
        }
      }
      if (j === text.length - 1) {
        i = j + 1;
      }
    }
    if (depth !== 0) break; // unbalanced braces
  }
  return blocks;
}

function findFirstJsonObject(text: string): string | null {
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf('{', i);
    if (start === -1) return null;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let j = start; j < text.length; j++) {
      const ch = text[j];
      if (inString) {
        if (escape) {
          escape = false;
        } else if (ch === '\\') {
          escape = true;
        } else if (ch === '"') {
          inString = false;
        }
      } else {
        if (ch === '"') inString = true;
        else if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            return text.slice(start, j + 1);
          }
        }
      }
    }
    i = start + 1;
  }
  return null;
}

export const groqService = GroqService.getInstance();
