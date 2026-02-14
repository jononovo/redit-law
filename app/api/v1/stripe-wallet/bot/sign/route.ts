import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { privyBotSignSchema } from "@/shared/schema";
import { signTypedData } from "@/lib/stripe-wallet/server";
import { buildTransferWithAuthorizationTypedData, generateNonce, buildXPaymentHeader, usdToMicroUsdc } from "@/lib/stripe-wallet/x402";
import { authenticateBot } from "@/lib/bot-auth";
import { evaluateGuardrails } from "@/lib/guardrails/evaluate";
import { evaluateMasterGuardrails } from "@/lib/guardrails/master";
import { getApprovalExpiresAt, RAIL1_APPROVAL_TTL_MINUTES } from "@/lib/approvals/lifecycle";

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

    const masterDecision = await evaluateMasterGuardrails(wallet.ownerUid, amount_usdc);
    if (masterDecision.action === "block") {
      return NextResponse.json({ error: masterDecision.reason }, { status: 403 });
    }

    const permissions = await storage.getSpendingPermissions(botId);

    if (permissions) {
      const approvalMode = permissions.approvalMode ?? "ask_for_everything";

      if (approvalMode === "ask_for_everything") {
        return NextResponse.json({
          error: "requires_owner_approval",
          approval_mode: "ask_for_everything",
          message: "Your owner requires approval for all transactions. This setting can be changed from the dashboard."
        }, { status: 403 });
      }

      if (approvalMode === "auto_approve_under_threshold") {
        const thresholdCents = permissions.askApprovalAboveCents ?? 1000;
        const thresholdMicro = usdToMicroUsdc(thresholdCents / 100);
        if (amount_usdc > thresholdMicro) {
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
            expiresAt: getApprovalExpiresAt(RAIL1_APPROVAL_TTL_MINUTES),
          });

          return NextResponse.json({
            status: "awaiting_approval",
            approval_id: approval.id,
          }, { status: 202 });
        }
      }
    }

    const guardrails = await storage.privyGetGuardrails(wallet.id);

    if (guardrails) {
      const dailySpend = await storage.privyGetDailySpend(wallet.id);
      const monthlySpend = await storage.privyGetMonthlySpend(wallet.id);

      const decision = evaluateGuardrails(
        {
          maxPerTxUsdc: guardrails.maxPerTxUsdc,
          dailyBudgetUsdc: guardrails.dailyBudgetUsdc,
          monthlyBudgetUsdc: guardrails.monthlyBudgetUsdc,
          requireApprovalAbove: guardrails.requireApprovalAbove,
          allowlistedDomains: guardrails.allowlistedDomains as string[] | undefined,
          blocklistedDomains: guardrails.blocklistedDomains as string[] | undefined,
          autoPauseOnZero: guardrails.autoPauseOnZero,
        },
        { amountUsdc: amount_usdc, resourceUrl: resource_url },
        { dailyUsdc: dailySpend, monthlyUsdc: monthlySpend }
      );

      if (decision.action === "block") {
        return NextResponse.json({ error: decision.reason }, { status: 403 });
      }

      if (decision.action === "require_approval") {
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
          expiresAt: getApprovalExpiresAt(RAIL1_APPROVAL_TTL_MINUTES),
        });

        return NextResponse.json({
          status: "awaiting_approval",
          approval_id: approval.id,
        }, { status: 202 });
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
