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
import { homeUsersTable } from "./homeUsers";

export type DeviceType = "light" | "fan" | "ac" | "tv" | "other";
export type HomeRoom =
  | "Living Room"
  | "Bedroom"
  | "Kitchen"
  | "Bathroom"
  | "Office";

export const devicesTable = pgTable(
  "home_devices",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => homeUsersTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").$type<DeviceType>().notNull(),
    room: text("room").$type<HomeRoom>().notNull(),
    isOn: boolean("is_on").notNull().default(false),
    isOnline: boolean("is_online").notNull().default(true),
    brightness: integer("brightness"),
    fanSpeed: integer("fan_speed"),
    lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("home_devices_user_id_idx").on(table.userId)],
);

export const insertDeviceSchema = createInsertSchema(devicesTable).omit({
  id: true,
  lastUpdatedAt: true,
});
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devicesTable.$inferSelect;
