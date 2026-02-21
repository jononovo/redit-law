import { NextResponse } from "next/server";
import { withBotApi } from "@/lib/bot-api";
import { storage } from "@/server/storage";
import { rail5CheckoutRequestSchema } from "@/shared/schema";
import { generateRail5CheckoutId, buildSpawnPayload, getDailySpendCents, getMonthlySpendCents } from "@/lib/rail5";
import { evaluateMasterGuardrails, centsToMicroUsdc } from "@/lib/guardrails/master";

export const POST = withBotApi("/api/v1/bot/rail5/checkout", async (request, { bot }) => {
  if (bot.walletStatus !== "active") {
    return NextResponse.json(
      { error: "wallet_not_active", message: "Wallet is not active." },
      { status: 403 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = rail5CheckoutRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { merchant_name, merchant_url, item_name, amount_cents, category } = parsed.data;

  const card = await storage.getRail5CardByBotId(bot.botId);
  if (!card) {
    return NextResponse.json(
      { error: "no_card", message: "No Rail 5 card linked to this bot." },
      { status: 404 }
    );
  }

  if (card.status !== "active") {
    return NextResponse.json(
      { error: "card_not_active", message: `Card is ${card.status}. Cannot checkout.` },
      { status: 403 }
    );
  }

  if (card.spendingLimitCents && amount_cents > card.spendingLimitCents) {
    return NextResponse.json(
      { error: "per_transaction_limit", message: `Amount $${(amount_cents / 100).toFixed(2)} exceeds per-transaction limit of $${(card.spendingLimitCents / 100).toFixed(2)}.` },
      { status: 403 }
    );
  }

  if (card.dailyLimitCents) {
    const dailySpend = await getDailySpendCents(card.cardId);
    if (dailySpend + amount_cents > card.dailyLimitCents) {
      return NextResponse.json(
        { error: "daily_limit", message: `Daily spend would reach $${((dailySpend + amount_cents) / 100).toFixed(2)}, exceeding daily limit of $${(card.dailyLimitCents / 100).toFixed(2)}.` },
        { status: 403 }
      );
    }
  }

  if (card.monthlyLimitCents) {
    const monthlySpend = await getMonthlySpendCents(card.cardId);
    if (monthlySpend + amount_cents > card.monthlyLimitCents) {
      return NextResponse.json(
        { error: "monthly_limit", message: `Monthly spend would reach $${((monthlySpend + amount_cents) / 100).toFixed(2)}, exceeding monthly limit of $${(card.monthlyLimitCents / 100).toFixed(2)}.` },
        { status: 403 }
      );
    }
  }

  const masterDecision = await evaluateMasterGuardrails(card.ownerUid, centsToMicroUsdc(amount_cents));
  if (masterDecision.action === "block") {
    return NextResponse.json(
      { error: "master_guardrail", message: masterDecision.reason },
      { status: 403 }
    );
  }

  const checkoutId = generateRail5CheckoutId();

  if (card.humanApprovalAboveCents && amount_cents > card.humanApprovalAboveCents) {
    await storage.createRail5Checkout({
      checkoutId,
      cardId: card.cardId,
      botId: bot.botId,
      ownerUid: card.ownerUid,
      merchantName: merchant_name,
      merchantUrl: merchant_url,
      itemName: item_name,
      amountCents: amount_cents,
      category: category || null,
      status: "pending_approval",
    });

    const owner = await storage.getOwnerByUid(card.ownerUid);
    if (owner) {
      const { notifyOwner } = await import("@/lib/notifications");
      await notifyOwner({
        ownerUid: card.ownerUid,
        ownerEmail: owner.email,
        type: "purchase",
        title: `Approval needed: $${(amount_cents / 100).toFixed(2)} at ${merchant_name}`,
        body: `Your bot wants to spend $${(amount_cents / 100).toFixed(2)} at ${merchant_name} for "${item_name}". This exceeds your approval threshold.`,
        botId: bot.botId,
      }).catch(() => {});
    }

    return NextResponse.json({
      approved: false,
      status: "pending_approval",
      checkout_id: checkoutId,
      message: `Amount exceeds approval threshold of $${(card.humanApprovalAboveCents / 100).toFixed(2)}. Owner notified.`,
    });
  }

  await storage.createRail5Checkout({
    checkoutId,
    cardId: card.cardId,
    botId: bot.botId,
    ownerUid: card.ownerUid,
    merchantName: merchant_name,
    merchantUrl: merchant_url,
    itemName: item_name,
    amountCents: amount_cents,
    category: category || null,
    status: "approved",
  });

  const encryptedFilename = `Card-${card.cardName.replace(/[^a-zA-Z0-9-_]/g, "-")}-${card.cardLast4}.md`;

  const spawnPayload = buildSpawnPayload({
    checkoutId,
    merchantName: merchant_name,
    merchantUrl: merchant_url,
    itemName: item_name,
    amountCents: amount_cents,
    encryptedFilename,
  });

  return NextResponse.json({
    approved: true,
    checkout_id: checkoutId,
    spawn_payload: spawnPayload,
  });
});
