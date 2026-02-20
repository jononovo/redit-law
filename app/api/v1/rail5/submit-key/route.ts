import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";
import { rail5SubmitKeySchema } from "@/shared/schema";
import { validateKeyMaterial } from "@/lib/rail5";

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = rail5SubmitKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { card_id, key_hex, iv_hex, tag_hex, spending_limit_cents, daily_limit_cents, monthly_limit_cents, human_approval_above_cents } = parsed.data;

  const keyValidation = validateKeyMaterial(key_hex, iv_hex, tag_hex);
  if (!keyValidation.valid) {
    return NextResponse.json({ error: "invalid_key_material", message: keyValidation.error }, { status: 400 });
  }

  const card = await storage.getRail5CardByCardId(card_id);
  if (!card) {
    return NextResponse.json({ error: "card_not_found" }, { status: 404 });
  }

  if (card.ownerUid !== user.uid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (card.status !== "pending_setup") {
    return NextResponse.json({ error: "key_already_submitted", message: "Card has already been set up." }, { status: 409 });
  }

  const updates: Record<string, unknown> = {
    encryptedKeyHex: key_hex,
    encryptedIvHex: iv_hex,
    encryptedTagHex: tag_hex,
    status: "active",
  };

  if (spending_limit_cents !== undefined) updates.spendingLimitCents = spending_limit_cents;
  if (daily_limit_cents !== undefined) updates.dailyLimitCents = daily_limit_cents;
  if (monthly_limit_cents !== undefined) updates.monthlyLimitCents = monthly_limit_cents;
  if (human_approval_above_cents !== undefined) updates.humanApprovalAboveCents = human_approval_above_cents;

  await storage.updateRail5Card(card_id, updates);

  return NextResponse.json({ card_id, status: "active" });
}
