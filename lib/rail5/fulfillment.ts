import { storage } from "@/server/storage";
import type { UnifiedApproval } from "@/shared/schema";

export async function fulfillRail5Approval(approval: UnifiedApproval): Promise<void> {
  const checkoutId = approval.railRef;
  await storage.updateRail5Checkout(checkoutId, { status: "approved", confirmedAt: new Date() });

  const checkout = await storage.getRail5CheckoutById(checkoutId);
  if (checkout) {
    const bot = await storage.getBotByBotId(checkout.botId);
    if (bot) {
      const { fireWebhook } = await import("@/lib/webhooks");
      fireWebhook(bot, "rail5.checkout.completed" as any, {
        checkout_id: checkoutId,
        status: "approved",
        merchant: checkout.merchantName,
        item: checkout.itemName,
        amount_cents: checkout.amountCents,
        message: "Owner approved. Proceed with key retrieval.",
      }).catch(() => {});
    }
  }

  console.log(`[Approvals] Rail 5 approved: checkout ${checkoutId}`);
}

export async function fulfillRail5Denial(approval: UnifiedApproval): Promise<void> {
  const checkoutId = approval.railRef;
  await storage.updateRail5Checkout(checkoutId, { status: "denied", confirmedAt: new Date() });

  const checkout = await storage.getRail5CheckoutById(checkoutId);
  if (checkout) {
    const bot = await storage.getBotByBotId(checkout.botId);
    if (bot) {
      const { fireWebhook } = await import("@/lib/webhooks");
      fireWebhook(bot, "rail5.checkout.failed" as any, {
        checkout_id: checkoutId,
        status: "denied",
        merchant: checkout.merchantName,
        item: checkout.itemName,
        amount_cents: checkout.amountCents,
        reason: "Owner denied the purchase",
      }).catch(() => {});
    }
  }

  console.log(`[Approvals] Rail 5 denied: checkout ${checkoutId}`);
}
