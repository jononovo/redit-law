import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { storage } from "@/server/storage";

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature || !STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    if ((event.type as string) === "crypto.onramp_session_updated") {
      const session = event.data.object as any;

      if (session.status === "fulfillment_complete") {
        const walletAddress = session.transaction_details?.wallet_addresses?.ethereum;
        if (!walletAddress) {
          console.error("No wallet address in onramp session");
          return NextResponse.json({ received: true });
        }

        const targetWallet = await storage.privyGetWalletByAddress(walletAddress);

        if (targetWallet) {
          const deliveredAmount = session.transaction_details?.destination_amount;
          const amountUsdc = deliveredAmount ? Math.round(Number(deliveredAmount) * 1_000_000) : 0;

          if (amountUsdc > 0) {
            await storage.privyUpdateWalletBalance(targetWallet.id, targetWallet.balanceUsdc + amountUsdc);

            await storage.privyCreateTransaction({
              walletId: targetWallet.id,
              type: "deposit",
              amountUsdc: amountUsdc,
              status: "confirmed",
              stripeSessionId: session.id,
              metadata: {
                source_currency: session.transaction_details?.source_currency,
                source_amount: session.transaction_details?.source_amount,
              },
            });
          }
        } else {
          console.error("No wallet found for onramp address:", walletAddress);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("POST /api/v1/stripe-wallet/webhooks/stripe error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
