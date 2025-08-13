import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, timestamp, real, boolean } from "drizzle-orm/pg-core";
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

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertShape = z.infer<typeof insertShapeSchema>;
export type Shape = typeof shapes.$inferSelect;

export type InsertCanvasState = z.infer<typeof insertCanvasStateSchema>;
export type CanvasState = typeof canvasState.$inferSelect;

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
