const CROSSMINT_API_BASE = process.env.CROSSMINT_ENV === "staging"
  ? "https://staging.crossmint.com/api/2022-06-09"
  : "https://www.crossmint.com/api/2022-06-09";

function getServerApiKey(): string {
  const key = process.env.CROSSMINT_SERVER_API_KEY;
  if (!key) throw new Error("CROSSMINT_SERVER_API_KEY is required");
  return key;
}

export interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export async function createPurchaseOrder(params: {
  merchant: string;
  productId: string;
  walletAddress: string;
  ownerEmail: string;
  shippingAddress: ShippingAddress;
  quantity?: number;
}): Promise<{
  orderId: string;
  order: Record<string, unknown>;
}> {
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

  console.log("[CrossMint Purchase] Creating order:", {
    productLocator,
    walletAddress: params.walletAddress,
    quantity: qty,
  });

  const response = await fetch(`${CROSSMINT_API_BASE}/orders`, {
    method: "POST",
    headers: {
      "X-API-KEY": getServerApiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("[CrossMint Purchase] Order creation failed:", data);
    throw new Error(data.message || data.error || "Failed to create purchase order");
  }

  console.log("[CrossMint Purchase] Order created:", {
    orderId: data.order?.orderId || data.orderId,
  });

  return {
    orderId: data.order?.orderId || data.orderId,
    order: data.order || data,
  };
}

export async function getOrderStatus(orderId: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${CROSSMINT_API_BASE}/orders/${orderId}`, {
    headers: {
      "X-API-KEY": getServerApiKey(),
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("[CrossMint Purchase] Order status query failed:", data);
    throw new Error(data.message || "Failed to query order status");
  }

  return data;
}
