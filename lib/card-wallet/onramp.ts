const CROSSMINT_API_BASE = process.env.CROSSMINT_ENV === "staging"
  ? "https://staging.crossmint.com/api/2022-06-09"
  : "https://www.crossmint.com/api/2022-06-09";

const USDC_CONTRACT_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

function getServerApiKey(): string {
  const key = process.env.CROSSMINT_SERVER_API_KEY;
  if (!key) throw new Error("CROSSMINT_SERVER_API_KEY is required");
  return key;
}

export async function createOnrampOrder(params: {
  walletAddress: string;
  ownerEmail: string;
  amountUsd?: number;
}): Promise<{
  orderId: string;
  clientSecret: string;
  order: Record<string, unknown>;
}> {
  const lineItems = [{
    tokenLocator: `base:${USDC_CONTRACT_ADDRESS}`,
    executionParameters: {
      mode: "exact-in" as const,
      ...(params.amountUsd ? { amount: String(params.amountUsd) } : {}),
    },
  }];

  const body = {
    lineItems,
    payment: {
      method: "checkoutcom-flow",
      receiptEmail: params.ownerEmail,
    },
    recipient: {
      walletAddress: params.walletAddress,
    },
  };

  console.log("[CrossMint Onramp] Creating order:", {
    walletAddress: params.walletAddress,
    hasEmail: !!params.ownerEmail,
    amountUsd: params.amountUsd,
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
    console.error("[CrossMint Onramp] Order creation failed:", data);
    throw new Error(data.message || data.error || "Failed to create onramp order");
  }

  console.log("[CrossMint Onramp] Order created:", {
    orderId: data.order?.orderId,
    hasClientSecret: !!data.clientSecret,
  });

  return {
    orderId: data.order?.orderId || data.orderId,
    clientSecret: data.clientSecret,
    order: data.order || data,
  };
}
