import { registerRailCallbacks } from "@/lib/approvals/service";
import { storage } from "@/server/storage";
import type { UnifiedApproval } from "@/shared/schema";
import { recordOrder } from "@/lib/orders/create";

async function fulfillRail1Approval(approval: UnifiedApproval): Promise<void> {
  const approvalId = Number(approval.railRef);
  if (!isNaN(approvalId)) {
    await storage.privyDecideApproval(approvalId, "approved", approval.ownerUid);

    const privyApproval = await storage.privyGetApproval(approvalId);
    if (privyApproval) {
      const wallet = await storage.privyGetWalletById(privyApproval.walletId);
      const resourceUrl = privyApproval.resourceUrl || "";
      let vendorDomain: string | null = null;
      try {
        vendorDomain = new URL(resourceUrl).hostname;
      } catch {
        vendorDomain = resourceUrl || null;
      }

      const amountUsdc = privyApproval.amountUsdc;
      const priceCents = Math.round((amountUsdc / 1_000_000) * 100);

      recordOrder({
        ownerUid: approval.ownerUid,
        rail: "rail1",
        botId: wallet?.botId ?? null,
        botName: approval.botName ?? null,
        walletId: privyApproval.walletId,
        transactionId: privyApproval.transactionId,
        status: "completed",
        vendor: vendorDomain,
        vendorDetails: { url: resourceUrl },
        productName: vendorDomain,
        productUrl: resourceUrl,
        priceCents,
        priceCurrency: "USD",
        metadata: {
          recipient_address: (approval.metadata as any)?.recipient_address,
          resource_url: resourceUrl,
          amount_usdc: amountUsdc,
          approval_id: approvalId,
        },
      }).catch((err) => console.error("[Rail1] Order creation after approval failed:", err));
    }
  }
  console.log(`[Approvals] Rail 1 approved: privy_approval ${approval.railRef}`);
}

async function fulfillRail1Denial(approval: UnifiedApproval): Promise<void> {
  const approvalId = Number(approval.railRef);
  if (!isNaN(approvalId)) {
    const privyApproval = await storage.privyGetApproval(approvalId);
    await storage.privyDecideApproval(approvalId, "rejected", approval.ownerUid);
    if (privyApproval?.transactionId) {
      await storage.privyUpdateTransactionStatus(privyApproval.transactionId, "failed");
    }
  }
  console.log(`[Approvals] Rail 1 denied: privy_approval ${approval.railRef}`);
}

registerRailCallbacks("rail1", {
  onApprove: fulfillRail1Approval,
  onDeny: fulfillRail1Denial,
});
