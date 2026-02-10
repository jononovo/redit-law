import { storage } from "@/server/storage";
import type { ObfuscationState } from "@/shared/schema";

export type ObfuscationPhase = "warmup" | "active" | "idle";

const WARMUP_DURATION_MS = 2 * 24 * 60 * 60 * 1000;
const WARMUP_EVENTS_PER_DAY = 2;
const TAPER_DELAY_MS = 24 * 60 * 60 * 1000;
const OBFUSCATION_RATIO = 3;

export async function initializeObfuscationState(botId: string): Promise<ObfuscationState> {
  const existing = await storage.getObfuscationState(botId);
  if (existing) {
    return storage.updateObfuscationState(botId, {
      phase: "warmup",
      active: true,
      activatedAt: new Date(),
      lastOrganicAt: null,
      lastObfuscationAt: null,
      organicCount: 0,
      obfuscationCount: 0,
    }) as Promise<ObfuscationState>;
  }

  return storage.createObfuscationState({
    botId,
    phase: "warmup",
    active: true,
  });
}

export async function recordOrganicEvent(botId: string): Promise<ObfuscationState | null> {
  const state = await storage.getObfuscationState(botId);
  if (!state) return null;

  const now = new Date();
  const newPhase: ObfuscationPhase = state.phase === "idle" ? "active" : state.phase === "warmup" ? "active" : "active";

  return storage.updateObfuscationState(botId, {
    phase: newPhase,
    active: true,
    lastOrganicAt: now,
    organicCount: state.organicCount + 1,
  });
}

export async function recordObfuscationEvent(botId: string): Promise<ObfuscationState | null> {
  const state = await storage.getObfuscationState(botId);
  if (!state) return null;

  return storage.updateObfuscationState(botId, {
    lastObfuscationAt: new Date(),
    obfuscationCount: state.obfuscationCount + 1,
  });
}

export interface ScheduleDecision {
  shouldRun: boolean;
  eventsToCreate: number;
  reason: string;
}

export async function shouldRunObfuscation(botId: string): Promise<ScheduleDecision> {
  const state = await storage.getObfuscationState(botId);
  if (!state || !state.active) {
    return { shouldRun: false, eventsToCreate: 0, reason: "no_active_state" };
  }

  const now = Date.now();

  if (state.phase === "warmup") {
    const activatedAt = state.activatedAt.getTime();
    const elapsed = now - activatedAt;

    if (elapsed > WARMUP_DURATION_MS) {
      await storage.updateObfuscationState(botId, { phase: "idle", active: true });
      return { shouldRun: false, eventsToCreate: 0, reason: "warmup_complete_now_idle" };
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const events = await storage.getObfuscationEventsByBotId(botId, 100);
    const todayEvents = events.filter(
      (e) => e.createdAt.getTime() >= todayStart.getTime()
    );

    if (todayEvents.length < WARMUP_EVENTS_PER_DAY) {
      const remaining = WARMUP_EVENTS_PER_DAY - todayEvents.length;
      return { shouldRun: true, eventsToCreate: remaining, reason: "warmup_daily_quota" };
    }

    return { shouldRun: false, eventsToCreate: 0, reason: "warmup_daily_quota_met" };
  }

  if (state.phase === "idle") {
    return { shouldRun: false, eventsToCreate: 0, reason: "idle_waiting_for_organic" };
  }

  if (state.phase === "active") {
    if (state.lastOrganicAt) {
      const timeSinceOrganic = now - state.lastOrganicAt.getTime();
      if (timeSinceOrganic > TAPER_DELAY_MS) {
        await storage.updateObfuscationState(botId, { phase: "idle", active: true });
        return { shouldRun: false, eventsToCreate: 0, reason: "tapered_to_idle" };
      }
    }

    const targetObfuscationCount = state.organicCount * OBFUSCATION_RATIO;
    const deficit = targetObfuscationCount - state.obfuscationCount;

    if (deficit > 0) {
      const eventsToCreate = Math.min(deficit, 3);
      return { shouldRun: true, eventsToCreate, reason: "ratio_deficit" };
    }

    return { shouldRun: false, eventsToCreate: 0, reason: "ratio_satisfied" };
  }

  return { shouldRun: false, eventsToCreate: 0, reason: "unknown_phase" };
}

export async function getObfuscationStatus(botId: string) {
  const state = await storage.getObfuscationState(botId);
  if (!state) {
    return {
      configured: false,
      phase: "none" as const,
      active: false,
      organicCount: 0,
      obfuscationCount: 0,
      lastOrganicAt: null,
      lastObfuscationAt: null,
      activatedAt: null,
    };
  }

  return {
    configured: true,
    phase: state.phase as ObfuscationPhase,
    active: state.active,
    organicCount: state.organicCount,
    obfuscationCount: state.obfuscationCount,
    lastOrganicAt: state.lastOrganicAt?.toISOString() || null,
    lastObfuscationAt: state.lastObfuscationAt?.toISOString() || null,
    activatedAt: state.activatedAt?.toISOString() || null,
  };
}
