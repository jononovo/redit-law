import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";
import { RAIL5_TEST_CHECKOUT_PAGE_ID } from "@/lib/rail5";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { cardId } = await params;
  if (!cardId) {
    return NextResponse.json({ error: "missing_card_id" }, { status: 400 });
  }

  const card = await storage.getRail5CardByCardId(cardId);
  if (!card) {
    return NextResponse.json({ error: "card_not_found" }, { status: 404 });
  }

  if (card.ownerUid !== user.uid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const sales = await storage.getSalesByCheckoutPageId(RAIL5_TEST_CHECKOUT_PAGE_ID);

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const testSale = sales.find(
    (s) =>
      s.status === "test" &&
      s.paymentMethod === "testing" &&
      s.createdAt >= fiveMinutesAgo
  );

  if (!testSale) {
    return NextResponse.json({ status: "pending" });
  }

  const meta = (testSale.metadata || {}) as Record<string, string>;

  return NextResponse.json({
    status: "completed",
    sale_id: testSale.saleId,
    submitted_details: {
      cardNumber: meta.cardNumber || "",
      cardExpiry: meta.cardExpiry || "",
      cardCvv: meta.cardCvv || "",
      cardholderName: meta.cardholderName || "",
      billingAddress: meta.billingAddress || "",
      billingCity: meta.billingCity || "",
      billingState: meta.billingState || "",
      billingZip: meta.billingZip || "",
    },
  });
}
