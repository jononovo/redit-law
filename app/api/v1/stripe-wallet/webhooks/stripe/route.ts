import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { storage } from "@/server/storage";

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET_ONRAMP || "";

export async function POST(request: NextRequest) {
  console.log("[Onramp Webhook] Received POST request");
  console.log("[Onramp Webhook] Secret configured:", !!STRIPE_WEBHOOK_SECRET);

  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    console.log("[Onramp Webhook] Has signature:", !!signature);
    console.log("[Onramp Webhook] Body length:", body.length);

    if (!signature || !STRIPE_WEBHOOK_SECRET) {
      console.error("[Onramp Webhook] Missing signature or secret", {
        hasSignature: !!signature,
        hasSecret: !!STRIPE_WEBHOOK_SECRET,
      });
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error("[Onramp Webhook] Signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    console.log("[Onramp Webhook] Event verified:", event.type);

    if ((event.type as string) === "crypto.onramp_session.updated") {
      const session = event.data.object as any;
      console.log("[Onramp Webhook] Session status:", session.status);
      console.log("[Onramp Webhook] Session ID:", session.id);

      if (session.status === "fulfillment_complete") {
        const walletAddress = session.transaction_details?.wallet_addresses?.ethereum;
        const deliveredAmount = session.transaction_details?.destination_amount;

        console.log("[Onramp Webhook] Fulfillment complete:", {
          walletAddress,
          deliveredAmount,
          sourceCurrency: session.transaction_details?.source_currency,
          sourceAmount: session.transaction_details?.source_amount,
        });

        if (!walletAddress) {
          console.error("[Onramp Webhook] No wallet address in session");
          return NextResponse.json({ received: true });
        }

        const targetWallet = await storage.privyGetWalletByAddress(walletAddress);
        console.log("[Onramp Webhook] Found wallet:", targetWallet ? `id=${targetWallet.id}` : "NOT FOUND");

        if (targetWallet) {
          const amountUsdc = deliveredAmount ? Math.round(Number(deliveredAmount) * 1_000_000) : 0;
          console.log("[Onramp Webhook] Crediting:", {
            walletId: targetWallet.id,
            currentBalance: targetWallet.balanceUsdc,
            creditAmount: amountUsdc,
            newBalance: targetWallet.balanceUsdc + amountUsdc,
          });

          if (amountUsdc > 0) {
            await storage.privyUpdateWalletBalance(targetWallet.id, targetWallet.balanceUsdc + amountUsdc);

            await storage.privyCreateTransaction({
              walletId: targetWallet.id,
              type: "deposit",
              amountUsdc: amountUsdc,
              status: "confirmed",
              stripeSessionId: session.id,
              balanceAfter: targetWallet.balanceUsdc + amountUsdc,
              metadata: {
                source_currency: session.transaction_details?.source_currency,
                source_amount: session.transaction_details?.source_amount,
              },
            });

            console.log("[Onramp Webhook] Balance updated and transaction created successfully");
          } else {
            console.error("[Onramp Webhook] Amount was zero or invalid:", deliveredAmount);
          }
        } else {
          console.error("[Onramp Webhook] No wallet found for address:", walletAddress);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Onramp Webhook] Unhandled error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
