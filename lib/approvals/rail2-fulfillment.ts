import { registerRailCallbacks } from "@/lib/approvals/service";
import { storage } from "@/server/storage";
import { createPurchaseOrder } from "@/lib/procurement/crossmint-worldstore/purchase";
import { fireWebhook } from "@/lib/webhooks";
import { recordOrder } from "@/lib/orders/create";
import { toShippingAddressFields } from "@/lib/orders/address-utils";
import type { UnifiedApproval } from "@/shared/schema";
import type { ShippingAddress } from "@/lib/procurement/types";

async function fulfillRail2Approval(approval: UnifiedApproval): Promise<void> {
  const approvalId = Number(approval.railRef);
  if (isNaN(approvalId)) return;

  const cmApproval = await storage.crossmintGetApproval(approvalId);
  if (!cmApproval) {
    console.error(`[Rail2] Fulfill approve: crossmint_approval ${approvalId} not found`);
    return;
  }

  await storage.crossmintDecideApproval(approvalId, "approved", approval.ownerUid);

  const transaction = await storage.crossmintGetTransactionById(cmApproval.transactionId);
  if (!transaction) {
    console.error(`[Rail2] Fulfill approve: transaction ${cmApproval.transactionId} not found`);
    return;
  }

  const wallet = await storage.crossmintGetWalletById(cmApproval.walletId);
  if (!wallet) {
    await storage.crossmintUpdateTransaction(cmApproval.transactionId, { status: "failed" });
    console.error(`[Rail2] Fulfill approve: wallet ${cmApproval.walletId} not found`);
    return;
  }

  const [merchant, productId] = (transaction.productLocator || "").split(":");
  const shippingAddr = transaction.shippingAddress || cmApproval.shippingAddress;

  if (!merchant || !productId || !shippingAddr) {
    await storage.crossmintUpdateTransaction(cmApproval.transactionId, { status: "failed" });
    console.error(`[Rail2] Fulfill approve: missing purchase details for approval ${approvalId}`);
    return;
  }

  try {
    const owner = await storage.getOwnerByUid(approval.ownerUid);
    const bot = await storage.getBotByBotId(wallet.botId);

    const result = await createPurchaseOrder({
      merchant,
      productId,
      walletAddress: wallet.address,
      ownerEmail: owner?.email || approval.ownerEmail || "",
      shippingAddress: {
        name: (shippingAddr as any).name || "",
        line1: (shippingAddr as any).line1 || "",
        line2: (shippingAddr as any).line2,
        city: (shippingAddr as any).city || "",
        state: (shippingAddr as any).state || "",
        postalCode: (shippingAddr as any).postalCode || (shippingAddr as any).zip || "",
        country: (shippingAddr as any).country || "",
      },
      quantity: transaction.quantity,
    });

    await storage.crossmintUpdateTransaction(cmApproval.transactionId, {
      crossmintOrderId: result.orderId,
      status: "confirmed",
      orderStatus: "processing",
    });

    const [merchantName] = (transaction.productLocator || "").split(":");
    try {
      const convertedAddr = shippingAddr ? toShippingAddressFields(shippingAddr as any) : null;
      await recordOrder({
        ownerUid: approval.ownerUid,
        rail: "rail2",
        botId: wallet.botId,
        botName: bot?.botName ?? null,
        walletId: wallet.id,
        transactionId: transaction.id,
        externalOrderId: result.orderId,
        status: "processing",
        vendor: merchantName || null,
        productName: transaction.productName || null,
        productUrl: transaction.productLocator || null,
        sku: transaction.productLocator || null,
        quantity: transaction.quantity ?? 1,
        priceCents: result.pricing?.totalCents ?? (transaction.amountUsdc ? Math.round(transaction.amountUsdc / 10000) : null),
        priceCurrency: "USD",
        taxesCents: result.pricing?.taxCents ?? null,
        shippingPriceCents: result.pricing?.shippingCents ?? null,
        shippingType: "standard",
        shippingAddress: convertedAddr,
        metadata: { source: "rail2-fulfillment", approvalId },
      });
    } catch (orderErr) {
      console.error("[Rail2] Order record creation failed (non-fatal):", orderErr);
    }

    if (bot) {
      fireWebhook(bot, "purchase.approved", {
        approval_id: approvalId,
        transaction_id: transaction.id,
        order_id: result.orderId,
        product_name: transaction.productName,
        product_locator: transaction.productLocator,
        amount_usdc: transaction.amountUsdc,
      }).catch(() => {});
    }
  } catch (purchaseError) {
    console.error("[Rail2] Purchase order creation failed:", purchaseError);
    await storage.crossmintUpdateTransaction(cmApproval.transactionId, { status: "failed" });
    throw purchaseError;
  }

  console.log(`[Rail2] Approved: crossmint_approval ${approval.railRef}`);
}

async function fulfillRail2Denial(approval: UnifiedApproval): Promise<void> {
  const approvalId = Number(approval.railRef);
  if (isNaN(approvalId)) return;

  const cmApproval = await storage.crossmintGetApproval(approvalId);
  if (!cmApproval) {
    console.error(`[Rail2] Fulfill deny: crossmint_approval ${approvalId} not found`);
    return;
  }

  await storage.crossmintDecideApproval(approvalId, "denied", approval.ownerUid);
  await storage.crossmintUpdateTransaction(cmApproval.transactionId, { status: "failed" });

  const wallet = await storage.crossmintGetWalletById(cmApproval.walletId);
  if (wallet) {
    const bot = await storage.getBotByBotId(wallet.botId);
    if (bot) {
      fireWebhook(bot, "purchase.rejected", {
        approval_id: approvalId,
        product_name: cmApproval.productName,
        product_locator: cmApproval.productLocator,
      }).catch(() => {});
    }
  }

  console.log(`[Rail2] Denied: crossmint_approval ${approval.railRef}`);
}

registerRailCallbacks("rail2", {
  onApprove: fulfillRail2Approval,
  onDeny: fulfillRail2Denial,
});
