import { Request, Response } from "express";
import { storage } from "../storage";
import { insertTaskSchema } from "@shared/schema";

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

export const createTask = async (req: Request, res: Response) => {
  try {
    const taskData = insertTaskSchema.parse(req.body);
    const task = await storage.createTask(taskData);
    res.json(task);
  } catch (error) {
    res.status(400).json({ error: 'Invalid task data' });
  }
};

export const updateTask = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const taskData = insertTaskSchema.partial().parse(req.body);
    const task = await storage.updateTask(id, taskData);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  } catch (error) {
    res.status(400).json({ error: 'Invalid task data' });
  }
};

export const deleteTask = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const success = await storage.deleteTask(id);
    if (!success) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
};
