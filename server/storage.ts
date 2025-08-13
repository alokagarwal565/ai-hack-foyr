import { type User, type InsertUser, type Shape, type InsertShape, type CanvasState, type InsertCanvasState, type ChatMessage, type InsertChatMessage } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Shape operations
  getShapes(): Promise<Shape[]>;
  getShape(id: string): Promise<Shape | undefined>;
  createShape(shape: InsertShape): Promise<Shape>;
  updateShape(id: string, shape: Partial<InsertShape>): Promise<Shape | undefined>;
  deleteShape(id: string): Promise<boolean>;
  clearShapes(): Promise<boolean>;

  // Canvas state operations
  getCanvasState(): Promise<CanvasState | undefined>;
  updateCanvasState(state: InsertCanvasState): Promise<CanvasState>;

  // Chat message operations
  getChatMessages(limit?: number): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  clearChatMessages(): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private shapes: Map<string, Shape>;
  private canvasState: CanvasState | undefined;
  private chatMessages: Map<string, ChatMessage>;

  constructor() {
    this.users = new Map();
    this.shapes = new Map();
    this.chatMessages = new Map();
    this.canvasState = {
      id: randomUUID(),
      shapes: [],
      mode: 'manual',
      lastCommand: null,
      updatedAt: new Date(),
    };
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Shape operations
  async getShapes(): Promise<Shape[]> {
    return Array.from(this.shapes.values());
  }

  async getShape(id: string): Promise<Shape | undefined> {
    return this.shapes.get(id);
  }

  async createShape(insertShape: InsertShape): Promise<Shape> {
    const id = randomUUID();
    const shape: Shape = {
      id,
      type: insertShape.type,
      x: insertShape.x,
      y: insertShape.y,
      width: insertShape.width || null,
      height: insertShape.height || null,
      radius: insertShape.radius || null,
      x2: insertShape.x2 || null,
      y2: insertShape.y2 || null,
      color: insertShape.color || '#000000',
      strokeWidth: insertShape.strokeWidth || 2,
      createdAt: new Date(),
      userId: insertShape.userId || null,
    };
    this.shapes.set(id, shape);
    return shape;
  }

  async updateShape(id: string, updateData: Partial<InsertShape>): Promise<Shape | undefined> {
    const existing = this.shapes.get(id);
    if (!existing) return undefined;
    
    const updated: Shape = { ...existing, ...updateData };
    this.shapes.set(id, updated);
    return updated;
  }

  async deleteShape(id: string): Promise<boolean> {
    return this.shapes.delete(id);
  }

  async clearShapes(): Promise<boolean> {
    this.shapes.clear();
    return true;
  }

  // Canvas state operations
  async getCanvasState(): Promise<CanvasState> {
    return this.canvasState!;
  }

  async updateCanvasState(state: InsertCanvasState): Promise<CanvasState> {
    this.canvasState = {
      id: this.canvasState?.id || randomUUID(),
      mode: state.mode || 'manual',
      shapes: state.shapes || [],
      lastCommand: state.lastCommand || null,
      updatedAt: new Date(),
    };
    return this.canvasState;
  }

  // Chat message operations
  async getChatMessages(limit: number = 50): Promise<ChatMessage[]> {
    const messages = Array.from(this.chatMessages.values())
      .sort((a, b) => a.timestamp!.getTime() - b.timestamp!.getTime());
    
    return limit ? messages.slice(-limit) : messages;
  }

  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const id = randomUUID();
    const message: ChatMessage = {
      ...insertMessage,
      id,
      timestamp: new Date(),
      processed: false,
    };
    this.chatMessages.set(id, message);
    return message;
  }

  async clearChatMessages(): Promise<boolean> {
    this.chatMessages.clear();
    return true;
  }
}

export const storage = new MemStorage();
