import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { privyBotSignSchema } from "@/shared/schema";
import { signTypedData } from "@/lib/stripe-wallet/server";
import { buildTransferWithAuthorizationTypedData, generateNonce, buildXPaymentHeader, usdToMicroUsdc } from "@/lib/stripe-wallet/x402";
import { authenticateBot } from "@/lib/bot-auth";

async function handler(request: NextRequest, botId: string) {
  try {
    const body = await request.json();
    const parsed = privyBotSignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
    }

    const { resource_url, amount_usdc, recipient_address, valid_before } = parsed.data;

    const wallet = await storage.privyGetWalletByBotId(botId);
    if (!wallet) {
      return NextResponse.json({ error: "No Stripe Wallet found for this bot" }, { status: 404 });
    }

    if (wallet.status !== "active") {
      return NextResponse.json({ error: "Wallet is not active", status: wallet.status }, { status: 403 });
    }

    const guardrails = await storage.privyGetGuardrails(wallet.id);

    if (guardrails) {
      const maxPerTxMicro = usdToMicroUsdc(guardrails.maxPerTxUsdc);
      if (amount_usdc > maxPerTxMicro) {
        return NextResponse.json({ error: "Amount exceeds per-transaction limit", max: guardrails.maxPerTxUsdc }, { status: 403 });
      }

      const dailySpend = await storage.privyGetDailySpend(wallet.id);
      const dailyLimitMicro = usdToMicroUsdc(guardrails.dailyBudgetUsdc);
      if (dailySpend + amount_usdc > dailyLimitMicro) {
        return NextResponse.json({ error: "Would exceed daily budget" }, { status: 403 });
      }

      const monthlySpend = await storage.privyGetMonthlySpend(wallet.id);
      const monthlyLimitMicro = usdToMicroUsdc(guardrails.monthlyBudgetUsdc);
      if (monthlySpend + amount_usdc > monthlyLimitMicro) {
        return NextResponse.json({ error: "Would exceed monthly budget" }, { status: 403 });
      }

      if (guardrails.allowlistedDomains && (guardrails.allowlistedDomains as string[]).length > 0) {
        const domain = new URL(resource_url).hostname;
        if (!(guardrails.allowlistedDomains as string[]).includes(domain)) {
          return NextResponse.json({ error: "Domain not on allowlist" }, { status: 403 });
        }
      }

      if (guardrails.blocklistedDomains && (guardrails.blocklistedDomains as string[]).length > 0) {
        const domain = new URL(resource_url).hostname;
        if ((guardrails.blocklistedDomains as string[]).includes(domain)) {
          return NextResponse.json({ error: "Domain is blocklisted" }, { status: 403 });
        }
      }

      if (guardrails.requireApprovalAbove !== null && guardrails.requireApprovalAbove !== undefined) {
        const approvalThresholdMicro = usdToMicroUsdc(guardrails.requireApprovalAbove);
        if (amount_usdc >= approvalThresholdMicro) {
          const tx = await storage.privyCreateTransaction({
            walletId: wallet.id,
            type: "x402_payment",
            amountUsdc: amount_usdc,
            recipientAddress: recipient_address,
            resourceUrl: resource_url,
            status: "requires_approval",
          });

          const approval = await storage.privyCreateApproval({
            walletId: wallet.id,
            transactionId: tx.id,
            amountUsdc: amount_usdc,
            resourceUrl: resource_url,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          });

          return NextResponse.json({
            status: "awaiting_approval",
            approval_id: approval.id,
          }, { status: 202 });
        }
      }
    }

    if (wallet.balanceUsdc < amount_usdc) {
      return NextResponse.json({ error: "Insufficient USDC balance" }, { status: 403 });
    }

    const nonce = generateNonce();
    const validAfter = 0;
    const validBeforeTs = valid_before || Math.floor(Date.now() / 1000) + 300;

    const typedData = buildTransferWithAuthorizationTypedData({
      from: wallet.address,
      to: recipient_address,
      value: BigInt(amount_usdc),
      validAfter,
      validBefore: validBeforeTs,
      nonce,
    });

    const signature = await signTypedData(wallet.privyWalletId, typedData);

    const xPaymentHeader = buildXPaymentHeader({
      signature,
      from: wallet.address,
      to: recipient_address,
      value: String(amount_usdc),
      validAfter,
      validBefore: validBeforeTs,
      nonce,
      chainId: 8453,
    });

    await storage.privyCreateTransaction({
      walletId: wallet.id,
      type: "x402_payment",
      amountUsdc: amount_usdc,
      recipientAddress: recipient_address,
      resourceUrl: resource_url,
      status: "pending",
    });

    return NextResponse.json({
      x_payment_header: xPaymentHeader,
      signature,
    });
  } catch (error) {
    console.error("POST /api/v1/stripe-wallet/bot/sign error:", error);
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
