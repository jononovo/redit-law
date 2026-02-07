"use client";

import { useEffect, useRef } from "react";
import { WizardStep } from "../wizard-step";
import { Button } from "@/components/ui/button";
import { CheckCircle, Bot, Shield, DollarSign } from "lucide-react";
import Link from "next/link";

interface WizardState {
  botId: string | null;
  botName: string | null;
  botConnected: boolean;
  approvalMode: string;
  perTransactionCents: number;
  dailyCents: number;
  monthlyCents: number;
  blockedCategories: string[];
  approvedCategories: string[];
  notes: string;
  fundedAmountCents: number;
}

interface CompleteProps {
  currentStep: number;
  totalSteps: number;
  state: WizardState;
}

const approvalLabels: Record<string, string> = {
  ask_for_everything: "Ask for everything",
  auto_approve_under_threshold: "Auto-approve under threshold",
  auto_approve_by_category: "Auto-approve by category",
};

export function Complete({ currentStep, totalSteps, state }: CompleteProps) {
  const hasSaved = useRef(false);

  useEffect(() => {
    if (hasSaved.current) return;
    if (!state.botConnected || !state.botId) return;

    hasSaved.current = true;

    fetch("/api/v1/bots/spending", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bot_id: state.botId,
        approval_mode: state.approvalMode,
        per_transaction_usd: state.perTransactionCents / 100,
        daily_usd: state.dailyCents / 100,
        monthly_usd: state.monthlyCents / 100,
        approved_categories: state.approvedCategories,
        blocked_categories: state.blockedCategories,
        notes: state.notes || null,
      }),
    }).catch((err) => console.error("Failed to save spending permissions:", err));
  }, [state.botConnected, state.botId, state.approvalMode, state.perTransactionCents, state.dailyCents, state.monthlyCents, state.approvedCategories, state.blockedCategories, state.notes]);

  return (
    <WizardStep
      title="You're all set!"
      currentStep={currentStep}
      totalSteps={totalSteps}
      showBack={false}
    >
      <div className="space-y-4 mb-8">
        <div className="bg-green-50 rounded-2xl p-6 flex items-center gap-4">
          <CheckCircle className="w-10 h-10 text-green-500 flex-shrink-0" />
          <div>
            <p className="font-bold text-green-900">Setup complete</p>
            <p className="text-sm text-green-700">Your card and spending controls are active. Your bot can only spend what you allow.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200 divide-y divide-neutral-100">
          <div className="p-4 flex items-center gap-3">
            <Bot className="w-5 h-5 text-neutral-500" />
            <div>
              <p className="text-xs text-neutral-500">Bot</p>
              <p className="font-medium text-neutral-900">
                {state.botConnected ? state.botName : "Not connected yet"}
              </p>
            </div>
          </div>
          <div className="p-4 flex items-center gap-3">
            <Shield className="w-5 h-5 text-neutral-500" />
            <div>
              <p className="text-xs text-neutral-500">Approval Mode</p>
              <p className="font-medium text-neutral-900">
                {approvalLabels[state.approvalMode] || state.approvalMode}
              </p>
            </div>
          </div>
          <div className="p-4 flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-neutral-500" />
            <div>
              <p className="text-xs text-neutral-500">Wallet Balance</p>
              <p className="font-medium text-neutral-900">
                ${(state.fundedAmountCents / 100).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <Link href="/app">
        <Button className="w-full rounded-xl h-12 text-base" data-testid="button-go-to-dashboard">
          Go to Dashboard
        </Button>
      </Link>
    </WizardStep>
  );
}
