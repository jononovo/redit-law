import { stripe } from "@/lib/stripe";

export async function createOnrampSession(params: {
  walletAddress: string;
  userEmail?: string;
  customerIp?: string;
  amountUsd?: number;
}): Promise<{ clientSecret: string; sessionId: string }> {
  const sessionParams: Record<string, any> = {
    wallet_addresses: {
      ethereum: params.walletAddress,
    },
    lock_wallet_address: true,
    destination_currencies: ["usdc"],
    destination_networks: ["base"],
    destination_network: "base",
    destination_currency: "usdc",
  };

  if (params.customerIp) {
    sessionParams.customer_ip_address = params.customerIp;
  }

  if (params.userEmail) {
    sessionParams.customer_information = {
      email: params.userEmail,
    };
  }

  if (params.amountUsd) {
    sessionParams.source_amount = String(Math.round(params.amountUsd * 100));
    sessionParams.source_currency = "usd";
  }

  const session = await (stripe as any).crypto.onrampSessions.create(sessionParams);

  return {
    clientSecret: session.client_secret,
    sessionId: session.id,
  };
}
