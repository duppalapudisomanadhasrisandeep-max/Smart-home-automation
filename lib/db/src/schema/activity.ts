import { createInsertSchema } from "drizzle-zod";
import {
  index,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { homeUsersTable } from "./homeUsers";

export type ActivityCategory = "device" | "automation" | "system";

export const activityTable = pgTable(
  "home_activity",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => homeUsersTable.id, { onDelete: "cascade" }),
    category: text("category").$type<ActivityCategory>().notNull(),
    message: text("message").notNull(),
    deviceName: text("device_name"),
    room: text("room"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("home_activity_user_created_idx").on(table.userId, table.createdAt)],
);

export const insertActivitySchema = createInsertSchema(activityTable).omit({
  id: true,
  createdAt: true,
});
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activityTable.$inferSelect;
