import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const { wallet_id } = body;

    if (!wallet_id) {
      return NextResponse.json({ error: "wallet_id is required" }, { status: 400 });
    }

    const wallet = await storage.privyGetWalletById(Number(wallet_id));
    if (!wallet || wallet.ownerUid !== user.uid) {
      return NextResponse.json({ error: "Wallet not found or not owned by you" }, { status: 404 });
    }

    if (!wallet.botId) {
      return NextResponse.json({ error: "No bot is linked to this wallet" }, { status: 400 });
    }

    const updated = await storage.privyUnlinkBot(Number(wallet_id), user.uid);

    if (!updated) {
      return NextResponse.json({ error: "Failed to unlink bot" }, { status: 500 });
    }

    return NextResponse.json({
      wallet_id: updated.id,
      message: "Bot unlinked successfully",
    });
  } catch (error) {
    console.error("POST /api/v1/stripe-wallet/unlink error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
