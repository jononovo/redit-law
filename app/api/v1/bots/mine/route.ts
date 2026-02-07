import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const bots = await storage.getBotsByOwnerUid(user.uid);

    return NextResponse.json({
      bots: bots.map((bot) => ({
        bot_id: bot.botId,
        bot_name: bot.botName,
        description: bot.description,
        wallet_status: bot.walletStatus,
        created_at: bot.createdAt,
        claimed_at: bot.claimedAt,
      })),
    });
  } catch (error) {
    console.error("Get my bots error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
