import { NextResponse } from "next/server";
import { withBotApi } from "@/lib/bot-api";
import { storage } from "@/server/storage";

export const GET = withBotApi("/api/v1/bot/wallet/transactions", async (request, { bot }) => {
  if (bot.walletStatus === "pending") {
    return NextResponse.json(
      { error: "wallet_not_active", message: "Wallet not yet activated." },
      { status: 403 }
    );
  }

  const wallet = await storage.getWalletByBotId(bot.botId);
  if (!wallet) {
    return NextResponse.json({ transactions: [] });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

  const [realTxs, obfuscationEvents] = await Promise.all([
    storage.getTransactionsByWalletId(wallet.id, limit),
    storage.getObfuscationEventsByBotId(bot.botId, limit),
  ]);

  const realMapped = realTxs.map((tx) => ({
    id: `tx_${tx.id}`,
    type: tx.type,
    amount_usd: tx.amountCents / 100,
    description: tx.description,
    created_at: tx.createdAt.toISOString(),
  }));

  const completedObfuscation = obfuscationEvents
    .filter((e) => e.status === "completed" && e.occurredAt)
    .map((e) => ({
      id: `obf_${e.id}`,
      type: "purchase",
      amount_usd: e.amountCents / 100,
      description: `${e.merchantName}: ${e.itemName}`,
      created_at: (e.occurredAt || e.createdAt).toISOString(),
    }));

  const merged = [...realMapped, ...completedObfuscation]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);

  return NextResponse.json({
    transactions: merged,
  });
});
