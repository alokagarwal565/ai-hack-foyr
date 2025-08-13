import { Groq } from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || process.env.GROQ_KEY || 'default_key',
});

export interface CommandInterpretation {
  action: 'draw' | 'delete' | 'clear' | 'modify' | 'select';
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
  message: string;
  error?: string;
}

export class GroqService {
  private static instance: GroqService;

  public static getInstance(): GroqService {
    if (!GroqService.instance) {
      GroqService.instance = new GroqService();
    }
    return GroqService.instance;
  }

  async interpretCommand(command: string, currentShapes: any[] = []): Promise<CommandInterpretation> {
    try {
      const systemPrompt = `You are an AI assistant for a drawing canvas application. Your job is to interpret user commands and convert them into specific drawing actions.

Available actions:
- draw: Create new shapes (rectangle, circle, line)
- delete: Remove specific shapes or all shapes
- clear: Clear the entire canvas
- modify: Change properties of existing shapes
- select: Select shapes for further operations

Current canvas has ${currentShapes.length} shapes.

For drawing commands, provide coordinates and dimensions. Use a 800x600 canvas size as reference.
For colors, use hex format (#RRGGBB).

Respond with a JSON object containing:
{
  "action": "draw|delete|clear|modify|select",
  "shapes": [array of shape objects if applicable],
  "message": "human-readable response"
}

Example shape objects:
- Rectangle: {"type": "rectangle", "x": 100, "y": 100, "width": 50, "height": 30, "color": "#FF0000"}
- Circle: {"type": "circle", "x": 200, "y": 150, "radius": 25, "color": "#00FF00"}
- Line: {"type": "line", "x": 50, "y": 50, "x2": 150, "y2": 100, "color": "#0000FF"}`;

      const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: command }
        ],
        temperature: 0.3,
        max_tokens: 1000,
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
          message: parsed.message || 'Command processed',
        };
      } catch (parseError) {
        // If JSON parsing fails, return a basic interpretation
        return {
          action: 'draw',
          shapes: [],
          message: response,
          error: 'Could not parse command structure',
        };
      }
    } catch (error) {
      console.error('Groq API error:', error);
      return {
        action: 'draw',
        shapes: [],
        message: 'Sorry, I could not process your command at the moment.',
        error: error instanceof Error ? error.message : 'Unknown error',
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
