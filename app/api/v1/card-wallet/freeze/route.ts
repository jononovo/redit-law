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
    const walletId = body.wallet_id;
    if (!walletId) {
      return NextResponse.json({ error: "wallet_id is required" }, { status: 400 });
    }

    const wallet = await storage.crossmintGetWalletById(Number(walletId));
    if (!wallet || wallet.ownerUid !== user.uid) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
    }

    const newStatus = wallet.status === "active" ? "paused" : "active";
    const updated = await storage.crossmintUpdateWalletStatus(wallet.id, newStatus, user.uid);

    return NextResponse.json({
      wallet_id: updated?.id,
      status: updated?.status,
    });
  } catch (error) {
    console.error("POST /api/v1/card-wallet/freeze error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
