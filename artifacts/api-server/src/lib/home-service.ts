import { db } from "@workspace/db";
import {
  activityTable,
  devicesTable,
  homeUsersTable,
  type ActivityCategory,
  type DeviceType,
  type HomeRoom,
} from "@workspace/db";
import { eq } from "drizzle-orm";

const demoDevices: Array<{
  name: string;
  type: DeviceType;
  room: HomeRoom;
  isOn: boolean;
  brightness: number | null;
  fanSpeed: number | null;
}> = [
  {
    name: "Ceiling Lights",
    type: "light",
    room: "Living Room",
    isOn: true,
    brightness: 82,
    fanSpeed: null,
  },
  {
    name: "Bedside Lamp",
    type: "light",
    room: "Bedroom",
    isOn: false,
    brightness: 65,
    fanSpeed: null,
  },
  {
    name: "Ceiling Fan",
    type: "fan",
    room: "Living Room",
    isOn: true,
    brightness: null,
    fanSpeed: 2,
  },
  {
    name: "Air Conditioner",
    type: "ac",
    room: "Bedroom",
    isOn: false,
    brightness: null,
    fanSpeed: null,
  },
  {
    name: "Smart TV",
    type: "tv",
    room: "Living Room",
    isOn: false,
    brightness: null,
    fanSpeed: null,
  },
  {
    name: "Air Purifier",
    type: "other",
    room: "Kitchen",
    isOn: true,
    brightness: null,
    fanSpeed: null,
  },
];

export async function ensureHomeUser(userId: string) {
  return db.transaction(async (tx) => {
    await tx.insert(homeUsersTable).values({ id: userId }).onConflictDoNothing();

    const [user] = await tx
      .select()
      .from(homeUsersTable)
      .where(eq(homeUsersTable.id, userId))
      .for("update");

    if (!user) {
      throw new Error("Could not initialize the signed-in account");
    }

    if (!user.demoSeeded) {
      await tx.insert(devicesTable).values(
        demoDevices.map((device) => ({
          ...device,
          userId,
          isOnline: true,
        })),
      );
      await tx.insert(activityTable).values({
        userId,
        category: "system",
        message: "Your smart home is ready with 6 sample devices.",
      });
      await tx
        .update(homeUsersTable)
        .set({ demoSeeded: true })
        .where(eq(homeUsersTable.id, userId));
    }

    return user;
  });
}

export async function recordActivity(
  userId: string,
  category: ActivityCategory,
  message: string,
  deviceName: string | null = null,
  room: string | null = null,
) {
  const [activity] = await db
    .insert(activityTable)
    .values({ userId, category, message, deviceName, room })
    .returning();

  return activity;
}
