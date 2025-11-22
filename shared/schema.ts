import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, timestamp, real, boolean, integer, index } from "drizzle-orm/pg-core";
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
}, (table) => {
  return {
    userIdIdx: index("shapes_user_id_idx").on(table.userId),
  };
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
}, (table) => {
  return {
    timestampIdx: index("chat_messages_timestamp_idx").on(table.timestamp),
    appTypeIdx: index("chat_messages_app_type_idx").on(table.appType),
  };
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
}, (table) => {
  return {
    userIdIdx: index("tasks_user_id_idx").on(table.userId),
  };
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
  appType: text("app_type").notNull().unique(), // 'canvas', 'tasks', 'layout'
  state: jsonb("state").notNull(),
  mode: text("mode").notNull().default('manual'), // 'manual' or 'ai'
  lastCommand: text("last_command"),
  updatedAt: timestamp("updated_at").defaultNow(),
  userId: varchar("user_id"),
});

// Zod schemas



// Zod Schemas with strict validation
export const insertUserSchema = createInsertSchema(users).extend({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const insertShapeSchema = createInsertSchema(shapes).extend({
  type: z.enum(['rectangle', 'circle', 'line', 'triangle', 'star']),
  x: z.number(),
  y: z.number(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  radius: z.number().positive().optional(),
  x2: z.number().optional(),
  y2: z.number().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color code"),
  strokeWidth: z.number().min(1).max(20).default(2),
  rotation: z.number().default(0),
});

export const insertCanvasStateSchema = createInsertSchema(canvasState);

export const insertChatMessageSchema = createInsertSchema(chatMessages).extend({
  content: z.string().min(1, "Message cannot be empty"),
  appType: z.enum(['canvas', 'tasks', 'layout']).default('canvas'),
});

export const insertTaskSchema = createInsertSchema(tasks).extend({
  title: z.string().min(1, "Title is required"),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dueDate: z.coerce.date().optional(), // Allow string to date coercion
});

export const insertTaskListSchema = createInsertSchema(taskLists);

export const insertLayoutSchema = createInsertSchema(layouts).extend({
  name: z.string().min(1, "Layout name is required"),
});

export const insertBlockSchema = createInsertSchema(blocks).extend({
  type: z.string().min(1, "Block type is required"),
  layoutId: z.string().uuid(),
});

export const insertAppStateSchema = createInsertSchema(appStates);

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Shape = typeof shapes.$inferSelect;
export type InsertShape = z.infer<typeof insertShapeSchema>;

export type CanvasState = typeof canvasState.$inferSelect;
export type InsertCanvasState = z.infer<typeof insertCanvasStateSchema>;

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

export type TaskList = typeof taskLists.$inferSelect;
export type InsertTaskList = z.infer<typeof insertTaskListSchema>;

export type Layout = typeof layouts.$inferSelect;
export type InsertLayout = z.infer<typeof insertLayoutSchema>;

export type Block = typeof blocks.$inferSelect;
export type InsertBlock = z.infer<typeof insertBlockSchema>;

export type AppState = typeof appStates.$inferSelect;
export type InsertAppState = z.infer<typeof insertAppStateSchema>;
