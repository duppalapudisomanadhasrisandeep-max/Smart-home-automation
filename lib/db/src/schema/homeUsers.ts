import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const homeUsersTable = pgTable("home_users", {
  id: text("id").primaryKey(),
  email: text("email"),
  displayName: text("display_name"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  demoSeeded: boolean("demo_seeded").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertHomeUserSchema = createInsertSchema(homeUsersTable).omit({
  createdAt: true,
  updatedAt: true,
  demoSeeded: true,
});
export type InsertHomeUser = z.infer<typeof insertHomeUserSchema>;
export type HomeUser = typeof homeUsersTable.$inferSelect;
