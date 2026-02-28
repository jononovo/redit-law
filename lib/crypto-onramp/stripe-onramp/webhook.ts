import { storage } from "@/server/storage";
import type { OnrampWebhookEvent } from "../types";
import crypto from "crypto";

function generateSaleId(): string {
  return `sale_${crypto.randomBytes(6).toString("hex")}`;
}

export async function handleStripeOnrampFulfillment(event: OnrampWebhookEvent): Promise<void> {
  const { walletAddress, amountUsdc, sessionId, metadata } = event;

  if (amountUsdc <= 0) {
    console.error("[Onramp Webhook] Amount was zero or invalid:", amountUsdc);
    return;
  }

  const targetWallet = await storage.privyGetWalletByAddress(walletAddress);

  if (!targetWallet) {
    console.error("[Onramp Webhook] No wallet found for address:", walletAddress);
    return;
  }

  const newBalance = targetWallet.balanceUsdc + amountUsdc;
  console.log("[Onramp Webhook] Crediting Rail 1 wallet:", {
    walletId: targetWallet.id,
    currentBalance: targetWallet.balanceUsdc,
    creditAmount: amountUsdc,
    newBalance,
  });

  await storage.privyUpdateWalletBalance(targetWallet.id, newBalance);

  const transaction = await storage.privyCreateTransaction({
    walletId: targetWallet.id,
    type: "deposit",
    amountUsdc,
    status: "confirmed",
    stripeSessionId: sessionId,
    balanceAfter: newBalance,
    metadata: metadata || {},
  });

  console.log("[Onramp Webhook] Balance updated and transaction created successfully");

  const checkoutPageId = metadata?.checkout_page_id as string | undefined;
  if (checkoutPageId) {
    console.log("[Onramp Webhook] Checkout payment detected:", { checkoutPageId, amountUsdc });

    try {
      const checkoutPage = await storage.getCheckoutPageById(checkoutPageId);
      if (!checkoutPage) {
        console.error("[Onramp Webhook] Checkout page not found:", checkoutPageId);
        return;
      }

      const saleId = generateSaleId();
      await storage.createSale({
        saleId,
        checkoutPageId,
        ownerUid: checkoutPage.ownerUid,
        amountUsdc,
        paymentMethod: "stripe_onramp",
        status: "confirmed",
        buyerType: "stripe_customer",
        buyerEmail: (metadata?.buyer_email as string) || null,
        buyerIp: (metadata?.buyer_ip as string) || null,
        stripeOnrampSessionId: sessionId,
        privyTransactionId: transaction.id,
        checkoutTitle: checkoutPage.title,
        checkoutDescription: checkoutPage.description,
        confirmedAt: new Date(),
      });

      await storage.incrementCheckoutPageStats(checkoutPageId, amountUsdc);
      console.log("[Onramp Webhook] Sale record created:", { saleId, checkoutPageId });
    } catch (err) {
      console.error("[Onramp Webhook] Failed to create sale record:", err);
    }
  }
}

export function parseStripeOnrampEvent(session: Record<string, unknown>): OnrampWebhookEvent | null {
  const transactionDetails = session.transaction_details as Record<string, unknown> | undefined;
  const walletAddress = (transactionDetails?.wallet_addresses as Record<string, string> | undefined)?.ethereum;
  const deliveredAmount = transactionDetails?.destination_amount;

  if (!walletAddress) {
    console.error("[Onramp Webhook] No wallet address in session");
    return null;
  }

  const amountUsdc = deliveredAmount ? Math.round(Number(deliveredAmount) * 1_000_000) : 0;

  const sessionMetadata = session.metadata as Record<string, unknown> | undefined;

  return {
    provider: "stripe",
    walletAddress,
    amountUsdc,
    sessionId: session.id as string,
    metadata: {
      source_currency: transactionDetails?.source_currency,
      source_amount: transactionDetails?.source_amount,
      ...sessionMetadata,
    },
  };
}
