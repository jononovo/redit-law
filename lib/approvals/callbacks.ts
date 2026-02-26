import { registerRailCallbacks } from "@/lib/approvals/service";
import { storage } from "@/server/storage";
import type { UnifiedApproval } from "@/shared/schema";
import "@/lib/rail2/approval-callback";
import "@/lib/rail4/approval-callback";

registerRailCallbacks("rail1", {
  async onApprove(approval: UnifiedApproval) {
    const approvalId = Number(approval.railRef);
    if (!isNaN(approvalId)) {
      await storage.privyDecideApproval(approvalId, "approved", approval.ownerUid);
    }
    console.log(`[Approvals] Rail 1 approved: privy_approval ${approval.railRef}`);
  },
  async onDeny(approval: UnifiedApproval) {
    const approvalId = Number(approval.railRef);
    if (!isNaN(approvalId)) {
      const privyApproval = await storage.privyGetApproval(approvalId);
      await storage.privyDecideApproval(approvalId, "rejected", approval.ownerUid);
      if (privyApproval?.transactionId) {
        await storage.privyUpdateTransactionStatus(privyApproval.transactionId, "failed");
      }
    }
    console.log(`[Approvals] Rail 1 denied: privy_approval ${approval.railRef}`);
  },
});

registerRailCallbacks("rail5", {
  async onApprove(approval: UnifiedApproval) {
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
  },
  async onDeny(approval: UnifiedApproval) {
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
  },
});
