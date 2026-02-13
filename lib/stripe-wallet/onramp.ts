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
  formData.append("wallet_addresses[ethereum]", params.walletAddress);
  formData.append("lock_wallet_address", "true");
  formData.append("destination_currencies[]", "usdc");
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

  console.log("[Stripe Onramp] Creating session with params:", {
    walletAddress: params.walletAddress,
    destinationNetwork: "base",
    destinationCurrency: "usdc",
    hasEmail: !!params.userEmail,
    hasIp: !!params.customerIp,
    amountUsd: params.amountUsd,
    formBody: formData.toString(),
  });

  const response = await fetch("https://api.stripe.com/v1/crypto/onramp_sessions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  const session = await response.json();

  console.log("[Stripe Onramp] Response status:", response.status);
  console.log("[Stripe Onramp] Response body:", JSON.stringify(session, null, 2));

  if (!response.ok) {
    console.error("[Stripe Onramp] Session creation FAILED:", {
      status: response.status,
      errorCode: session.error?.code,
      errorType: session.error?.type,
      errorMessage: session.error?.message,
      errorParam: session.error?.param,
      requestLogUrl: session.error?.request_log_url,
    });
    throw new Error(session.error?.message || "Failed to create onramp session");
  }

  console.log("[Stripe Onramp] Session created successfully:", {
    sessionId: session.id,
    status: session.status,
    hasClientSecret: !!session.client_secret,
    hasRedirectUrl: !!session.redirect_url,
  });

  return {
    clientSecret: session.client_secret,
    sessionId: session.id,
    redirectUrl: session.redirect_url || null,
  };
}
