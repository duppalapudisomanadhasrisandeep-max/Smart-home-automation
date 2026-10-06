import { and, desc, eq, inArray } from "drizzle-orm";
import { Router, type IRouter, type Response } from "express";
import {
  CreateAutomationBody,
  CreateAutomationResponse,
  CreateDeviceBody,
  CreateDeviceResponse,
  DeleteAutomationParams,
  DeleteAutomationResponse,
  DeleteDeviceParams,
  DeleteDeviceResponse,
  GetDashboardResponse,
  GetMeResponse,
  ListActivityQueryParams,
  ListActivityResponse,
  ListAutomationsResponse,
  ListDevicesQueryParams,
  ListDevicesResponse,
  UpdateAutomationBody,
  UpdateAutomationParams,
  UpdateAutomationResponse,
  UpdateDeviceBody,
  UpdateDeviceParams,
  UpdateDeviceResponse,
} from "@workspace/api-zod";
import {
  activityTable,
  automationsTable,
  db,
  devicesTable,
  type HomeRoom,
} from "@workspace/db";
import { currentUserId, requireAuth } from "../middlewares/requireAuth";
import { ensureHomeUser, recordActivity } from "../lib/home-service";

const router: IRouter = Router();
router.use(requireAuth);

const badRequest = (res: Response, message: string) => {
  res.status(400).json({ error: message });
};

router.get("/me", async (req, res): Promise<void> => {
  const user = await ensureHomeUser(currentUserId(req));
  res.json(
    GetMeResponse.parse({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      timezone: user.timezone,
      createdAt: user.createdAt,
    }),
  );
});

router.get("/dashboard", async (req, res): Promise<void> => {
  const userId = currentUserId(req);
  await ensureHomeUser(userId);
  const devices = await db
    .select()
    .from(devicesTable)
    .where(eq(devicesTable.userId, userId));

  const wattsByType = { light: 9, fan: 55, ac: 900, tv: 90, other: 100 };
  const estimatedEnergyKwh = devices.reduce((total, device) => {
    if (!device.isOn) return total;
    return total + (wattsByType[device.type] * 4) / 1000;
  }, 0);
  const rooms = new Set(devices.map((device) => device.room));

  res.json(
    GetDashboardResponse.parse({
      totalDevices: devices.length,
      activeDevices: devices.filter((device) => device.isOnline).length,
      devicesOn: devices.filter((device) => device.isOn).length,
      estimatedEnergyKwh: Number(estimatedEnergyKwh.toFixed(2)),
      rooms: rooms.size,
    }),
  );
});

router.get("/devices", async (req, res): Promise<void> => {
  const userId = currentUserId(req);
  await ensureHomeUser(userId);
  const query = ListDevicesQueryParams.safeParse(req.query);
  if (!query.success) {
    badRequest(res, query.error.message);
    return;
  }

  const conditions = [eq(devicesTable.userId, userId)];
  if (query.data.room) {
    conditions.push(eq(devicesTable.room, query.data.room as HomeRoom));
  }
  const devices = await db
    .select()
    .from(devicesTable)
    .where(and(...conditions))
    .orderBy(devicesTable.room, devicesTable.name);
  res.json(ListDevicesResponse.parse(devices));
});

router.post("/devices", async (req, res): Promise<void> => {
  const userId = currentUserId(req);
  await ensureHomeUser(userId);
  const parsed = CreateDeviceBody.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.message);
    return;
  }

  const input = parsed.data;
  if (!input.name.trim()) {
    badRequest(res, "Device name cannot be blank.");
    return;
  }
  const [device] = await db
    .insert(devicesTable)
    .values({
      userId,
      name: input.name.trim(),
      type: input.type,
      room: input.room,
      isOn: input.isOn ?? false,
      isOnline: input.isOnline ?? true,
      brightness:
        input.type === "light" ? (input.brightness ?? 75) : null,
      fanSpeed: input.type === "fan" ? (input.fanSpeed ?? 3) : null,
    })
    .returning();

  await recordActivity(
    userId,
    "device",
    `Added ${device.name}`,
    device.name,
    device.room,
  );
  res.status(201).json(CreateDeviceResponse.parse(device));
});

router.patch("/devices/:id", async (req, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = UpdateDeviceParams.safeParse(req.params);
  if (!params.success) {
    badRequest(res, params.error.message);
    return;
  }
  const parsed = UpdateDeviceBody.safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    badRequest(res, parsed.success ? "At least one field is required." : parsed.error.message);
    return;
  }

  const [current] = await db
    .select()
    .from(devicesTable)
    .where(and(eq(devicesTable.id, params.data.id), eq(devicesTable.userId, userId)));
  if (!current) {
    res.status(404).json({ error: "Device not found" });
    return;
  }

  const input = parsed.data;
  if (input.name !== undefined && !input.name.trim()) {
    badRequest(res, "Device name cannot be blank.");
    return;
  }
  const nextType = input.type ?? current.type;
  const updates: Partial<typeof devicesTable.$inferInsert> = { ...input };

  if (nextType !== "light") {
    updates.brightness = null;
  } else if (input.type === "light" && input.brightness === undefined) {
    updates.brightness = current.brightness ?? 75;
  }
  if (nextType !== "fan") {
    updates.fanSpeed = null;
  } else if (input.type === "fan" && input.fanSpeed === undefined) {
    updates.fanSpeed = current.fanSpeed ?? 3;
  }

  const [device] = await db
    .update(devicesTable)
    .set({ ...updates, lastUpdatedAt: new Date() })
    .where(and(eq(devicesTable.id, params.data.id), eq(devicesTable.userId, userId)))
    .returning();

  let message = `Updated ${device.name}`;
  if (input.isOn !== undefined && input.isOn !== current.isOn) {
    message = `${device.name} turned ${device.isOn ? "on" : "off"}`;
  } else if (
    input.brightness !== undefined &&
    input.brightness !== current.brightness
  ) {
    message = `${device.name} brightness set to ${device.brightness ?? 0}%`;
  } else if (input.fanSpeed !== undefined && input.fanSpeed !== current.fanSpeed) {
    message = `${device.name} speed set to ${device.fanSpeed ?? 1}`;
  } else if (input.isOnline !== undefined && input.isOnline !== current.isOnline) {
    message = `${device.name} is now ${device.isOnline ? "online" : "offline"}`;
  } else if (input.room !== undefined && input.room !== current.room) {
    message = `${device.name} moved to ${device.room}`;
  }
  await recordActivity(userId, "device", message, device.name, device.room);
  res.json(UpdateDeviceResponse.parse(device));
});

router.delete("/devices/:id", async (req, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = DeleteDeviceParams.safeParse(req.params);
  if (!params.success) {
    badRequest(res, params.error.message);
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [device] = await tx
      .select()
      .from(devicesTable)
      .where(and(eq(devicesTable.id, params.data.id), eq(devicesTable.userId, userId)));
    if (!device) return null;

    const affectedRules = await tx
      .select()
      .from(automationsTable)
      .where(
        and(
          eq(automationsTable.userId, userId),
          eq(automationsTable.targetDeviceId, device.id),
        ),
      );
    if (affectedRules.length) {
      await tx
        .update(automationsTable)
        .set({ enabled: false, targetDeviceId: null })
        .where(inArray(automationsTable.id, affectedRules.map((rule) => rule.id)));
      await tx.insert(activityTable).values(
        affectedRules.map((rule) => ({
          userId,
          category: "automation" as const,
          message: `Disabled “${rule.name}” because ${device.name} was removed`,
          deviceName: device.name,
          room: device.room,
        })),
      );
    }

    await tx.delete(devicesTable).where(eq(devicesTable.id, device.id));
    await tx.insert(activityTable).values({
      userId,
      category: "device",
      message: `Removed ${device.name}`,
      deviceName: device.name,
      room: device.room,
    });
    return device;
  });

  if (!result) {
    res.status(404).json({ error: "Device not found" });
    return;
  }
  DeleteDeviceResponse.parse(undefined);
  res.sendStatus(204);
});

router.get("/automations", async (req, res): Promise<void> => {
  const userId = currentUserId(req);
  await ensureHomeUser(userId);
  const automations = await db
    .select()
    .from(automationsTable)
    .where(eq(automationsTable.userId, userId))
    .orderBy(automationsTable.time, automationsTable.name);
  res.json(ListAutomationsResponse.parse(automations));
});

async function isOwnedDevice(userId: string, deviceId: number): Promise<boolean> {
  const [device] = await db
    .select({ id: devicesTable.id })
    .from(devicesTable)
    .where(and(eq(devicesTable.id, deviceId), eq(devicesTable.userId, userId)));
  return Boolean(device);
}

router.post("/automations", async (req, res): Promise<void> => {
  const userId = currentUserId(req);
  await ensureHomeUser(userId);
  const parsed = CreateAutomationBody.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.message);
    return;
  }
  const input = parsed.data;
  if (!input.name.trim()) {
    badRequest(res, "Routine name cannot be blank.");
    return;
  }
  if (
    input.targetKind === "device" &&
    (input.targetDeviceId == null ||
      !(await isOwnedDevice(userId, input.targetDeviceId)))
  ) {
    badRequest(res, "Choose a device in your home for this rule.");
    return;
  }

  const [automation] = await db
    .insert(automationsTable)
    .values({
      userId,
      name: input.name.trim(),
      targetKind: input.targetKind,
      targetDeviceId: input.targetKind === "device" ? input.targetDeviceId ?? null : null,
      time: input.time,
      days: input.days,
      action: input.action,
      enabled: input.enabled ?? true,
    })
    .returning();
  await recordActivity(userId, "automation", `Created schedule “${automation.name}”`);
  res.status(201).json(CreateAutomationResponse.parse(automation));
});

router.patch("/automations/:id", async (req, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = UpdateAutomationParams.safeParse(req.params);
  if (!params.success) {
    badRequest(res, params.error.message);
    return;
  }
  const parsed = UpdateAutomationBody.safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    badRequest(res, parsed.success ? "At least one field is required." : parsed.error.message);
    return;
  }

  const [current] = await db
    .select()
    .from(automationsTable)
    .where(and(eq(automationsTable.id, params.data.id), eq(automationsTable.userId, userId)));
  if (!current) {
    res.status(404).json({ error: "Automation not found" });
    return;
  }

  const input = parsed.data;
  if (input.name !== undefined && !input.name.trim()) {
    badRequest(res, "Routine name cannot be blank.");
    return;
  }
  const targetKind = input.targetKind ?? current.targetKind;
  const targetDeviceId =
    targetKind === "all_lights"
      ? null
      : input.targetDeviceId !== undefined
        ? input.targetDeviceId
        : current.targetDeviceId;
  if (
    targetKind === "device" &&
    (targetDeviceId == null || !(await isOwnedDevice(userId, targetDeviceId)))
  ) {
    badRequest(res, "Choose a device in your home for this rule.");
    return;
  }

  const [automation] = await db
    .update(automationsTable)
    .set({ ...input, targetKind, targetDeviceId })
    .where(and(eq(automationsTable.id, params.data.id), eq(automationsTable.userId, userId)))
    .returning();
  await recordActivity(
    userId,
    "automation",
    input.enabled === undefined
      ? `Updated schedule “${automation.name}”`
      : `${automation.enabled ? "Enabled" : "Paused"} schedule “${automation.name}”`,
  );
  res.json(UpdateAutomationResponse.parse(automation));
});

router.delete("/automations/:id", async (req, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = DeleteAutomationParams.safeParse(req.params);
  if (!params.success) {
    badRequest(res, params.error.message);
    return;
  }
  const [automation] = await db
    .delete(automationsTable)
    .where(and(eq(automationsTable.id, params.data.id), eq(automationsTable.userId, userId)))
    .returning();
  if (!automation) {
    res.status(404).json({ error: "Automation not found" });
    return;
  }
  await recordActivity(userId, "automation", `Deleted schedule “${automation.name}”`);
  DeleteAutomationResponse.parse(undefined);
  res.sendStatus(204);
});

router.get("/activity", async (req, res): Promise<void> => {
  const userId = currentUserId(req);
  await ensureHomeUser(userId);
  const query = ListActivityQueryParams.safeParse(req.query);
  if (!query.success) {
    badRequest(res, query.error.message);
    return;
  }
  const activity = await db
    .select()
    .from(activityTable)
    .where(eq(activityTable.userId, userId))
    .orderBy(desc(activityTable.createdAt), desc(activityTable.id))
    .limit(query.data.limit ?? 50);
  res.json(ListActivityResponse.parse(activity));
});

export default router;
