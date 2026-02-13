export async function createOnrampSession(params: {
  walletAddress: string;
  userEmail?: string;
  customerIp?: string;
  amountUsd?: number;
}): Promise<{ clientSecret: string; sessionId: string; redirectUrl: string | null }> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is required");
  }

  const formData = new URLSearchParams();
  formData.append("wallet_addresses[base]", params.walletAddress);
  formData.append("lock_wallet_address", "true");
  formData.append("destination_currencies[]", "usdc");
  formData.append("destination_networks[]", "base");
  formData.append("destination_network", "base");
  formData.append("destination_currency", "usdc");

  if (params.customerIp) {
    formData.append("customer_ip_address", params.customerIp);
  }

  if (params.userEmail) {
    formData.append("customer_information[email]", params.userEmail);
  }

  if (params.amountUsd) {
    formData.append("source_amount", String(params.amountUsd));
    formData.append("source_currency", "usd");
  }

  const response = await fetch("https://api.stripe.com/v1/crypto/onramp_sessions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  const session = await response.json();

  if (!response.ok) {
    console.error("Stripe onramp session creation failed:", session);
    throw new Error(session.error?.message || "Failed to create onramp session");
  }

  return {
    clientSecret: session.client_secret,
    sessionId: session.id,
    redirectUrl: session.redirect_url || null,
  };
}
