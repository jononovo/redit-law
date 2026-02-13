import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const { wallet_id, frozen } = body;

    if (!wallet_id || typeof frozen !== "boolean") {
      return NextResponse.json({ error: "wallet_id and frozen are required" }, { status: 400 });
    }

    const newStatus = frozen ? "paused" : "active";
    const updated = await storage.privyUpdateWalletStatus(Number(wallet_id), newStatus, user.uid);

    if (!updated) {
      return NextResponse.json({ error: "Wallet not found or not owned by you" }, { status: 404 });
    }

    return NextResponse.json({
      wallet_id: updated.id,
      status: updated.status,
      message: frozen ? "Wallet paused" : "Wallet activated",
    });
  } catch (error) {
    console.error("POST /api/v1/stripe-wallet/freeze error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
