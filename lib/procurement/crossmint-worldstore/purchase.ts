import { crossmintFetch } from "@/lib/rail2/client";
import type { ShippingAddress, PurchaseResult } from "../types";

export type { ShippingAddress };

export async function createPurchaseOrder(params: {
  merchant: string;
  productId: string;
  walletAddress: string;
  ownerEmail: string;
  shippingAddress: ShippingAddress;
  quantity?: number;
}): Promise<PurchaseResult> {
  const productLocator = `${params.merchant}:${params.productId}`;

  const lineItems = [];
  const qty = params.quantity || 1;
  for (let i = 0; i < qty; i++) {
    lineItems.push({ productLocator });
  }

  const body = {
    lineItems,
    payment: {
      method: "crypto",
      currency: "usdc",
      payerAddress: params.walletAddress,
    },
    recipient: {
      email: params.ownerEmail,
      physicalAddress: {
        name: params.shippingAddress.name,
        line1: params.shippingAddress.line1,
        ...(params.shippingAddress.line2 ? { line2: params.shippingAddress.line2 } : {}),
        city: params.shippingAddress.city,
        state: params.shippingAddress.state,
        postalCode: params.shippingAddress.zip,
        country: params.shippingAddress.country,
      },
    },
  };

  console.log("[Procurement] Creating order:", {
    provider: "crossmint-worldstore",
    productLocator,
    walletAddress: params.walletAddress,
    quantity: qty,
  });

  const response = await crossmintFetch("/orders", {
    method: "POST",
    body: JSON.stringify(body),
  }, "orders");

  const data = await response.json();

  if (!response.ok) {
    console.error("[Procurement] Order creation failed:", data);
    throw new Error(data.message || data.error || "Failed to create purchase order");
  }

  console.log("[Procurement] Order created:", {
    orderId: data.order?.orderId || data.orderId,
  });

  return {
    orderId: data.order?.orderId || data.orderId,
    order: data.order || data,
  };
}

export async function getOrderStatus(orderId: string): Promise<Record<string, unknown>> {
  const response = await crossmintFetch(`/orders/${orderId}`, {}, "orders");

  const data = await response.json();

  if (!response.ok) {
    console.error("[Procurement] Order status query failed:", data);
    throw new Error(data.message || "Failed to query order status");
  }

  return data;
}
