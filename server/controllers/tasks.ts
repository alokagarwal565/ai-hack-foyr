import { Request, Response } from "express";
import { storage } from "../storage";

export const getTasks = async (req: Request, res: Response) => {
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
};
