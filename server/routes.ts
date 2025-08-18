import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { 
  insertShapeSchema, 
  insertCanvasStateSchema, 
  insertChatMessageSchema,
  insertTaskSchema,
  insertTaskListSchema,
  insertLayoutSchema,
  insertBlockSchema,
  insertAppStateSchema
} from "@shared/schema";
import { groqService } from "./services/groq";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // WebSocket server for real-time communication
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    console.log('Client connected to WebSocket');

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('WebSocket message received:', message.type, message);
        
        switch (message.type) {
          case 'chat_message':
            await handleChatMessage(ws, message.content, message.appType || 'canvas');
            break;
          case 'voice_data':
            await handleVoiceData(ws, message.data, message.appType || 'canvas');
            break;
          case 'get_state':
            await sendCanvasState(ws);
            break;
          default:
            console.warn('Unknown WebSocket message type:', message.type);
            ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        console.error('Raw message data:', data.toString());
        ws.send(JSON.stringify({ type: 'error', message: 'Failed to process message' }));
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected from WebSocket');
    });

    // Send initial state
    sendCanvasState(ws);
  });

  async function handleChatMessage(ws: WebSocket, content: string, appType: 'canvas' | 'tasks' | 'layout' = 'canvas') {
    console.log(`Processing chat message: "${content}" for app type: ${appType}`);
    
    // Save user message
    const userMessage = await storage.createChatMessage({
      content,
      sender: 'user',
      appType,
    });

    // Broadcast user message to all clients
    broadcast({ type: 'chat_message', message: userMessage });

    // Get current context based on app type
    let context = {};
    if (appType === 'canvas') {
      context = { shapes: await storage.getShapes() };
      console.log(`Current canvas context: ${context.shapes.length} shapes`);
    } else if (appType === 'tasks') {
      context = { tasks: await storage.getTasks() };
    } else if (appType === 'layout') {
      context = { layouts: await storage.getLayouts() };
    }
    
    // Interpret command with AI
    console.log('Sending command to AI for interpretation...');
    const interpretation = await groqService.interpretCommand(content, context, appType);
    console.log('AI interpretation received:', interpretation);
    
    // Execute the interpreted command
    console.log('Executing command...');
    await executeCommand(interpretation, appType, content);

    // Save AI response
    const aiMessage = await storage.createChatMessage({
      content: interpretation.message,
      sender: 'ai',
      appType,
    });

    // Broadcast AI message and updated state
    broadcast({ type: 'chat_message', message: aiMessage });
    broadcast({ type: 'command_executed', interpretation });
    
    // Send updated state based on app type
    if (appType === 'canvas') {
      const updatedShapes = await storage.getShapes();
      broadcast({ type: 'shapes_updated', shapes: updatedShapes });
    } else if (appType === 'tasks') {
      const updatedTasks = await storage.getTasks();
      broadcast({ type: 'tasks_updated', tasks: updatedTasks });
    } else if (appType === 'layout') {
      const updatedLayouts = await storage.getLayouts();
      broadcast({ type: 'layouts_updated', layouts: updatedLayouts });
    }
  }

  async function handleVoiceData(ws: WebSocket, audioData: string, appType: 'canvas' | 'tasks' | 'layout' = 'canvas') {
    try {
      // Convert base64 to buffer
      const audioBuffer = Buffer.from(audioData, 'base64');
      
      // Transcribe with Whisper
      const transcription = await groqService.transcribeAudio(audioBuffer);
      
      if (transcription) {
        // Process as chat message
        await handleChatMessage(ws, transcription, appType);
        ws.send(JSON.stringify({ type: 'voice_transcribed', text: transcription }));
      }
    } catch (error) {
      console.error('Voice processing error:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Failed to process voice input' }));
    }
  }

  async function executeCommand(interpretation: any, appType: 'canvas' | 'tasks' | 'layout' = 'canvas', originalCommand?: string) {
    try {
      if (appType === 'canvas') {
        // Handle compound actions like "clear|draw"
        let actions = interpretation.action.split('|');
        // Skip 'clear' unless explicitly requested in the user's command
        if (originalCommand) {
          const lc = String(originalCommand).toLowerCase();
          const explicitClear = lc.includes('clear') || lc.includes('delete all') || /\bdelete\b/.test(lc);
          if (!explicitClear) actions = actions.filter((a) => a.trim() !== 'clear');
        }
        
        for (const action of actions) {
          switch (action.trim()) {
            case 'draw':
              if (interpretation.shapes && Array.isArray(interpretation.shapes)) {
                console.log(`Processing ${interpretation.shapes.length} shapes for drawing command`);

                // 1) Standardize/Template if needed for common objects
                let workingShapes = interpretation.shapes as any[];
                if (originalCommand) {
                  const lower = originalCommand.toLowerCase();
                  const templated = maybeApplyTemplate(lower, workingShapes);
                  if (templated.applied) {
                    console.log(`Applied ${templated.templateName} template`);
                    workingShapes = templated.shapes;
                  }
                }

                // 2) Normalize (scale) into a canonical size first (center temporary)
                workingShapes = normalizeShapesToCanvas(workingShapes, { width: 800, height: 600, target: { w: 300, h: 300 }, center: { x: 400, y: 300 } });

                // 3) Smart positioning: place composite in a free spot (avoid overlapping existing shapes)
                // If no free spot is available, evict oldest shapes until it fits.
                const placed = await placeOrEvict(workingShapes, { width: 800, height: 600 });
                workingShapes = placed;
                
                for (let i = 0; i < workingShapes.length; i++) {
                  const shapeData = workingShapes[i];
                  
                  try {
                    // Validate shape data before creating
                    if (!shapeData.type || !['rectangle', 'circle', 'line', 'triangle', 'star'].includes(shapeData.type)) {
                      console.warn(`Skipping invalid shape at index ${i}: missing or invalid type`, shapeData);
                      continue;
                    }
                    
                    if (typeof shapeData.x !== 'number' || typeof shapeData.y !== 'number') {
                      console.warn(`Skipping invalid shape at index ${i}: missing or invalid coordinates`, shapeData);
                      continue;
                    }
                    
                    // Validate shape-specific properties
                    switch (shapeData.type) {
                      case 'rectangle':
                        if (typeof shapeData.width !== 'number' || typeof shapeData.height !== 'number') {
                          console.warn(`Skipping invalid rectangle at index ${i}: missing width/height`, shapeData);
                          continue;
                        }
                        break;
                      case 'circle':
                        if (typeof shapeData.radius !== 'number') {
                          console.warn(`Skipping invalid circle at index ${i}: missing radius`, shapeData);
                          continue;
                        }
                        break;
                      case 'triangle':
                        if (typeof shapeData.width !== 'number' || typeof shapeData.height !== 'number') {
                          console.warn(`Skipping invalid triangle at index ${i}: missing width/height`, shapeData);
                          continue;
                        }
                        break;
                      case 'star':
                        if (typeof shapeData.radius !== 'number') {
                          console.warn(`Skipping invalid star at index ${i}: missing radius`, shapeData);
                          continue;
                        }
                        break;
                      case 'line':
                        if (typeof shapeData.x2 !== 'number' || typeof shapeData.y2 !== 'number') {
                          console.warn(`Skipping invalid line at index ${i}: missing end coordinates`, shapeData);
                          continue;
                        }
                        break;
                    }
                    
                    // Set default values for missing properties
                    const validatedShapeData = {
                      ...shapeData,
                      color: shapeData.color || '#000000',
                      strokeWidth: shapeData.strokeWidth || 2,
                    };
                    
                    console.log(`Creating shape ${i + 1}/${workingShapes.length}:`, validatedShapeData);
                    await storage.createShape(validatedShapeData);
                    
                  } catch (shapeError) {
                    console.error(`Failed to create shape at index ${i}:`, shapeError);
                    console.error('Shape data:', shapeData);
                  }
                }
              } else {
                console.warn('No shapes array provided in draw command:', interpretation);
              }
              break;
            case 'clear':
              console.log('Clearing all shapes from canvas');
              await storage.clearShapes();
              break;
            case 'delete':
              console.log('Deleting all shapes from canvas');
              await storage.clearShapes();
              break;
            default:
              console.warn(`Unknown canvas action: ${action}`);
          }
        }

        // Update canvas state
        const shapes = await storage.getShapes();
        console.log(`Canvas state updated with ${shapes.length} shapes`);
        await storage.updateCanvasState({
          shapes: shapes as any,
          mode: 'ai',
          lastCommand: interpretation.message,
        });

      } else if (appType === 'tasks') {
        switch (interpretation.action) {
          case 'create_task':
            if (interpretation.tasks) {
              for (const taskData of interpretation.tasks) {
                await storage.createTask({
                  title: taskData.title,
                  description: taskData.description,
                  priority: taskData.priority || 'medium',
                  category: taskData.category,
                  dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
                  completed: taskData.completed || false,
                });
              }
            }
            break;
          case 'complete_task':
            if (interpretation.tasks) {
              for (const taskData of interpretation.tasks) {
                if (taskData.id) {
                  await storage.markTaskComplete(taskData.id, taskData.completed || true);
                }
              }
            }
            break;
          case 'update_task':
            if (interpretation.tasks) {
              for (const taskData of interpretation.tasks) {
                if (taskData.id) {
                  await storage.updateTask(taskData.id, taskData);
                }
              }
            }
            break;
        }

        // Update app state for tasks
        const tasks = await storage.getTasks();
        await storage.updateAppState('tasks', {
          appType: 'tasks',
          state: { tasks },
          mode: 'ai',
          lastCommand: interpretation.message,
        });

      } else if (appType === 'layout') {
        switch (interpretation.action) {
          case 'create_layout':
            if (interpretation.layout) {
              const newLayout = await storage.createLayout({
                name: interpretation.layout.name || 'AI Generated Layout',
                gridConfig: interpretation.layout.gridConfig,
                blocks: interpretation.layout.blocks || [],
              });
              // Broadcast layout creation
              broadcast({ type: 'layout_created', layout: newLayout });
            }
            break;
          case 'add_block':
            if (interpretation.layout && interpretation.layout.blocks) {
              for (const blockData of interpretation.layout.blocks) {
                // Find a layout to add blocks to (use first available or create one)
                const layouts = await storage.getLayouts();
                const targetLayout = layouts[0];
                
                if (targetLayout) {
                  const newBlock = await storage.createBlock({
                    type: blockData.type,
                    content: blockData.content,
                    position: blockData.position,
                    style: blockData.style || {},
                    layoutId: targetLayout.id,
                  });
                  // Broadcast block creation
                  broadcast({ type: 'block_created', block: newBlock });
                }
              }
            }
            break;
        }

        // Update app state for layouts
        const layouts = await storage.getLayouts();
        await storage.updateAppState('layout', {
          appType: 'layout',
          state: { layouts },
          mode: 'ai',
          lastCommand: interpretation.message,
        });
      }
    } catch (error) {
      console.error(`Failed to execute ${appType} command:`, error);
    }
  }

  async function sendCanvasState(ws: WebSocket) {
    const shapes = await storage.getShapes();
    const canvasState = await storage.getCanvasState();
    const messages = await storage.getChatMessages(20);

    ws.send(JSON.stringify({
      type: 'initial_state',
      shapes,
      canvasState,
      messages,
    }));
  }

  function broadcast(data: any) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }

  // --- Utilities: shape normalization and templates ---
  function getShapeBounds(s: any): { minX: number; minY: number; maxX: number; maxY: number } | null {
    switch (s.type) {
      case 'circle':
        if (typeof s.x === 'number' && typeof s.y === 'number' && typeof s.radius === 'number') {
          return { minX: s.x - s.radius, minY: s.y - s.radius, maxX: s.x + s.radius, maxY: s.y + s.radius };
        }
        return null;
      case 'rectangle':
      case 'triangle':
        if (typeof s.x === 'number' && typeof s.y === 'number' && typeof s.width === 'number' && typeof s.height === 'number') {
          return { minX: s.x, minY: s.y, maxX: s.x + s.width, maxY: s.y + s.height };
        }
        return null;
      case 'star':
        if (typeof s.x === 'number' && typeof s.y === 'number' && typeof s.radius === 'number') {
          return { minX: s.x - s.radius, minY: s.y - s.radius, maxX: s.x + s.radius, maxY: s.y + s.radius };
        }
        return null;
      case 'line':
        if (typeof s.x === 'number' && typeof s.y === 'number' && typeof s.x2 === 'number' && typeof s.y2 === 'number') {
          return { minX: Math.min(s.x, s.x2), minY: Math.min(s.y, s.y2), maxX: Math.max(s.x, s.x2), maxY: Math.max(s.y, s.y2) };
        }
        return null;
      default:
        return null;
    }
  }
  function computeBounds(shapes: any[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
    if (!Array.isArray(shapes) || shapes.length === 0) return null;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const s of shapes) {
      switch (s.type) {
        case 'circle':
          if (typeof s.x === 'number' && typeof s.y === 'number' && typeof s.radius === 'number') {
            minX = Math.min(minX, s.x - s.radius);
            maxX = Math.max(maxX, s.x + s.radius);
            minY = Math.min(minY, s.y - s.radius);
            maxY = Math.max(maxY, s.y + s.radius);
          }
          break;
        case 'rectangle':
        case 'triangle':
          if (typeof s.x === 'number' && typeof s.y === 'number' && typeof s.width === 'number' && typeof s.height === 'number') {
            minX = Math.min(minX, s.x);
            maxX = Math.max(maxX, s.x + s.width);
            minY = Math.min(minY, s.y);
            maxY = Math.max(maxY, s.y + s.height);
          }
          break;
        case 'star':
          if (typeof s.x === 'number' && typeof s.y === 'number' && typeof s.radius === 'number') {
            minX = Math.min(minX, s.x - s.radius);
            maxX = Math.max(maxX, s.x + s.radius);
            minY = Math.min(minY, s.y - s.radius);
            maxY = Math.max(maxY, s.y + s.radius);
          }
          break;
        case 'line':
          if (typeof s.x === 'number' && typeof s.y === 'number' && typeof s.x2 === 'number' && typeof s.y2 === 'number') {
            minX = Math.min(minX, s.x, s.x2);
            maxX = Math.max(maxX, s.x, s.x2);
            minY = Math.min(minY, s.y, s.y2);
            maxY = Math.max(maxY, s.y, s.y2);
          }
          break;
      }
    }
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return null;
    return { minX, minY, maxX, maxY };
  }

  function normalizeShapesToCanvas(
    shapes: any[],
    opts: { width: number; height: number; target: { w: number; h: number }; center: { x: number; y: number } }
  ): any[] {
    const bounds = computeBounds(shapes);
    if (!bounds) return shapes;
    const bw = Math.max(1, bounds.maxX - bounds.minX);
    const bh = Math.max(1, bounds.maxY - bounds.minY);
    const scale = Math.min(opts.target.w / bw, opts.target.h / bh);
    const cx = bounds.minX + bw / 2;
    const cy = bounds.minY + bh / 2;
    const tx = opts.center.x;
    const ty = opts.center.y;

    return shapes.map((s) => {
      const copy = { ...s };
      const color = copy.color || '#000000';
      copy.color = color;
      copy.strokeWidth = copy.strokeWidth || 2;
      switch (copy.type) {
        case 'circle':
          if (typeof copy.x === 'number' && typeof copy.y === 'number') {
            copy.x = (copy.x - cx) * scale + tx;
            copy.y = (copy.y - cy) * scale + ty;
          }
          if (typeof copy.radius === 'number') copy.radius = Math.max(1, copy.radius * scale);
          break;
        case 'rectangle':
        case 'triangle':
          if (typeof copy.x === 'number' && typeof copy.y === 'number') {
            copy.x = (copy.x - cx) * scale + tx;
            copy.y = (copy.y - cy) * scale + ty;
          }
          if (typeof copy.width === 'number') copy.width = Math.max(1, copy.width * scale);
          if (typeof copy.height === 'number') copy.height = Math.max(1, copy.height * scale);
          break;
        case 'star':
          if (typeof copy.x === 'number' && typeof copy.y === 'number') {
            copy.x = (copy.x - cx) * scale + tx;
            copy.y = (copy.y - cy) * scale + ty;
          }
          if (typeof copy.radius === 'number') copy.radius = Math.max(1, copy.radius * scale);
          break;
        case 'line':
          if (typeof copy.x === 'number' && typeof copy.y === 'number') {
            copy.x = (copy.x - cx) * scale + tx;
            copy.y = (copy.y - cy) * scale + ty;
          }
          if (typeof copy.x2 === 'number' && typeof copy.y2 === 'number') {
            copy.x2 = (copy.x2 - cx) * scale + tx;
            copy.y2 = (copy.y2 - cy) * scale + ty;
          }
          break;
      }
      return copy;
    });
  }

  function translateComposite(shapes: any[], dx: number, dy: number): any[] {
    return shapes.map((s) => {
      const c = { ...s };
      if (typeof c.x === 'number') c.x += dx;
      if (typeof c.y === 'number') c.y += dy;
      if (typeof c.x2 === 'number') c.x2 += dx;
      if (typeof c.y2 === 'number') c.y2 += dy;
      return c;
    });
  }

  function rectsOverlap(a: {minX:number;minY:number;maxX:number;maxY:number}, b: {minX:number;minY:number;maxX:number;maxY:number}, margin = 10): boolean {
    return !(a.maxX + margin < b.minX || a.minX - margin > b.maxX || a.maxY + margin < b.minY || a.minY - margin > b.maxY);
  }

  function anyOverlap(composite: any[], existing: any[]): boolean {
    const existingBounds = existing.map(getShapeBounds).filter(Boolean) as any[];
    for (const s of composite) {
      const sb = getShapeBounds(s);
      if (!sb) continue;
      for (const eb of existingBounds) {
        if (rectsOverlap(sb, eb)) return true;
      }
    }
    return false;
  }

  function placeCompositeWithoutOverlap(shapes: any[], existingShapes: any[], canvas: { width: number; height: number }): any[] {
    // Compute composite bounds relative to current positions
    const bounds = computeBounds(shapes);
    if (!bounds) return shapes;
    const cw = canvas.width;
    const ch = canvas.height;

    // Candidate centers (grid)
    const cols = 4; const rows = 4;
    const candidates: { x: number; y: number }[] = [];
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        candidates.push({ x: (c * cw) / (cols + 1), y: (r * ch) / (rows + 1) });
      }
    }

    // Current center
    const cx = bounds.minX + (bounds.maxX - bounds.minX) / 2;
    const cy = bounds.minY + (bounds.maxY - bounds.minY) / 2;

    for (const candidate of candidates) {
      const dx = candidate.x - cx;
      const dy = candidate.y - cy;
      const moved = translateComposite(shapes, dx, dy);
      if (!anyOverlap(moved, existingShapes)) {
        return moved;
      }
    }
    // If all positions overlap, return original (best effort)
    return shapes;
  }

  async function placeOrEvict(shapes: any[], canvas: { width: number; height: number }): Promise<any[]> {
    let existing = await storage.getShapes();
    let placed = placeCompositeWithoutOverlap(shapes, existing, canvas);
    if (!anyOverlap(placed, existing)) return placed;
    // Eviction loop: remove oldest until fits
    while (true) {
      existing = await storage.getShapes();
      if (existing.length === 0) return shapes;
      const oldest = existing[0];
      console.log(`[placement] Evicting oldest shape ${oldest.id} (${oldest.type}) to make room`);
      await storage.deleteShape(oldest.id);
      const after = await storage.getShapes();
      placed = placeCompositeWithoutOverlap(shapes, after, canvas);
      if (!anyOverlap(placed, after)) return placed;
      // continue evicting if still overlapping
    }
  }

  function maybeApplyTemplate(command: string, shapes: any[]): { applied: boolean; templateName?: string; shapes: any[] } {
    // If shapes already look valid, keep them; otherwise, provide sane defaults
    const hasCircle = shapes.some((s) => s.type === 'circle');
    const hasLine = shapes.some((s) => s.type === 'line');

    if (command.includes('smile') || command.includes('smiley')) {
      const tmpl = [
        // More visible face outline
        { type: 'circle', x: 300, y: 250, radius: 80, color: '#FFC107', strokeWidth: 4 },
        { type: 'circle', x: 270, y: 220, radius: 8, color: '#000000', strokeWidth: 2 },
        { type: 'circle', x: 330, y: 220, radius: 8, color: '#000000', strokeWidth: 2 },
        { type: 'line', x: 250, y: 280, x2: 350, y2: 280, color: '#000000', strokeWidth: 3, style: 'curve' },
      ];
      return { applied: true, templateName: 'smiley', shapes: tmpl };
    }
    if (command.includes('sad face')) {
      const tmpl = [
        { type: 'circle', x: 300, y: 250, radius: 80, color: '#FFFFCC', strokeWidth: 2 },
        { type: 'circle', x: 270, y: 220, radius: 8, color: '#000000', strokeWidth: 2 },
        { type: 'circle', x: 330, y: 220, radius: 8, color: '#000000', strokeWidth: 2 },
        { type: 'line', x: 250, y: 320, x2: 350, y2: 320, color: '#000000', strokeWidth: 3, style: 'curve' },
      ];
      return { applied: true, templateName: 'sad', shapes: tmpl };
    }
    if (command.includes('sun')) {
      // Sun with 8 evenly spaced rays, top-aligned
      const centerX = 300; const centerY = 250; const R = 80;
      const rays: any[] = [];
      const rayLen = 40;
      const rayCount = 8;
      const startAngle = -Math.PI / 2; // north
      for (let i = 0; i < rayCount; i++) {
        const angle = startAngle + (i / rayCount) * Math.PI * 2;
        const sx = centerX + (R + 5) * Math.cos(angle);
        const sy = centerY + (R + 5) * Math.sin(angle);
        const ex = centerX + (R + rayLen) * Math.cos(angle);
        const ey = centerY + (R + rayLen) * Math.sin(angle);
        rays.push({ type: 'line', x: sx, y: sy, x2: ex, y2: ey, color: '#FFA500', strokeWidth: 3 });
      }
      const tmpl = [
        { type: 'circle', x: centerX, y: centerY, radius: R, color: '#FFFF00', strokeWidth: 2 },
        ...rays,
      ];
      return { applied: true, templateName: 'sun', shapes: tmpl };
    }
    if (command.includes('tree')) {
      const tmpl = [
        // Trunk
        { type: 'rectangle', x: 290, y: 290, width: 20, height: 80, color: '#8B4513', strokeWidth: 2 },
        // Foliage (stacked triangles)
        { type: 'triangle', x: 240, y: 200, width: 120, height: 90, color: '#228B22', strokeWidth: 2 },
        { type: 'triangle', x: 255, y: 160, width: 90, height: 70, color: '#2E8B57', strokeWidth: 2 },
        { type: 'triangle', x: 270, y: 130, width: 60, height: 50, color: '#32CD32', strokeWidth: 2 },
      ];
      return { applied: true, templateName: 'tree', shapes: tmpl };
    }
    if (command.includes('house')) {
      const baseX = 300; const baseY = 280; const w = 160; const h = 120; const roofH = 70;
      const tmpl = [
        { type: 'rectangle', x: baseX - w / 2, y: baseY - h, width: w, height: h, color: '#8B4513', strokeWidth: 3 },
        { type: 'triangle', x: baseX - w / 2, y: baseY - h - roofH, width: w, height: roofH, color: '#A0522D', strokeWidth: 3 },
        { type: 'rectangle', x: baseX - 15, y: baseY - 50, width: 30, height: 50, color: '#654321', strokeWidth: 2 },
        { type: 'rectangle', x: baseX - 60, y: baseY - 90, width: 35, height: 35, color: '#87CEEB', strokeWidth: 2 },
      ];
      return { applied: true, templateName: 'house', shapes: tmpl };
    }
    if (command.includes('apple')) {
      const tmpl = [
        { type: 'circle', x: 300, y: 260, radius: 40, color: '#FF0000', strokeWidth: 2 },
        { type: 'line', x: 300, y: 220, x2: 300, y2: 200, color: '#654321', strokeWidth: 3 },
        { type: 'circle', x: 290, y: 245, radius: 6, color: '#FFFFFF', strokeWidth: 2 },
        { type: 'circle', x: 310, y: 245, radius: 6, color: '#FFFFFF', strokeWidth: 2 },
      ];
      return { applied: true, templateName: 'apple', shapes: tmpl };
    }
    // If output already decent, keep it
    if (hasCircle || hasLine) return { applied: false, shapes };
    // Otherwise skip
    return { applied: false, shapes };
  }

  // REST API routes
  app.get('/api/shapes', async (req, res) => {
    try {
      const shapes = await storage.getShapes();
      res.json(shapes);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch shapes' });
    }
  });

  app.post('/api/shapes', async (req, res) => {
    try {
      const shapeData = insertShapeSchema.parse(req.body);
      const shape = await storage.createShape(shapeData);
      
      // Broadcast to WebSocket clients
      broadcast({ type: 'shape_created', shape });
      
      res.json(shape);
    } catch (error) {
      res.status(400).json({ error: 'Invalid shape data' });
    }
  });

  app.delete('/api/shapes/:id', async (req, res) => {
    try {
      const deleted = await storage.deleteShape(req.params.id);
      if (deleted) {
        broadcast({ type: 'shape_deleted', id: req.params.id });
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Shape not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete shape' });
    }
  });

  app.delete('/api/shapes', async (req, res) => {
    try {
      await storage.clearShapes();
      broadcast({ type: 'shapes_cleared' });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to clear shapes' });
    }
  });

  app.get('/api/canvas-state', async (req, res) => {
    try {
      const state = await storage.getCanvasState();
      res.json(state);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch canvas state' });
    }
  });

  app.get('/api/chat-messages', async (req, res) => {
    try {
      const messages = await storage.getChatMessages();
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch chat messages' });
    }
  });

  app.post('/api/chat-messages', async (req, res) => {
    try {
      const messageData = insertChatMessageSchema.parse(req.body);
      const message = await storage.createChatMessage(messageData);
      res.json(message);
    } catch (error) {
      res.status(400).json({ error: 'Invalid message data' });
    }
  });

  // Voice upload endpoint
  app.post('/api/voice-transcribe', upload.single('audio'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
      }

      const transcription = await groqService.transcribeAudio(req.file.buffer);
      res.json({ transcription });
    } catch (error) {
      res.status(500).json({ error: 'Failed to transcribe audio' });
    }
  });

  // Task management routes
  app.get('/api/tasks', async (req, res) => {
    try {
      const filters = {
        completed: req.query.completed ? req.query.completed === 'true' : undefined,
        priority: req.query.priority as string,
        category: req.query.category as string,
      };
      const tasks = await storage.getTasks(filters);
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  });

  app.get('/api/tasks/:id', async (req, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (task) {
        res.json(task);
      } else {
        res.status(404).json({ error: 'Task not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch task' });
    }
  });

  app.post('/api/tasks', async (req, res) => {
    try {
      const taskData = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(taskData);
      broadcast({ type: 'task_created', task });
      res.json(task);
    } catch (error) {
      res.status(400).json({ error: 'Invalid task data' });
    }
  });

  app.patch('/api/tasks/:id', async (req, res) => {
    try {
      const task = await storage.updateTask(req.params.id, req.body);
      if (task) {
        broadcast({ type: 'task_updated', task });
        res.json(task);
      } else {
        res.status(404).json({ error: 'Task not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to update task' });
    }
  });

  app.delete('/api/tasks/:id', async (req, res) => {
    try {
      const deleted = await storage.deleteTask(req.params.id);
      if (deleted) {
        broadcast({ type: 'task_deleted', id: req.params.id });
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Task not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete task' });
    }
  });

  // Task lists routes
  app.get('/api/task-lists', async (req, res) => {
    try {
      const taskLists = await storage.getTaskLists();
      res.json(taskLists);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch task lists' });
    }
  });

  app.post('/api/task-lists', async (req, res) => {
    try {
      const taskListData = insertTaskListSchema.parse(req.body);
      const taskList = await storage.createTaskList(taskListData);
      broadcast({ type: 'task_list_created', taskList });
      res.json(taskList);
    } catch (error) {
      res.status(400).json({ error: 'Invalid task list data' });
    }
  });

  // Layout management routes
  app.get('/api/layouts', async (req, res) => {
    try {
      const layouts = await storage.getLayouts();
      res.json(layouts);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch layouts' });
    }
  });

  app.get('/api/layouts/:id', async (req, res) => {
    try {
      const layout = await storage.getLayout(req.params.id);
      if (layout) {
        res.json(layout);
      } else {
        res.status(404).json({ error: 'Layout not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch layout' });
    }
  });

  app.post('/api/layouts', async (req, res) => {
    try {
      const layoutData = insertLayoutSchema.parse(req.body);
      const layout = await storage.createLayout(layoutData);
      broadcast({ type: 'layout_created', layout });
      res.json(layout);
    } catch (error) {
      res.status(400).json({ error: 'Invalid layout data' });
    }
  });

  app.patch('/api/layouts/:id', async (req, res) => {
    try {
      const layout = await storage.updateLayout(req.params.id, req.body);
      if (layout) {
        broadcast({ type: 'layout_updated', layout });
        res.json(layout);
      } else {
        res.status(404).json({ error: 'Layout not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to update layout' });
    }
  });

  app.delete('/api/layouts/:id', async (req, res) => {
    try {
      const deleted = await storage.deleteLayout(req.params.id);
      if (deleted) {
        broadcast({ type: 'layout_deleted', id: req.params.id });
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Layout not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete layout' });
    }
  });

  // Block management routes
  app.get('/api/blocks', async (req, res) => {
    try {
      const layoutId = req.query.layoutId as string;
      const blocks = layoutId ? await storage.getBlocks(layoutId) : [];
      res.json(blocks);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch blocks' });
    }
  });

  app.get('/api/blocks/:id', async (req, res) => {
    try {
      const block = await storage.getBlock(req.params.id);
      if (block) {
        res.json(block);
      } else {
        res.status(404).json({ error: 'Block not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch block' });
    }
  });

  app.post('/api/blocks', async (req, res) => {
    try {
      const blockData = insertBlockSchema.parse(req.body);
      const block = await storage.createBlock(blockData);
      broadcast({ type: 'block_created', block });
      res.json(block);
    } catch (error) {
      res.status(400).json({ error: 'Invalid block data' });
    }
  });

  app.patch('/api/blocks/:id', async (req, res) => {
    try {
      const block = await storage.updateBlock(req.params.id, req.body);
      if (block) {
        broadcast({ type: 'block_updated', block });
        res.json(block);
      } else {
        res.status(404).json({ error: 'Block not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to update block' });
    }
  });

  app.delete('/api/blocks/:id', async (req, res) => {
    try {
      const deleted = await storage.deleteBlock(req.params.id);
      if (deleted) {
        broadcast({ type: 'block_deleted', id: req.params.id });
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Block not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete block' });
    }
  });

  // App state routes
  app.get('/api/app-state/:appType', async (req, res) => {
    try {
      const appState = await storage.getAppState(req.params.appType);
      res.json(appState);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch app state' });
    }
  });

  app.post('/api/app-state/:appType', async (req, res) => {
    try {
      const stateData = insertAppStateSchema.parse(req.body);
      const appState = await storage.updateAppState(req.params.appType, stateData);
      broadcast({ type: 'app_state_updated', appState });
      res.json(appState);
    } catch (error) {
      res.status(400).json({ error: 'Invalid app state data' });
    }
  });

  return httpServer;
}
