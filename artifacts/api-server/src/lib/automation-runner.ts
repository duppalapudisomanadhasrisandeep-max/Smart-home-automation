import { and, eq } from "drizzle-orm";
import {
  activityTable,
  automationsTable,
  db,
  devicesTable,
  homeUsersTable,
} from "@workspace/db";
import type { AutomationDay } from "@workspace/db";
import { logger } from "./logger";

const RUN_EVERY_MS = 15_000;
let isRunning = false;

function getLocalScheduleTime(now: Date, timezone: string) {
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "short",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(now)
        .map(({ type, value }) => [type, value]),
    );
    return {
      day: parts.weekday as AutomationDay,
      time: `${parts.hour}:${parts.minute}`,
      key: `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`,
    };
  } catch (err) {
    logger.warn({ err, timezone }, "Invalid timezone for a smart-home account");
    return null;
  }
}

async function runDueAutomations(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  try {
    const now = new Date();
    const rules = await db
      .select({
        automation: automationsTable,
        timezone: homeUsersTable.timezone,
      })
      .from(automationsTable)
      .innerJoin(homeUsersTable, eq(automationsTable.userId, homeUsersTable.id))
      .where(eq(automationsTable.enabled, true));

    for (const { automation, timezone } of rules) {
      const local = getLocalScheduleTime(now, timezone);
      if (
        !local ||
        automation.time !== local.time ||
        !automation.days.includes(local.day) ||
        automation.lastExecutionKey === local.key
      ) {
        continue;
      }

      await db.transaction(async (tx) => {
        const [lockedRule] = await tx
          .select()
          .from(automationsTable)
          .where(eq(automationsTable.id, automation.id))
          .for("update");
        if (
          !lockedRule ||
          !lockedRule.enabled ||
          lockedRule.lastExecutionKey === local.key
        ) {
          return;
        }

        const targets =
          lockedRule.targetKind === "device" && lockedRule.targetDeviceId != null
            ? await tx
                .select()
                .from(devicesTable)
                .where(
                  and(
                    eq(devicesTable.id, lockedRule.targetDeviceId),
                    eq(devicesTable.userId, lockedRule.userId),
                  ),
                )
            : lockedRule.targetKind === "all_lights"
              ? await tx
                  .select()
                  .from(devicesTable)
                  .where(
                    and(
                      eq(devicesTable.userId, lockedRule.userId),
                      eq(devicesTable.type, "light"),
                    ),
                  )
              : [];

        for (const device of targets) {
          await tx
            .update(devicesTable)
            .set({
              isOn: lockedRule.action === "on",
              lastUpdatedAt: now,
            })
            .where(eq(devicesTable.id, device.id));
        }

        await tx.insert(activityTable).values({
          userId: lockedRule.userId,
          category: "automation",
          message:
            targets.length > 0
              ? `Schedule “${lockedRule.name}” turned ${lockedRule.action} ${targets.length === 1 ? targets[0]!.name : `${targets.length} devices`}`
              : `Schedule “${lockedRule.name}” skipped because no target devices were available`,
          deviceName: targets.length === 1 ? targets[0]!.name : null,
          room: targets.length === 1 ? targets[0]!.room : null,
        });

        await tx
          .update(automationsTable)
          .set({
            lastExecutedAt: now,
            lastExecutionKey: local.key,
          })
          .where(eq(automationsTable.id, lockedRule.id));
      });
    }
  } catch (err) {
    logger.error({ err }, "Smart-home automation runner failed");
  } finally {
    isRunning = false;
  }
}

export function startAutomationRunner(): void {
  const timer = setInterval(() => {
    void runDueAutomations();
  }, RUN_EVERY_MS);
  timer.unref();
  void runDueAutomations();
  logger.info({ intervalMs: RUN_EVERY_MS }, "Smart-home automation runner started");
}
