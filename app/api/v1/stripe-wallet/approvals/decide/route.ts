import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";
import { privyApprovalDecideSchema } from "@/shared/schema";
import { resolveApproval } from "@/lib/approvals/service";
import "@/lib/approvals/callbacks";

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = privyApprovalDecideSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
    }

    const { approval_id, decision } = parsed.data;

    const approval = await storage.privyGetApproval(approval_id);
    if (!approval) {
      return NextResponse.json({ error: "Approval not found" }, { status: 404 });
    }

    const wallet = await storage.privyGetWalletById(approval.walletId);
    if (!wallet || wallet.ownerUid !== user.uid) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const unifiedApproval = await storage.getUnifiedApprovalByRailRef("rail1", String(approval_id));

    if (unifiedApproval) {
      const action = decision === "approve" ? "approve" : "deny";
      const result = await resolveApproval(unifiedApproval.approvalId, action, unifiedApproval.hmacToken);

      if (!result.success && result.error === "expired") {
        return NextResponse.json({ error: "Approval has expired" }, { status: 410 });
      }

      if (!result.success && result.error?.startsWith("already_")) {
        return NextResponse.json({ error: result.error }, { status: 409 });
      }

      if (!result.success) {
        return NextResponse.json({ error: result.error || "Failed to update approval" }, { status: 500 });
      }

      if (result.callbackError) {
        return NextResponse.json({ error: "Approval recorded but callback failed", details: result.callbackError }, { status: 502 });
      }

      const updatedPrivy = await storage.privyGetApproval(approval_id);
      return NextResponse.json({
        approval: {
          id: updatedPrivy?.id ?? approval_id,
          status: updatedPrivy?.status ?? (decision === "approve" ? "approved" : "rejected"),
          decided_at: updatedPrivy?.decidedAt,
        },
      });
    }

    if (new Date() > approval.expiresAt) {
      await storage.privyDecideApproval(approval_id, "expired", user.uid);
      await storage.privyUpdateTransactionStatus(approval.transactionId, "failed");
      return NextResponse.json({ error: "Approval has expired" }, { status: 410 });
    }

    const status = decision === "approve" ? "approved" : "rejected";
    const updated = await storage.privyDecideApproval(approval_id, status, user.uid);

    if (!updated) {
      return NextResponse.json({ error: "Failed to update approval" }, { status: 500 });
    }

    if (decision === "reject") {
      await storage.privyUpdateTransactionStatus(approval.transactionId, "failed");
    }

    return NextResponse.json({
      approval: {
        id: updated.id,
        status: updated.status,
        decided_at: updated.decidedAt,
      },
    });
  } catch (error) {
    console.error("POST /api/v1/stripe-wallet/approvals/decide error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
