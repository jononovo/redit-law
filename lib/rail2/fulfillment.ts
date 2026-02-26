import { storage } from "@/server/storage";
import { createPurchaseOrder } from "@/lib/rail2/orders/purchase";
import { fireWebhook } from "@/lib/webhooks";
import type { UnifiedApproval } from "@/shared/schema";

export async function fulfillRail2Approval(approval: UnifiedApproval): Promise<void> {
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
      shippingAddress: shippingAddr,
      quantity: transaction.quantity,
    });

    await storage.crossmintUpdateTransaction(cmApproval.transactionId, {
      crossmintOrderId: result.orderId,
      status: "confirmed",
      orderStatus: "processing",
    });

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

export async function fulfillRail2Denial(approval: UnifiedApproval): Promise<void> {
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
