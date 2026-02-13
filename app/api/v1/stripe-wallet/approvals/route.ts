import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";
import { microUsdcToUsd } from "@/lib/stripe-wallet/x402";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const approvals = await storage.privyGetPendingApprovalsByOwnerUid(user.uid);

    return NextResponse.json({
      approvals: approvals.map((a) => ({
        id: a.id,
        wallet_id: a.walletId,
        amount_usdc: a.amountUsdc,
        amount_display: `$${microUsdcToUsd(a.amountUsdc).toFixed(2)}`,
        resource_url: a.resourceUrl,
        status: a.status,
        expires_at: a.expiresAt,
        created_at: a.createdAt,
      })),
    });
  } catch (error) {
    console.error("GET /api/v1/stripe-wallet/approvals error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
