import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";
import { crossmintApprovalDecideSchema } from "@/shared/schema";
import { isApprovalExpired } from "@/lib/approvals/lifecycle";
import { createPurchaseOrder } from "@/lib/card-wallet/purchase";
import { fireWebhook } from "@/lib/webhooks";

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = crossmintApprovalDecideSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
    }

    const { approval_id, decision } = parsed.data;

    const approval = await storage.crossmintGetApproval(approval_id);
    if (!approval) {
      return NextResponse.json({ error: "Approval not found" }, { status: 404 });
    }

    const wallet = await storage.crossmintGetWalletById(approval.walletId);
    if (!wallet || wallet.ownerUid !== user.uid) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const bot = await storage.getBotByBotId(wallet.botId);

    if (isApprovalExpired(approval)) {
      await storage.crossmintDecideApproval(approval_id, "expired", user.uid);
      await storage.crossmintUpdateTransaction(approval.transactionId, { status: "failed" });
      if (bot) {
        fireWebhook(bot, "purchase.expired", {
          approval_id,
          product_name: approval.productName,
          product_locator: approval.productLocator,
        }).catch(() => {});
      }
      return NextResponse.json({ error: "Approval has expired" }, { status: 410 });
    }

    if (decision === "reject") {
      const updated = await storage.crossmintDecideApproval(approval_id, "rejected", user.uid);
      await storage.crossmintUpdateTransaction(approval.transactionId, { status: "failed" });
      if (bot) {
        fireWebhook(bot, "purchase.rejected", {
          approval_id,
          product_name: approval.productName,
          product_locator: approval.productLocator,
        }).catch(() => {});
      }
      return NextResponse.json({
        approval: { id: updated?.id, status: updated?.status, decided_at: updated?.decidedAt },
      });
    }

    const updatedApproval = await storage.crossmintDecideApproval(approval_id, "approved", user.uid);

    const transaction = await storage.crossmintGetTransactionById(approval.transactionId);
    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 500 });
    }

    const [merchant, productId] = (transaction.productLocator || "").split(":");
    const shippingAddr = transaction.shippingAddress || approval.shippingAddress;

    if (!merchant || !productId || !shippingAddr) {
      await storage.crossmintUpdateTransaction(approval.transactionId, { status: "failed" });
      return NextResponse.json({ error: "Missing purchase details" }, { status: 400 });
    }

    try {
      const ownerEmail = user.email || bot?.ownerEmail || "";

      const result = await createPurchaseOrder({
        merchant,
        productId,
        walletAddress: wallet.address,
        ownerEmail,
        shippingAddress: shippingAddr,
        quantity: transaction.quantity,
      });

      await storage.crossmintUpdateTransaction(approval.transactionId, {
        crossmintOrderId: result.orderId,
        status: "confirmed",
        orderStatus: "processing",
      });

      if (bot) {
        fireWebhook(bot, "purchase.approved", {
          approval_id,
          transaction_id: transaction.id,
          order_id: result.orderId,
          product_name: transaction.productName,
          product_locator: transaction.productLocator,
          amount_usdc: transaction.amountUsdc,
        }).catch(() => {});
      }

      return NextResponse.json({
        approval: { id: updatedApproval?.id, status: updatedApproval?.status, decided_at: updatedApproval?.decidedAt },
        order_id: result.orderId,
      });
    } catch (purchaseError) {
      console.error("[Card Wallet] Purchase order creation failed:", purchaseError);
      await storage.crossmintUpdateTransaction(approval.transactionId, { status: "failed" });
      return NextResponse.json({ error: "Failed to create purchase order" }, { status: 500 });
    }
  } catch (error) {
    console.error("POST /api/v1/card-wallet/approvals/decide error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
