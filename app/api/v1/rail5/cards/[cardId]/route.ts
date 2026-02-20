import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";
import { z } from "zod";

const patchSchema = z.object({
  card_name: z.string().min(1).max(200).optional(),
  bot_id: z.string().min(1).max(200).nullable().optional(),
  spending_limit_cents: z.number().int().min(100).max(10000000).optional(),
  daily_limit_cents: z.number().int().min(100).max(10000000).optional(),
  monthly_limit_cents: z.number().int().min(100).max(100000000).optional(),
  human_approval_above_cents: z.number().int().min(0).max(10000000).optional(),
  status: z.enum(["active", "frozen"]).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { cardId } = await params;

  const card = await storage.getRail5CardByCardId(cardId);
  if (!card) {
    return NextResponse.json({ error: "card_not_found" }, { status: 404 });
  }

  if (card.ownerUid !== user.uid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};
  const data = parsed.data;

  if (data.card_name !== undefined) updates.cardName = data.card_name;
  if (data.bot_id !== undefined) updates.botId = data.bot_id;
  if (data.spending_limit_cents !== undefined) updates.spendingLimitCents = data.spending_limit_cents;
  if (data.daily_limit_cents !== undefined) updates.dailyLimitCents = data.daily_limit_cents;
  if (data.monthly_limit_cents !== undefined) updates.monthlyLimitCents = data.monthly_limit_cents;
  if (data.human_approval_above_cents !== undefined) updates.humanApprovalAboveCents = data.human_approval_above_cents;

  if (data.status !== undefined) {
    if (card.status === "pending_setup") {
      return NextResponse.json({ error: "cannot_change_status", message: "Card must be set up before changing status." }, { status: 400 });
    }
    updates.status = data.status;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "no_updates", message: "No valid fields to update." }, { status: 400 });
  }

  const updated = await storage.updateRail5Card(cardId, updates);

  return NextResponse.json({
    card_id: updated!.cardId,
    card_name: updated!.cardName,
    card_brand: updated!.cardBrand,
    card_last4: updated!.cardLast4,
    status: updated!.status,
    bot_id: updated!.botId || null,
    spending_limit_cents: updated!.spendingLimitCents,
    daily_limit_cents: updated!.dailyLimitCents,
    monthly_limit_cents: updated!.monthlyLimitCents,
    human_approval_above_cents: updated!.humanApprovalAboveCents,
    created_at: updated!.createdAt.toISOString(),
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { cardId } = await params;

  const card = await storage.getRail5CardByCardId(cardId);
  if (!card) {
    return NextResponse.json({ error: "card_not_found" }, { status: 404 });
  }

  if (card.ownerUid !== user.uid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    card_id: card.cardId,
    card_name: card.cardName,
    card_brand: card.cardBrand,
    card_last4: card.cardLast4,
    status: card.status,
    bot_id: card.botId || null,
    spending_limit_cents: card.spendingLimitCents,
    daily_limit_cents: card.dailyLimitCents,
    monthly_limit_cents: card.monthlyLimitCents,
    human_approval_above_cents: card.humanApprovalAboveCents,
    created_at: card.createdAt.toISOString(),
  });
}
