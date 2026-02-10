import { storage } from "@/server/storage";
import { shouldRunObfuscation } from "./state-machine";
import { createObfuscationEvent } from "./events";
import { recordObfuscationEvent } from "./state-machine";
import type { Rail4Card } from "@/shared/schema";

export interface TickResult {
  botId: string;
  eventsCreated: number;
  reason: string;
}

export async function tickBot(botId: string): Promise<TickResult> {
  const rail4Card = await storage.getRail4CardByBotId(botId);
  if (!rail4Card || rail4Card.status !== "active") {
    return { botId, eventsCreated: 0, reason: "rail4_not_active" };
  }

  const decision = await shouldRunObfuscation(botId);
  if (!decision.shouldRun) {
    return { botId, eventsCreated: 0, reason: decision.reason };
  }

  let created = 0;
  for (let i = 0; i < decision.eventsToCreate; i++) {
    try {
      await createObfuscationEvent(botId, rail4Card);
      await recordObfuscationEvent(botId);
      created++;
    } catch (err) {
      console.error(`Failed to create obfuscation event for bot ${botId}:`, err);
      break;
    }
  }

  return { botId, eventsCreated: created, reason: decision.reason };
}

export async function tickAllActiveBots(): Promise<TickResult[]> {
  const results: TickResult[] = [];

  const allStates = await getAllActiveObfuscationBotIds();

  for (const botId of allStates) {
    try {
      const result = await tickBot(botId);
      results.push(result);
    } catch (err) {
      console.error(`Tick failed for bot ${botId}:`, err);
      results.push({ botId, eventsCreated: 0, reason: "tick_error" });
    }
  }

  return results;
}

async function getAllActiveObfuscationBotIds(): Promise<string[]> {
  const { db } = await import("@/server/db");
  const { obfuscationState } = await import("@/shared/schema");
  const { eq } = await import("drizzle-orm");

  const states = await db
    .select({ botId: obfuscationState.botId })
    .from(obfuscationState)
    .where(eq(obfuscationState.active, true));

  return states.map((s) => s.botId);
}
