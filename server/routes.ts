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
            ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
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
    } else if (appType === 'tasks') {
      context = { tasks: await storage.getTasks() };
    } else if (appType === 'layout') {
      context = { layouts: await storage.getLayouts() };
    }
    
    // Interpret command with AI
    const interpretation = await groqService.interpretCommand(content, context, appType);
    
    // Execute the interpreted command
    await executeCommand(interpretation, appType);

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

  async function executeCommand(interpretation: any, appType: 'canvas' | 'tasks' | 'layout' = 'canvas') {
    try {
      if (appType === 'canvas') {
        switch (interpretation.action) {
          case 'draw':
            if (interpretation.shapes) {
              for (const shapeData of interpretation.shapes) {
                await storage.createShape(shapeData);
              }
            }
            break;
          case 'clear':
            await storage.clearShapes();
            break;
          case 'delete':
            await storage.clearShapes();
            break;
        }

        // Update canvas state
        const shapes = await storage.getShapes();
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
              await storage.createLayout({
                name: interpretation.layout.name || 'AI Generated Layout',
                gridConfig: interpretation.layout.gridConfig,
                blocks: interpretation.layout.blocks || [],
              });
            }
            break;
          case 'add_block':
            if (interpretation.layout && interpretation.layout.blocks) {
              for (const blockData of interpretation.layout.blocks) {
                // Find a layout to add blocks to (use first available or create one)
                const layouts = await storage.getLayouts();
                const targetLayout = layouts[0];
                
                if (targetLayout) {
                  await storage.createBlock({
                    type: blockData.type,
                    content: blockData.content,
                    position: blockData.position,
                    style: blockData.style || {},
                    layoutId: targetLayout.id,
                  });
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
