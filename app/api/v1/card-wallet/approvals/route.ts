import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";
import { formatUsdc } from "@/lib/card-wallet/server";

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const approvals = await storage.crossmintGetPendingApprovalsByOwnerUid(user.uid);

    const approvalsWithDetails = await Promise.all(
      approvals.map(async (a) => {
        const wallet = await storage.crossmintGetWalletById(a.walletId);
        const bot = wallet ? await storage.getBotByBotId(wallet.botId) : null;
        return {
          id: a.id,
          wallet_id: a.walletId,
          amount_usdc: a.amountUsdc,
          amount_display: formatUsdc(a.amountUsdc),
          product_locator: a.productLocator,
          product_name: a.productName,
          shipping_address: a.shippingAddress,
          status: a.status,
          expires_at: a.expiresAt,
          created_at: a.createdAt,
          bot_name: bot?.botName || wallet?.botId || "Unknown",
          wallet_balance_display: wallet ? formatUsdc(wallet.balanceUsdc) : "$0.00",
        };
      })
    );

    return NextResponse.json({ approvals: approvalsWithDetails });
  } catch (error) {
    console.error("GET /api/v1/card-wallet/approvals error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
