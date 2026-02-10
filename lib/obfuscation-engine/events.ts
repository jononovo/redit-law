import { storage } from "@/server/storage";
import { generateObfuscationPurchase, pickRandomProfileIndex } from "@/lib/obfuscation-merchants/generator";
import type { ObfuscationEvent, Rail4Card } from "@/shared/schema";

export interface CreatedObfuscationEvent {
  event: ObfuscationEvent;
  merchantUrl: string;
}

export async function createObfuscationEvent(
  botId: string,
  rail4Card: Rail4Card
): Promise<CreatedObfuscationEvent> {
  const profileIndex = pickRandomProfileIndex(rail4Card.realProfileIndex);
  const purchase = generateObfuscationPurchase();

  const event = await storage.createObfuscationEvent({
    botId,
    profileIndex,
    merchantName: purchase.merchantName,
    merchantSlug: purchase.merchantSlug,
    itemName: purchase.itemName,
    amountCents: purchase.amountCents,
    status: "pending",
  });

  return {
    event,
    merchantUrl: `/merchant/${purchase.merchantSlug}`,
  };
}

export async function completeEvent(eventId: number): Promise<ObfuscationEvent | null> {
  return storage.completeObfuscationEvent(eventId, new Date());
}

export async function getEventForVerification(
  eventId: number,
  botId: string
): Promise<ObfuscationEvent | null> {
  const events = await storage.getPendingObfuscationEvents(botId);
  return events.find((e) => e.id === eventId) || null;
}

export function getFakeProfileData(rail4Card: Rail4Card, profileIndex: number) {
  const fakeProfiles = JSON.parse(rail4Card.fakeProfilesJson);
  const profile = fakeProfiles.find((p: any) => p.profileIndex === profileIndex);
  if (!profile) return null;

  return {
    missingDigits: profile.fakeMissingDigits,
    expiryMonth: profile.fakeExpiryMonth,
    expiryYear: profile.fakeExpiryYear,
  };
}
