import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, timestamp, real, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const shapes = pgTable("shapes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // 'rectangle', 'circle', 'line'
  x: real("x").notNull(),
  y: real("y").notNull(),
  width: real("width"),
  height: real("height"),
  radius: real("radius"),
  x2: real("x2"), // for lines
  y2: real("y2"), // for lines
  color: text("color").notNull().default('#000000'),
  strokeWidth: real("stroke_width").notNull().default(2),
  createdAt: timestamp("created_at").defaultNow(),
  userId: varchar("user_id"),
});

export const canvasState = pgTable("canvas_state", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shapes: jsonb("shapes").notNull().default([]),
  mode: text("mode").notNull().default('manual'), // 'manual' or 'ai'
  lastCommand: text("last_command"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  content: text("content").notNull(),
  sender: text("sender").notNull(), // 'user' or 'ai'
  timestamp: timestamp("timestamp").defaultNow(),
  processed: boolean("processed").default(false),
  appType: text("app_type").notNull().default('canvas'), // 'canvas', 'tasks', 'layout'
});

// Task Management System Tables
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  completed: boolean("completed").notNull().default(false),
  priority: text("priority").notNull().default('medium'), // 'low', 'medium', 'high'
  dueDate: timestamp("due_date"),
  category: text("category"),
  tags: jsonb("tags").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  userId: varchar("user_id"),
});

export const taskLists = pgTable("task_lists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").default('#3B82F6'),
  tasks: jsonb("tasks").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  userId: varchar("user_id"),
});

// Layout Grid Builder Tables
export const layouts = pgTable("layouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  gridConfig: jsonb("grid_config").notNull(), // grid structure and settings
  blocks: jsonb("blocks").default([]), // array of block objects
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  userId: varchar("user_id"),
});

export const blocks = pgTable("blocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // 'text', 'image', 'container', 'widget'
  content: jsonb("content").notNull(), // block-specific content
  position: jsonb("position").notNull(), // grid position and size
  style: jsonb("style").default({}), // styling properties
  layoutId: varchar("layout_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const appStates = pgTable("app_states", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  appType: text("app_type").notNull(), // 'canvas', 'tasks', 'layout'
  state: jsonb("state").notNull(),
  mode: text("mode").notNull().default('manual'), // 'manual' or 'ai'
  lastCommand: text("last_command"),
  updatedAt: timestamp("updated_at").defaultNow(),
  userId: varchar("user_id"),
});

// Zod schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertShapeSchema = createInsertSchema(shapes).omit({
  id: true,
  createdAt: true,
});

export const insertCanvasStateSchema = createInsertSchema(canvasState).omit({
  id: true,
  updatedAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  timestamp: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTaskListSchema = createInsertSchema(taskLists).omit({
  id: true,
  createdAt: true,
});

export const insertLayoutSchema = createInsertSchema(layouts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBlockSchema = createInsertSchema(blocks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAppStateSchema = createInsertSchema(appStates).omit({
  id: true,
  updatedAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertShape = z.infer<typeof insertShapeSchema>;
export type Shape = typeof shapes.$inferSelect;

export type InsertCanvasState = z.infer<typeof insertCanvasStateSchema>;
export type CanvasState = typeof canvasState.$inferSelect;

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

export type InsertTaskList = z.infer<typeof insertTaskListSchema>;
export type TaskList = typeof taskLists.$inferSelect;

export type InsertLayout = z.infer<typeof insertLayoutSchema>;
export type Layout = typeof layouts.$inferSelect;

export type InsertBlock = z.infer<typeof insertBlockSchema>;
export type Block = typeof blocks.$inferSelect;

export type InsertAppState = z.infer<typeof insertAppStateSchema>;
export type AppState = typeof appStates.$inferSelect;
