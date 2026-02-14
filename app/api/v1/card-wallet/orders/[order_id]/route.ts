import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";
import { getOrderStatus } from "@/lib/card-wallet/purchase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ order_id: string }> }
) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { order_id } = await params;
    if (!order_id) {
      return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    }

    const wallets = await storage.crossmintGetWalletsByOwnerUid(user.uid);
    if (wallets.length === 0) {
      return NextResponse.json({ error: "No wallets found" }, { status: 404 });
    }

    const walletIds = wallets.map(w => w.id);

    let transaction = null;
    for (const wId of walletIds) {
      const txs = await storage.crossmintGetTransactionsByWalletId(wId);
      const found = txs.find(tx => tx.crossmintOrderId === order_id);
      if (found) {
        transaction = found;
        break;
      }
    }

    if (!transaction) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    let liveStatus: Record<string, unknown> | null = null;
    try {
      liveStatus = await getOrderStatus(order_id);

      const newOrderStatus = (liveStatus as any)?.phase || (liveStatus as any)?.status;
      const trackingData = (liveStatus as any)?.fulfillment?.tracking || (liveStatus as any)?.tracking;

      const updates: Record<string, unknown> = {};
      if (newOrderStatus && newOrderStatus !== transaction.orderStatus) {
        updates.orderStatus = newOrderStatus;
      }
      if (trackingData) {
        updates.trackingInfo = trackingData;
      }
      if (Object.keys(updates).length > 0) {
        await storage.crossmintUpdateTransaction(transaction.id, updates);
      }
    } catch (fetchErr) {
      console.warn("[Card Wallet] Failed to fetch live order status from CrossMint:", fetchErr);
    }

    const wallet = wallets.find(w => w.id === transaction!.walletId);

    return NextResponse.json({
      order: {
        id: transaction.id,
        crossmint_order_id: transaction.crossmintOrderId,
        type: transaction.type,
        amount_usdc: transaction.amountUsdc,
        amount_display: `$${(Number(transaction.amountUsdc) / 1_000_000).toFixed(2)}`,
        product_locator: transaction.productLocator,
        product_name: transaction.productName,
        quantity: transaction.quantity,
        status: transaction.status,
        order_status: liveStatus ? ((liveStatus as any)?.phase || (liveStatus as any)?.status || transaction.orderStatus) : transaction.orderStatus,
        shipping_address: transaction.shippingAddress,
        tracking_info: liveStatus ? ((liveStatus as any)?.fulfillment?.tracking || (liveStatus as any)?.tracking || transaction.trackingInfo) : transaction.trackingInfo,
        metadata: transaction.metadata,
        wallet_address: wallet?.address,
        bot_id: wallet?.botId,
        created_at: transaction.createdAt,
        updated_at: transaction.updatedAt,
      },
      crossmint_raw: liveStatus,
    });
  } catch (error) {
    console.error("GET /api/v1/card-wallet/orders/[order_id] error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
