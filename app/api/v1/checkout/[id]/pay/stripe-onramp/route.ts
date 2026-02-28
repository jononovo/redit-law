import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { createStripeOnrampSession } from "@/lib/crypto-onramp/stripe-onramp/session";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const page = await storage.getCheckoutPageById(id);
    if (!page || page.status !== "active") {
      return NextResponse.json({ error: "Checkout page not found" }, { status: 404 });
    }

    if (page.expiresAt && new Date(page.expiresAt) < new Date()) {
      return NextResponse.json({ error: "Checkout page has expired" }, { status: 410 });
    }

    if (!page.allowedMethods.includes("stripe_onramp")) {
      return NextResponse.json({ error: "Stripe onramp payments are not enabled for this checkout page" }, { status: 400 });
    }

    let amountUsd: number | undefined;
    if (page.amountLocked && page.amountUsdc) {
      amountUsd = page.amountUsdc / 1_000_000;
    } else {
      const body = await request.json().catch(() => ({}));
      if (body.amount_usd && typeof body.amount_usd === "number" && body.amount_usd > 0) {
        amountUsd = body.amount_usd;
      }
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
    const userAgent = request.headers.get("user-agent") || undefined;

    const { clientSecret, sessionId, redirectUrl } = await createStripeOnrampSession({
      walletAddress: page.walletAddress,
      customerIp: ip,
      amountUsd,
      lockAmount: page.amountLocked,
      metadata: {
        checkout_page_id: page.checkoutPageId,
        ...(ip ? { buyer_ip: ip } : {}),
        ...(userAgent ? { buyer_user_agent: userAgent } : {}),
      },
    });

    return NextResponse.json({
      client_secret: clientSecret,
      session_id: sessionId,
      redirect_url: redirectUrl,
      wallet_address: page.walletAddress,
      amount_usd: amountUsd,
    });
  } catch (error) {
    console.error("POST /api/v1/checkout/[id]/pay/stripe-onramp error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
