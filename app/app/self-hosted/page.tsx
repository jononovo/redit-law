"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Shield, Plus, CreditCard } from "lucide-react";
import { Rail4SetupWizard } from "@/components/dashboard/rail4-setup-wizard";
import { CardVisual } from "@/components/wallet/card-visual";
import { FreezeDialog } from "@/components/wallet/dialogs/freeze-dialog";
import { CreditCardActionBar } from "@/components/wallet/credit-card-action-bar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import { authFetch } from "@/lib/auth-fetch";
import { useWalletActions } from "@/components/wallet/hooks/use-wallet-actions";
import {
  type Rail4CardInfo,
  type AllowanceInfo,
  CARD_COLORS,
  formatAllowanceLabel,
  formatResetsLabel,
} from "@/components/wallet/types";

export default function SelfHostedPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [cards, setCards] = useState<Rail4CardInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [freezeTarget, setFreezeTarget] = useState<Rail4CardInfo | null>(null);
  const [freezeLoading, setFreezeLoading] = useState(false);

  const fetchCards = useCallback(async () => {
    try {
      const res = await authFetch("/api/v1/rail4/cards");
      if (res.ok) {
        const data = await res.json();
        setCards(data.cards || []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  const walletActions = useWalletActions({
    railPrefix: "rail4",
    entityType: "card",
    entityIdField: "card_id",
    onUpdate: fetchCards,
  });

  useEffect(() => {
    if (user) {
      fetchCards();
    } else {
      setLoading(false);
    }
  }, [user, fetchCards]);

  async function handleFreezeConfirm() {
    if (!freezeTarget) return;
    await walletActions.handleFreezeCard(
      freezeTarget.card_id,
      freezeTarget.status,
      setCards,
      setFreezeLoading,
      () => setFreezeTarget(null),
    );
  }

  function formatBalance(card: Rail4CardInfo) {
    if (!card.allowance) {
      return "$0.00";
    }
    const remaining = card.allowance.remaining_cents / 100;
    const sign = remaining < 0 ? "-" : "";
    return `${sign}$${Math.abs(remaining).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  return (
    <div className="flex flex-col gap-8 animate-fade-in-up">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-1" data-testid="text-self-hosted-title">Self-Hosted Cards</h1>
          <p className="text-neutral-500">
            Use your own card with split-knowledge security. Neither your bot nor CreditClaw ever holds the full card number.
          </p>
        </div>
        <Button
          onClick={() => setWizardOpen(true)}
          className="rounded-full bg-primary hover:bg-primary/90 gap-2"
          data-testid="button-add-self-hosted"
        >
          <Plus className="w-4 h-4" />
          Add New Card
        </Button>
      </div>

      <Rail4SetupWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onComplete={fetchCards}
      />

      <FreezeDialog
        open={!!freezeTarget}
        onOpenChange={(open) => !open && setFreezeTarget(null)}
        itemName={freezeTarget?.card_name || ""}
        isFrozen={freezeTarget?.status === "frozen"}
        loading={freezeLoading}
        onConfirm={handleFreezeConfirm}
        itemType="card"
      />

      <div className="bg-gradient-to-r from-primary/5 to-purple-50 rounded-2xl border border-primary/10 p-6" data-testid="card-rail4-explainer">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-neutral-900 mb-1">How Split-Knowledge Works</h3>
            <p className="text-sm text-neutral-600 leading-relaxed">
              Your card number is split across a payment profiles file with fake profiles. Only you know which profile is real, 
              and 3 digits are never stored — you enter them during setup. CreditClaw uses obfuscation purchases 
              across fake profiles to mask your real transactions.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24" data-testid="loading-self-hosted">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
        </div>
      ) : cards.length === 0 ? (
        <div className="text-center py-24" data-testid="text-no-cards">
          <CreditCard className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
          <p className="text-lg text-neutral-400 font-medium">No self-hosted cards yet.</p>
          <p className="text-sm text-neutral-400 mt-2">Click "Add New Card" above to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {cards.map((card, index) => (
            <div className="flex flex-col gap-4 min-w-[320px]" key={card.card_id} data-testid={`card-self-hosted-${card.card_id}`}>
              <CardVisual
                color={CARD_COLORS[index % CARD_COLORS.length]}
                balance={formatBalance(card)}
                balanceLabel="Remaining Allowance"
                last4={card.card_id.slice(-4)}
                holder={card.card_name.toUpperCase()}
                frozen={card.status === "frozen"}
                allowanceLabel={card.allowance ? formatAllowanceLabel(card.allowance) : undefined}
                resetsLabel={card.allowance ? formatResetsLabel(card.allowance) : undefined}
                status={card.status}
                variant="id-card"
              />
              <CreditCardActionBar
                cardId={card.card_id}
                status={card.status}
                botId={card.bot_id}
                botName={null}
                onManage={() => router.push(`/app/self-hosted/${card.card_id}`)}
                onFreeze={() => setFreezeTarget(card)}
                onCopyCardId={() => walletActions.copyCardId(card.card_id)}
                onViewDetails={() => router.push(`/app/self-hosted/${card.card_id}`)}
                testIdPrefix=""
                showFreezeWhenStatuses={["active", "frozen"]}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
