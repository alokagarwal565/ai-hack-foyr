import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertShapeSchema, insertCanvasStateSchema, insertChatMessageSchema } from "@shared/schema";
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
            await handleChatMessage(ws, message.content);
            break;
          case 'voice_data':
            await handleVoiceData(ws, message.data);
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

  async function handleChatMessage(ws: WebSocket, content: string) {
    // Save user message
    const userMessage = await storage.createChatMessage({
      content,
      sender: 'user',
    });

    // Broadcast user message to all clients
    broadcast({ type: 'chat_message', message: userMessage });

    // Get current shapes for context
    const shapes = await storage.getShapes();
    
    // Interpret command with AI
    const interpretation = await groqService.interpretCommand(content, shapes);
    
    // Execute the interpreted command
    await executeCommand(interpretation);

    // Save AI response
    const aiMessage = await storage.createChatMessage({
      content: interpretation.message,
      sender: 'ai',
    });

    // Broadcast AI message and updated state
    broadcast({ type: 'chat_message', message: aiMessage });
    broadcast({ type: 'command_executed', interpretation });
    
    const updatedShapes = await storage.getShapes();
    broadcast({ type: 'shapes_updated', shapes: updatedShapes });
  }

  async function handleVoiceData(ws: WebSocket, audioData: string) {
    try {
      // Convert base64 to buffer
      const audioBuffer = Buffer.from(audioData, 'base64');
      
      // Transcribe with Whisper
      const transcription = await groqService.transcribeAudio(audioBuffer);
      
      if (transcription) {
        // Process as chat message
        await handleChatMessage(ws, transcription);
        ws.send(JSON.stringify({ type: 'voice_transcribed', text: transcription }));
      }
    } catch (error) {
      console.error('Voice processing error:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Failed to process voice input' }));
    }
  }

  async function executeCommand(interpretation: any) {
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
        // For simplicity, clear all shapes on delete command
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

  return httpServer;
}
