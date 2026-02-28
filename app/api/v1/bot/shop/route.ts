import { NextRequest, NextResponse } from "next/server";
import { authenticateBot, rateLimit } from "@/lib/bot-auth";
import { storage } from "@/server/storage";

export async function GET(request: NextRequest) {
  const authResult = await authenticateBot(request);
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const limited = await rateLimit(authResult.bot!.botId, "bot_shop_list", 12, 3600);
  if (limited) {
    return NextResponse.json({ error: "Rate limit exceeded (12/hr)" }, { status: 429 });
  }

  try {
    const bot = authResult.bot!;
    if (!bot.ownerUid) {
      return NextResponse.json({ error: "Bot not claimed" }, { status: 403 });
    }

    const profile = await storage.getSellerProfileByOwnerUid(bot.ownerUid);

    const pages = await storage.getCheckoutPagesByOwnerUid(bot.ownerUid);

    const checkoutPages = pages.map((page) => ({
      checkout_page_id: page.checkoutPageId,
      title: page.title,
      description: page.description,
      amount_usd: page.amountUsdc ? page.amountUsdc / 1_000_000 : null,
      amount_locked: page.amountLocked,
      status: page.status,
      page_type: page.pageType || "product",
      shop_visible: page.shopVisible || false,
      shop_order: page.shopOrder || 0,
      image_url: page.imageUrl || null,
      collect_buyer_name: page.collectBuyerName || false,
      payment_count: page.paymentCount,
      view_count: page.viewCount,
      total_received_usd: page.totalReceivedUsdc / 1_000_000,
      checkout_url: `/pay/${page.checkoutPageId}`,
    }));

    return NextResponse.json({
      shop: profile ? {
        slug: profile.slug,
        shop_published: profile.shopPublished,
        business_name: profile.businessName,
        logo_url: profile.logoUrl,
        banner_url: profile.shopBannerUrl,
      } : null,
      checkout_pages: checkoutPages,
    });
  } catch (error) {
    console.error("GET /api/v1/bot/shop error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
