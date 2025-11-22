import { Request, Response } from "express";
import { storage } from "../storage";
import { insertShapeSchema } from "@shared/schema";
import { broadcast } from "../routes";

export const getShapes = async (req: Request, res: Response) => {
  try {
    const shapes = await storage.getShapes();
    res.json(shapes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch shapes' });
  }
};

export const createShape = async (req: Request, res: Response) => {
  try {
    const shapeData = insertShapeSchema.parse(req.body);
    const shape = await storage.createShape(shapeData);
    
    // Broadcast to WebSocket clients
    broadcast({ type: 'shape_created', shape });
    
    res.json(shape);
  } catch (error) {
    res.status(400).json({ error: 'Invalid shape data' });
  }
};

export const deleteShape = async (req: Request, res: Response) => {
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
};

export const clearShapes = async (req: Request, res: Response) => {
  try {
    await storage.clearShapes();
    broadcast({ type: 'shapes_cleared' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear shapes' });
  }
};

export const getCanvasState = async (req: Request, res: Response) => {
  try {
    const state = await storage.getCanvasState();
    res.json(state);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch canvas state' });
  }
};
