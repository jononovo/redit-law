import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";

export async function GET(
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

    storage.incrementCheckoutPageViewCount(id).catch(() => {});

    return NextResponse.json({
      checkout_page_id: page.checkoutPageId,
      title: page.title,
      description: page.description,
      amount_usdc: page.amountUsdc,
      amount_locked: page.amountLocked,
      allowed_methods: page.allowedMethods,
      success_url: page.successUrl,
      success_message: page.successMessage,
      wallet_address: page.walletAddress,
    });
  } catch (error) {
    console.error("GET /api/v1/checkout/[id]/public error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
