import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { crossmintBotPurchaseSchema } from "@/shared/schema";
import { authenticateBot } from "@/lib/bot-auth";
import { evaluateGuardrails } from "@/lib/guardrails/evaluate";
import { evaluateMasterGuardrails } from "@/lib/guardrails/master";
import { getApprovalExpiresAt, RAIL2_APPROVAL_TTL_MINUTES } from "@/lib/approvals/lifecycle";
import { usdToMicroUsdc } from "@/lib/card-wallet/server";

async function handler(request: NextRequest, botId: string) {
  try {
    const body = await request.json();
    const parsed = crossmintBotPurchaseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
    }

    const { merchant, product_id, quantity, product_name, estimated_price_usd, shipping_address } = parsed.data;

    const wallet = await storage.crossmintGetWalletByBotId(botId);
    if (!wallet) {
      return NextResponse.json({ error: "No Card Wallet found for this bot" }, { status: 404 });
    }

    if (wallet.status !== "active") {
      return NextResponse.json({ error: "Wallet is paused", status: wallet.status }, { status: 403 });
    }

    const estimatedAmountUsdc = estimated_price_usd
      ? usdToMicroUsdc(estimated_price_usd * (quantity || 1))
      : 0;

    const masterDecision = await evaluateMasterGuardrails(wallet.ownerUid, estimatedAmountUsdc);
    if (masterDecision.action === "block") {
      return NextResponse.json({ error: "guardrail_violation", reason: masterDecision.reason }, { status: 403 });
    }

    const guardrails = await storage.crossmintGetGuardrails(wallet.id);
    if (!guardrails) {
      return NextResponse.json({ error: "Guardrails not configured" }, { status: 500 });
    }

    const productLocator = `${merchant}:${product_id}`;

    const dailySpend = await storage.crossmintGetDailySpend(wallet.id);
    const monthlySpend = await storage.crossmintGetMonthlySpend(wallet.id);

    const decision = evaluateGuardrails(
      {
        maxPerTxUsdc: guardrails.maxPerTxUsdc,
        dailyBudgetUsdc: guardrails.dailyBudgetUsdc,
        monthlyBudgetUsdc: guardrails.monthlyBudgetUsdc,
        requireApprovalAbove: guardrails.requireApprovalAbove,
        allowlistedMerchants: guardrails.allowlistedMerchants as string[] | undefined,
        blocklistedMerchants: guardrails.blocklistedMerchants as string[] | undefined,
        autoPauseOnZero: guardrails.autoPauseOnZero,
      },
      { amountUsdc: estimatedAmountUsdc, merchant },
      { dailyUsdc: dailySpend, monthlyUsdc: monthlySpend }
    );

    if (decision.action === "block") {
      return NextResponse.json({ error: "guardrail_violation", reason: decision.reason }, { status: 403 });
    }

    const tx = await storage.crossmintCreateTransaction({
      walletId: wallet.id,
      type: "purchase",
      amountUsdc: estimatedAmountUsdc,
      productLocator,
      productName: product_name || productLocator,
      quantity: quantity || 1,
      shippingAddress: shipping_address,
      status: "requires_approval",
      orderStatus: "pending",
    });

    const approval = await storage.crossmintCreateApproval({
      walletId: wallet.id,
      transactionId: tx.id,
      amountUsdc: estimatedAmountUsdc,
      productLocator,
      productName: product_name || productLocator,
      shippingAddress: shipping_address,
      expiresAt: getApprovalExpiresAt(RAIL2_APPROVAL_TTL_MINUTES),
    });

    return NextResponse.json({
      status: "awaiting_approval",
      approval_id: approval.id,
      transaction_id: tx.id,
      product_name: tx.productName,
      product_locator: productLocator,
      estimated_total_usd: estimated_price_usd ? estimated_price_usd * (quantity || 1) : null,
      expires_at: approval.expiresAt,
    }, { status: 202 });
  } catch (error) {
    console.error("POST /api/v1/card-wallet/bot/purchase error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const bot = await authenticateBot(request);
  if (!bot) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }
  return handler(request, bot.botId);
}
