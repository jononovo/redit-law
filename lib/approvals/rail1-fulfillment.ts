import { registerRailCallbacks } from "@/lib/approvals/service";
import { storage } from "@/server/storage";
import type { UnifiedApproval } from "@/shared/schema";

async function fulfillRail1Approval(approval: UnifiedApproval): Promise<void> {
  const approvalId = Number(approval.railRef);
  if (!isNaN(approvalId)) {
    await storage.privyDecideApproval(approvalId, "approved", approval.ownerUid);
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
