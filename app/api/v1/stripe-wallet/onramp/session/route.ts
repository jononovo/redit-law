import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";
import { privyOnrampSessionSchema } from "@/shared/schema";
import { createOnrampSession } from "@/lib/stripe-wallet/onramp";

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = privyOnrampSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
    }

    const { wallet_id, amount_usd } = parsed.data;

    const wallet = await storage.privyGetWalletById(wallet_id);
    if (!wallet || wallet.ownerUid !== user.uid) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;

    const { clientSecret, sessionId } = await createOnrampSession({
      walletAddress: wallet.address,
      userEmail: user.email || undefined,
      customerIp: ip,
      amountUsd: amount_usd,
    });

    return NextResponse.json({
      client_secret: clientSecret,
      session_id: sessionId,
      wallet_address: wallet.address,
    });
  } catch (error) {
    console.error("POST /api/v1/stripe-wallet/onramp/session error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
