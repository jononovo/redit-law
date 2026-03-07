"use client";

import { Shield, Package, XCircle, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ApprovalRow {
  id: number;
  approval_id?: string;
  amount_display: string;
  status: string;
  expires_at: string;
  resource_url?: string;
  product_name?: string;
  merchant_name?: string;
  item_name?: string;
  bot_name?: string;
  shipping_address?: Record<string, string> | null;
}

interface ApprovalListProps {
  approvals: ApprovalRow[];
  onDecide: (id: number | string, decision: "approve" | "reject") => void;
  variant?: "crypto" | "commerce";
  testIdPrefix?: string;
}

export function ApprovalList({ approvals, onDecide, variant = "crypto", testIdPrefix = "approval" }: ApprovalListProps) {
  if (approvals.length === 0) {
    return (
      <div className="text-center py-16" data-testid={`text-no-${testIdPrefix}s`}>
        <Shield className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
        <p className="text-neutral-400">No pending approvals</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {approvals.map((a) => (
        <div
          key={a.approval_id || a.id}
          className="bg-white rounded-2xl border border-amber-100 p-5 flex items-center justify-between"
          data-testid={`card-${testIdPrefix}-${a.approval_id || a.id}`}
        >
          <div className="flex-1">
            {variant === "commerce" ? (
              <>
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-neutral-500" />
                  <span className="font-semibold text-neutral-900">{a.amount_display}</span>
                  {a.bot_name && <span className="text-xs text-neutral-400">by {a.bot_name}</span>}
                </div>
                {(a.merchant_name || a.item_name) && (
                  <p className="text-sm text-neutral-500 mt-1">
                    {a.merchant_name}{a.item_name ? ` — ${a.item_name}` : ""}
                  </p>
                )}
                {a.product_name && !a.merchant_name && (
                  <p className="text-sm text-neutral-500 mt-1">{a.product_name}</p>
                )}
                {a.shipping_address && (
                  <p className="text-xs text-neutral-500 mt-1">
                    Ship to: {Object.values(a.shipping_address).filter(Boolean).join(", ")}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="font-semibold text-neutral-900">{a.amount_display}</p>
                {a.resource_url && (
                  <p className="text-sm text-neutral-500 truncate max-w-[300px]">{a.resource_url}</p>
                )}
              </>
            )}
            <p className="text-xs text-amber-600 mt-1">
              Expires {new Date(a.expires_at).toLocaleTimeString()}
            </p>
          </div>
          <div className="flex gap-2 ml-4">
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => onDecide(a.approval_id || a.id, "reject")}
              data-testid={`button-reject-${a.approval_id || a.id}`}
            >
              <XCircle className="w-4 h-4 mr-1" />
              Reject
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => onDecide(a.approval_id || a.id, "approve")}
              data-testid={`button-approve-${a.approval_id || a.id}`}
            >
              <CheckCircle2 className="w-4 h-4 mr-1" />
              Approve
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
