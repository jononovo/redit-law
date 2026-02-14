import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { storage } from "@/server/storage";
import { fireWebhook, type WebhookEventType } from "@/lib/webhooks";

const WEBHOOK_SECRET = process.env.CROSSMINT_WEBHOOK_SECRET;

const EVENT_STATUS_MAP: Record<string, { orderStatus: string; status?: string }> = {
  "orders.quote.created": { orderStatus: "quote" },
  "orders.quote.updated": { orderStatus: "quote" },
  "orders.payment.succeeded": { orderStatus: "processing" },
  "orders.payment.failed": { orderStatus: "payment_failed", status: "failed" },
  "orders.delivery.initiated": { orderStatus: "shipped" },
  "orders.delivery.completed": { orderStatus: "delivered" },
  "orders.delivery.failed": { orderStatus: "delivery_failed", status: "failed" },
};

const BOT_WEBHOOK_MAP: Record<string, WebhookEventType> = {
  "orders.delivery.initiated": "order.shipped",
  "orders.delivery.completed": "order.delivered",
  "orders.payment.failed": "order.failed",
  "orders.delivery.failed": "order.failed",
};

export async function POST(request: NextRequest) {
  if (!WEBHOOK_SECRET) {
    console.error("[Card Wallet Webhook] CROSSMINT_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 500 });
  }

  const body = await request.text();
  const headers: Record<string, string> = {};
  for (const key of ["svix-id", "svix-timestamp", "svix-signature"]) {
    const val = request.headers.get(key);
    if (!val) {
      console.warn(`[Card Wallet Webhook] Missing header: ${key}`);
      return NextResponse.json({ error: "missing_signature_headers" }, { status: 400 });
    }
    headers[key] = val;
  }

  let payload: Record<string, unknown>;
  try {
    const wh = new Webhook(WEBHOOK_SECRET);
    payload = wh.verify(body, headers) as Record<string, unknown>;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Card Wallet Webhook] Signature verification failed:", message);
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const eventType = payload.type as string;
  if (!eventType) {
    return NextResponse.json({ error: "missing_event_type" }, { status: 400 });
  }

  console.log(`[Card Wallet Webhook] Received event: ${eventType}`);

  const mapping = EVENT_STATUS_MAP[eventType];
  if (!mapping) {
    console.log(`[Card Wallet Webhook] Unhandled event type: ${eventType}, acknowledging`);
    return NextResponse.json({ received: true });
  }

  const eventPayload = payload.payload as Record<string, unknown> | undefined;
  const orderId = (eventPayload?.orderIdentifier || eventPayload?.orderId || payload.orderIdentifier || payload.orderId) as string | undefined;

  if (!orderId) {
    console.warn(`[Card Wallet Webhook] No order ID found in ${eventType} event`);
    return NextResponse.json({ received: true });
  }

  try {
    const transaction = await storage.crossmintGetTransactionByOrderId(orderId);
    if (!transaction) {
      console.warn(`[Card Wallet Webhook] No transaction found for order: ${orderId}`);
      return NextResponse.json({ received: true });
    }

    const updates: Record<string, unknown> = {
      orderStatus: mapping.orderStatus,
    };

    if (mapping.status) {
      updates.status = mapping.status;
    }

    const delivery = (eventPayload as Record<string, unknown>)?.lineItems;
    const lineItems = Array.isArray(delivery) ? delivery : [];
    const firstDelivery = lineItems[0]?.delivery as Record<string, unknown> | undefined;

    if (firstDelivery) {
      const trackingInfo: Record<string, string | undefined> = {};
      if (firstDelivery.carrier) trackingInfo.carrier = String(firstDelivery.carrier);
      if (firstDelivery.trackingNumber) trackingInfo.tracking_number = String(firstDelivery.trackingNumber);
      if (firstDelivery.trackingUrl) trackingInfo.tracking_url = String(firstDelivery.trackingUrl);
      if (firstDelivery.estimatedDelivery) trackingInfo.estimated_delivery = String(firstDelivery.estimatedDelivery);
      if (firstDelivery.txId) {
        trackingInfo.tracking_number = trackingInfo.tracking_number || String(firstDelivery.txId);
      }
      if (Object.keys(trackingInfo).length > 0) {
        updates.trackingInfo = { ...(transaction.trackingInfo || {}), ...trackingInfo };
      }
    }

    const existingMetadata = (transaction.metadata || {}) as Record<string, unknown>;
    updates.metadata = {
      ...existingMetadata,
      [`webhook_${eventType}`]: {
        received_at: new Date().toISOString(),
        raw: eventPayload,
      },
    };

    await storage.crossmintUpdateTransaction(transaction.id, updates);

    console.log(`[Card Wallet Webhook] Updated transaction ${transaction.id}: orderStatus=${mapping.orderStatus}${mapping.status ? `, status=${mapping.status}` : ""}`);

    const botEventType = BOT_WEBHOOK_MAP[eventType];
    if (botEventType) {
      const wallet = await storage.crossmintGetWalletById(transaction.walletId);
      if (wallet) {
        const bot = await storage.getBotByBotId(wallet.botId);
        if (bot) {
          fireWebhook(bot, botEventType, {
            transaction_id: transaction.id,
            order_id: orderId,
            order_status: mapping.orderStatus,
            product_name: transaction.productName,
            tracking: (updates.trackingInfo as Record<string, unknown>) || transaction.trackingInfo || null,
          }).catch(() => {});
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Card Wallet Webhook] Processing error:", error);
    return NextResponse.json({ error: "processing_error" }, { status: 500 });
  }
}
