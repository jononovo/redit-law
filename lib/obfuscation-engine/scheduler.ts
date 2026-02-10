import { storage } from "@/server/storage";
import { shouldRunObfuscation } from "./state-machine";
import { createObfuscationEvent } from "./events";

export async function tickBot(botId: string): Promise<number> {
  const card = await storage.getRail4CardByBotId(botId);
  if (!card || card.status !== "active") return 0;

  const count = await shouldRunObfuscation(botId);
  if (count <= 0) return 0;

  let created = 0;
  for (let i = 0; i < count; i++) {
    await createObfuscationEvent(botId, card.realProfileIndex);
    created++;
  }

  return created;
}

export async function tickAllActiveBots(): Promise<{ processed: number; eventsCreated: number; details: Array<{ botId: string; events: number }> }> {
  const activeStates = await storage.getActiveObfuscationStates();
  let processed = 0;
  let eventsCreated = 0;
  const details: Array<{ botId: string; events: number }> = [];

  for (const state of activeStates) {
    const events = await tickBot(state.botId);
    processed++;
    eventsCreated += events;
    if (events > 0) {
      details.push({ botId: state.botId, events });
    }
  }

  return { processed, eventsCreated, details };
}
