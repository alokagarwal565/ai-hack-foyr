import { 
  type User, type InsertUser, 
  type Shape, type InsertShape, 
  type CanvasState, type InsertCanvasState, 
  type ChatMessage, type InsertChatMessage,
  type Task, type InsertTask,
  type TaskList, type InsertTaskList,
  type Layout, type InsertLayout,
  type Block, type InsertBlock,
  type AppState, type InsertAppState
} from "@shared/schema";
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
  getChatMessages(limit?: number, appType?: string): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  clearChatMessages(appType?: string): Promise<boolean>;

  // Task operations
  getTasks(filters?: { completed?: boolean; priority?: string; category?: string }): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, task: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<boolean>;
  markTaskComplete(id: string, completed: boolean): Promise<Task | undefined>;

  // Task list operations
  getTaskLists(): Promise<TaskList[]>;
  getTaskList(id: string): Promise<TaskList | undefined>;
  createTaskList(taskList: InsertTaskList): Promise<TaskList>;
  updateTaskList(id: string, taskList: Partial<InsertTaskList>): Promise<TaskList | undefined>;
  deleteTaskList(id: string): Promise<boolean>;

  // Layout operations
  getLayouts(): Promise<Layout[]>;
  getLayout(id: string): Promise<Layout | undefined>;
  createLayout(layout: InsertLayout): Promise<Layout>;
  updateLayout(id: string, layout: Partial<InsertLayout>): Promise<Layout | undefined>;
  deleteLayout(id: string): Promise<boolean>;

  // Block operations
  getBlocks(layoutId: string): Promise<Block[]>;
  getBlock(id: string): Promise<Block | undefined>;
  createBlock(block: InsertBlock): Promise<Block>;
  updateBlock(id: string, block: Partial<InsertBlock>): Promise<Block | undefined>;
  deleteBlock(id: string): Promise<boolean>;

  // App state operations
  getAppState(appType: string): Promise<AppState | undefined>;
  updateAppState(appType: string, state: InsertAppState): Promise<AppState>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private shapes: Map<string, Shape>;
  private canvasState: CanvasState | undefined;
  private chatMessages: Map<string, ChatMessage>;
  private tasks: Map<string, Task>;
  private taskLists: Map<string, TaskList>;
  private layouts: Map<string, Layout>;
  private blocks: Map<string, Block>;
  private appStates: Map<string, AppState>;

  constructor() {
    this.users = new Map();
    this.shapes = new Map();
    this.chatMessages = new Map();
    this.tasks = new Map();
    this.taskLists = new Map();
    this.layouts = new Map();
    this.blocks = new Map();
    this.appStates = new Map();
    
    this.canvasState = {
      id: randomUUID(),
      shapes: [],
      mode: 'manual',
      lastCommand: null,
      updatedAt: new Date(),
    };

    // Initialize default app states
    this.appStates.set('tasks', {
      id: randomUUID(),
      appType: 'tasks',
      state: { tasks: [], taskLists: [] },
      mode: 'manual',
      lastCommand: null,
      updatedAt: new Date(),
      userId: null,
    });

    this.appStates.set('layout', {
      id: randomUUID(),
      appType: 'layout',
      state: { layouts: [], blocks: [] },
      mode: 'manual',
      lastCommand: null,
      updatedAt: new Date(),
      userId: null,
    });
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
  async getChatMessages(limit: number = 50, appType?: string): Promise<ChatMessage[]> {
    const messages = Array.from(this.chatMessages.values())
      .filter(msg => !appType || msg.appType === appType)
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

  async clearChatMessages(appType?: string): Promise<boolean> {
    if (appType) {
      const toDelete = Array.from(this.chatMessages.entries())
        .filter(([_, msg]) => msg.appType === appType)
        .map(([id, _]) => id);
      toDelete.forEach(id => this.chatMessages.delete(id));
    } else {
      this.chatMessages.clear();
    }
    return true;
  }

  // Task operations
  async getTasks(filters?: { completed?: boolean; priority?: string; category?: string }): Promise<Task[]> {
    let tasks = Array.from(this.tasks.values());
    
    if (filters) {
      if (filters.completed !== undefined) {
        tasks = tasks.filter(task => task.completed === filters.completed);
      }
      if (filters.priority) {
        tasks = tasks.filter(task => task.priority === filters.priority);
      }
      if (filters.category) {
        tasks = tasks.filter(task => task.category === filters.category);
      }
    }
    
    return tasks.sort((a, b) => a.createdAt!.getTime() - b.createdAt!.getTime());
  }

  async getTask(id: string): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const id = randomUUID();
    const task: Task = {
      id,
      title: insertTask.title,
      description: insertTask.description || null,
      completed: insertTask.completed || false,
      priority: insertTask.priority || 'medium',
      dueDate: insertTask.dueDate || null,
      category: insertTask.category || null,
      tags: insertTask.tags || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: insertTask.userId || null,
    };
    this.tasks.set(id, task);
    return task;
  }

  async updateTask(id: string, updateData: Partial<InsertTask>): Promise<Task | undefined> {
    const existing = this.tasks.get(id);
    if (!existing) return undefined;
    
    const updated: Task = { 
      ...existing, 
      ...updateData,
      updatedAt: new Date(),
    };
    this.tasks.set(id, updated);
    return updated;
  }

  async deleteTask(id: string): Promise<boolean> {
    return this.tasks.delete(id);
  }

  async markTaskComplete(id: string, completed: boolean): Promise<Task | undefined> {
    return this.updateTask(id, { completed });
  }

  // Task list operations
  async getTaskLists(): Promise<TaskList[]> {
    return Array.from(this.taskLists.values());
  }

  async getTaskList(id: string): Promise<TaskList | undefined> {
    return this.taskLists.get(id);
  }

  async createTaskList(insertTaskList: InsertTaskList): Promise<TaskList> {
    const id = randomUUID();
    const taskList: TaskList = {
      id,
      name: insertTaskList.name,
      description: insertTaskList.description || null,
      color: insertTaskList.color || '#3B82F6',
      tasks: insertTaskList.tasks || [],
      createdAt: new Date(),
      userId: insertTaskList.userId || null,
    };
    this.taskLists.set(id, taskList);
    return taskList;
  }

  async updateTaskList(id: string, updateData: Partial<InsertTaskList>): Promise<TaskList | undefined> {
    const existing = this.taskLists.get(id);
    if (!existing) return undefined;
    
    const updated: TaskList = { ...existing, ...updateData };
    this.taskLists.set(id, updated);
    return updated;
  }

  async deleteTaskList(id: string): Promise<boolean> {
    return this.taskLists.delete(id);
  }

  // Layout operations
  async getLayouts(): Promise<Layout[]> {
    return Array.from(this.layouts.values());
  }

  async getLayout(id: string): Promise<Layout | undefined> {
    return this.layouts.get(id);
  }

  async createLayout(insertLayout: InsertLayout): Promise<Layout> {
    const id = randomUUID();
    const layout: Layout = {
      id,
      name: insertLayout.name,
      description: insertLayout.description || null,
      gridConfig: insertLayout.gridConfig,
      blocks: insertLayout.blocks || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: insertLayout.userId || null,
    };
    this.layouts.set(id, layout);
    return layout;
  }

  async updateLayout(id: string, updateData: Partial<InsertLayout>): Promise<Layout | undefined> {
    const existing = this.layouts.get(id);
    if (!existing) return undefined;
    
    const updated: Layout = { 
      ...existing, 
      ...updateData,
      updatedAt: new Date(),
    };
    this.layouts.set(id, updated);
    return updated;
  }

  async deleteLayout(id: string): Promise<boolean> {
    return this.layouts.delete(id);
  }

  // Block operations
  async getBlocks(layoutId: string): Promise<Block[]> {
    return Array.from(this.blocks.values()).filter(block => block.layoutId === layoutId);
  }

  async getBlock(id: string): Promise<Block | undefined> {
    return this.blocks.get(id);
  }

  async createBlock(insertBlock: InsertBlock): Promise<Block> {
    const id = randomUUID();
    const block: Block = {
      id,
      type: insertBlock.type,
      content: insertBlock.content,
      position: insertBlock.position,
      style: insertBlock.style || {},
      layoutId: insertBlock.layoutId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.blocks.set(id, block);
    return block;
  }

  async updateBlock(id: string, updateData: Partial<InsertBlock>): Promise<Block | undefined> {
    const existing = this.blocks.get(id);
    if (!existing) return undefined;
    
    const updated: Block = { 
      ...existing, 
      ...updateData,
      updatedAt: new Date(),
    };
    this.blocks.set(id, updated);
    return updated;
  }

  async deleteBlock(id: string): Promise<boolean> {
    return this.blocks.delete(id);
  }

  // App state operations
  async getAppState(appType: string): Promise<AppState | undefined> {
    return this.appStates.get(appType);
  }

  async updateAppState(appType: string, stateData: InsertAppState): Promise<AppState> {
    const existing = this.appStates.get(appType);
    const appState: AppState = {
      id: existing?.id || randomUUID(),
      appType: stateData.appType || appType,
      state: stateData.state,
      mode: stateData.mode || 'manual',
      lastCommand: stateData.lastCommand || null,
      updatedAt: new Date(),
      userId: stateData.userId || null,
    };
    this.appStates.set(appType, appState);
    return appState;
  }
}

export const storage = new MemStorage();
