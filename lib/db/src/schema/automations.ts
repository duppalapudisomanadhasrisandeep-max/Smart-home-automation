import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { devicesTable } from "./devices";
import { homeUsersTable } from "./homeUsers";

export type AutomationDay = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
export type AutomationAction = "on" | "off";
export type AutomationTargetKind = "device" | "all_lights";

export const automationsTable = pgTable(
  "home_automations",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => homeUsersTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    targetKind: text("target_kind").$type<AutomationTargetKind>().notNull(),
    targetDeviceId: integer("target_device_id").references(() => devicesTable.id, { onDelete: "set null" }),
    time: text("time").notNull(),
    days: text("days").array().$type<AutomationDay[]>().notNull(),
    action: text("action").$type<AutomationAction>().notNull(),
    enabled: boolean("enabled").notNull().default(true),
    lastExecutedAt: timestamp("last_executed_at", { withTimezone: true }),
    lastExecutionKey: text("last_execution_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("home_automations_user_id_idx").on(table.userId)],
);

export const insertAutomationSchema = createInsertSchema(automationsTable).omit({
  id: true,
  lastExecutedAt: true,
  lastExecutionKey: true,
  createdAt: true,
});
export type InsertAutomation = z.infer<typeof insertAutomationSchema>;
export type Automation = typeof automationsTable.$inferSelect;
