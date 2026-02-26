import { registerRailCallbacks } from "@/lib/approvals/service";
import { storage } from "@/server/storage";
import type { UnifiedApproval } from "@/shared/schema";
import "@/lib/rail2/approval-callback";

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

registerRailCallbacks("rail4", {
  async onApprove(approval: UnifiedApproval) {
    const confirmationId = approval.railRef;
    const conf = await storage.getCheckoutConfirmation(confirmationId);
    if (!conf) {
      console.error(`[Approvals] Rail 4 approve: confirmation ${confirmationId} not found`);
      return;
    }

    const bot = await storage.getBotByBotId(conf.botId);
    if (!bot) return;

    const wallet = await storage.getWalletByBotId(conf.botId);
    if (!wallet || wallet.isFrozen || wallet.balanceCents < conf.amountCents) {
      await storage.updateCheckoutConfirmationStatus(confirmationId, "denied");
      console.error(`[Approvals] Rail 4 approve failed: wallet issue for ${confirmationId}`);
      return;
    }

    const updated = await storage.debitWallet(wallet.id, conf.amountCents);
    if (!updated) return;

    await storage.createTransaction({
      walletId: wallet.id,
      type: "purchase",
      amountCents: conf.amountCents,
      description: `${conf.merchantName}: ${conf.itemName} (approved)`,
      balanceAfter: updated.balanceCents,
    });

    await storage.updateCheckoutConfirmationStatus(confirmationId, "approved");

    const card = await storage.getRail4CardByCardId(conf.cardId);
    if (card) {
      const { getWindowStart } = await import("@/lib/rail4");
      const permissions = card.profilePermissions ? JSON.parse(card.profilePermissions) : [];
      const profilePerm = permissions.find((p: { profile_index: number }) => p.profile_index === conf.profileIndex);
      if (profilePerm) {
        const windowStart = getWindowStart(profilePerm.allowance_duration);
        await storage.upsertProfileAllowanceUsage(conf.cardId, conf.profileIndex, windowStart, conf.amountCents, false);
      }
    }

    const { fireWebhook } = await import("@/lib/webhooks");
    fireWebhook(bot, "rail4.checkout.approved" as any, {
      confirmation_id: confirmationId,
      amount_usd: conf.amountCents / 100,
      merchant: conf.merchantName,
      item: conf.itemName,
      missing_digits: card?.missingDigitsValue || null,
      expiry_month: card?.expiryMonth || null,
      expiry_year: card?.expiryYear || null,
      new_balance_usd: updated.balanceCents / 100,
    }).catch(() => {});

    const { recordOrganicEvent } = await import("@/lib/obfuscation-engine/state-machine");
    if (card) {
      recordOrganicEvent(card.cardId).catch(() => {});
    }

    console.log(`[Approvals] Rail 4 approved: confirmation ${confirmationId}`);
  },
  async onDeny(approval: UnifiedApproval) {
    const confirmationId = approval.railRef;
    await storage.updateCheckoutConfirmationStatus(confirmationId, "denied");

    const conf = await storage.getCheckoutConfirmation(confirmationId);
    if (conf) {
      const bot = await storage.getBotByBotId(conf.botId);
      if (bot) {
        const { fireWebhook } = await import("@/lib/webhooks");
        fireWebhook(bot, "rail4.checkout.denied" as any, {
          confirmation_id: confirmationId,
          amount_usd: conf.amountCents / 100,
          merchant: conf.merchantName,
          item: conf.itemName,
        }).catch(() => {});
      }
    }

    console.log(`[Approvals] Rail 4 denied: confirmation ${confirmationId}`);
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
