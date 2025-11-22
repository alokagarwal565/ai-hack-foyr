import { 
  type User, type InsertUser, 
  type Shape, type InsertShape, 
  type CanvasState, type InsertCanvasState, 
  type ChatMessage, type InsertChatMessage,
  type Task, type InsertTask,
  type TaskList, type InsertTaskList,
  type Layout, type InsertLayout,
  type Block, type InsertBlock,
  type AppState, type InsertAppState,
  users, shapes, canvasState, chatMessages, tasks, taskLists, layouts, blocks, appStates
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
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

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Shape operations
  async getShapes(): Promise<Shape[]> {
    return await db.select().from(shapes).orderBy(shapes.createdAt);
  }

  async getShape(id: string): Promise<Shape | undefined> {
    const [shape] = await db.select().from(shapes).where(eq(shapes.id, id));
    return shape;
  }

  async createShape(insertShape: InsertShape): Promise<Shape> {
    const [shape] = await db.insert(shapes).values(insertShape).returning();
    return shape;
  }

  async updateShape(id: string, updateData: Partial<InsertShape>): Promise<Shape | undefined> {
    const [updated] = await db.update(shapes).set(updateData).where(eq(shapes.id, id)).returning();
    return updated;
  }

  async deleteShape(id: string): Promise<boolean> {
    const [deleted] = await db.delete(shapes).where(eq(shapes.id, id)).returning();
    return !!deleted;
  }

  async clearShapes(): Promise<boolean> {
    await db.delete(shapes);
    return true;
  }

  // Canvas state operations
  async getCanvasState(): Promise<CanvasState | undefined> {
    const [state] = await db.select().from(canvasState).orderBy(desc(canvasState.updatedAt)).limit(1);
    return state;
  }

  async updateCanvasState(state: InsertCanvasState): Promise<CanvasState> {
    const [updated] = await db.insert(canvasState).values(state).returning();
    return updated;
  }

  // Chat message operations
  async getChatMessages(limit: number = 50, appType?: string): Promise<ChatMessage[]> {
    let query = db.select().from(chatMessages);
    
    if (appType) {
      query = query.where(eq(chatMessages.appType, appType)) as any;
    }
    
    const messages = await query.orderBy(desc(chatMessages.timestamp)).limit(limit);
    return messages.reverse();
  }

  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const [message] = await db.insert(chatMessages).values(insertMessage).returning();
    return message;
  }

  async clearChatMessages(appType?: string): Promise<boolean> {
    if (appType) {
      await db.delete(chatMessages).where(eq(chatMessages.appType, appType));
    } else {
      await db.delete(chatMessages);
    }
    return true;
  }

  // Task operations
  async getTasks(filters?: { completed?: boolean; priority?: string; category?: string }): Promise<Task[]> {
    let conditions = [];
    
    if (filters) {
      if (filters.completed !== undefined) {
        conditions.push(eq(tasks.completed, filters.completed));
      }
      if (filters.priority) {
        conditions.push(eq(tasks.priority, filters.priority));
      }
      if (filters.category) {
        conditions.push(eq(tasks.category, filters.category));
      }
    }

    const query = db.select().from(tasks);
    if (conditions.length > 0) {
      // @ts-ignore - and() accepts variable arguments but types are strict
      return await query.where(and(...conditions)).orderBy(tasks.createdAt);
    }
    
    return await query.orderBy(tasks.createdAt);
  }

  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const [task] = await db.insert(tasks).values(insertTask).returning();
    return task;
  }

  async updateTask(id: string, updateData: Partial<InsertTask>): Promise<Task | undefined> {
    const [updated] = await db.update(tasks).set({ ...updateData, updatedAt: new Date() }).where(eq(tasks.id, id)).returning();
    return updated;
  }

  async deleteTask(id: string): Promise<boolean> {
    const [deleted] = await db.delete(tasks).where(eq(tasks.id, id)).returning();
    return !!deleted;
  }

  async markTaskComplete(id: string, completed: boolean): Promise<Task | undefined> {
    return this.updateTask(id, { completed });
  }

  // Task list operations
  async getTaskLists(): Promise<TaskList[]> {
    return await db.select().from(taskLists);
  }

  async getTaskList(id: string): Promise<TaskList | undefined> {
    const [list] = await db.select().from(taskLists).where(eq(taskLists.id, id));
    return list;
  }

  async createTaskList(insertTaskList: InsertTaskList): Promise<TaskList> {
    const [list] = await db.insert(taskLists).values(insertTaskList).returning();
    return list;
  }

  async updateTaskList(id: string, updateData: Partial<InsertTaskList>): Promise<TaskList | undefined> {
    const [updated] = await db.update(taskLists).set(updateData).where(eq(taskLists.id, id)).returning();
    return updated;
  }

  async deleteTaskList(id: string): Promise<boolean> {
    const [deleted] = await db.delete(taskLists).where(eq(taskLists.id, id)).returning();
    return !!deleted;
  }

  // Layout operations
  async getLayouts(): Promise<Layout[]> {
    return await db.select().from(layouts);
  }

  async getLayout(id: string): Promise<Layout | undefined> {
    const [layout] = await db.select().from(layouts).where(eq(layouts.id, id));
    return layout;
  }

  async createLayout(insertLayout: InsertLayout): Promise<Layout> {
    const [layout] = await db.insert(layouts).values(insertLayout).returning();
    return layout;
  }

  async updateLayout(id: string, updateData: Partial<InsertLayout>): Promise<Layout | undefined> {
    const [updated] = await db.update(layouts).set({ ...updateData, updatedAt: new Date() }).where(eq(layouts.id, id)).returning();
    return updated;
  }

  async deleteLayout(id: string): Promise<boolean> {
    const [deleted] = await db.delete(layouts).where(eq(layouts.id, id)).returning();
    return !!deleted;
  }

  // Block operations
  async getBlocks(layoutId: string): Promise<Block[]> {
    return await db.select().from(blocks).where(eq(blocks.layoutId, layoutId));
  }

  async getBlock(id: string): Promise<Block | undefined> {
    const [block] = await db.select().from(blocks).where(eq(blocks.id, id));
    return block;
  }

  async createBlock(insertBlock: InsertBlock): Promise<Block> {
    const [block] = await db.insert(blocks).values(insertBlock).returning();
    return block;
  }

  async updateBlock(id: string, updateData: Partial<InsertBlock>): Promise<Block | undefined> {
    const [updated] = await db.update(blocks).set({ ...updateData, updatedAt: new Date() }).where(eq(blocks.id, id)).returning();
    return updated;
  }

  async deleteBlock(id: string): Promise<boolean> {
    const [deleted] = await db.delete(blocks).where(eq(blocks.id, id)).returning();
    return !!deleted;
  }

  // App state operations
  async getAppState(appType: string): Promise<AppState | undefined> {
    const [state] = await db.select().from(appStates).where(eq(appStates.appType, appType));
    return state;
  }

  async updateAppState(appType: string, stateData: InsertAppState): Promise<AppState> {
    const [updated] = await db.insert(appStates)
      .values({ ...stateData, appType })
      .onConflictDoUpdate({
        target: appStates.appType,
        set: { ...stateData, updatedAt: new Date() },
      })
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
