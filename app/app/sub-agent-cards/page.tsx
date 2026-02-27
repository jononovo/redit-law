"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, CreditCard, Lock } from "lucide-react";
import { Rail5SetupWizard } from "@/components/dashboard/rail5-setup-wizard";
import { CardVisual } from "@/components/wallet/card-visual";
import { FreezeDialog } from "@/components/wallet/dialogs/freeze-dialog";
import { LinkBotDialog } from "@/components/wallet/dialogs/link-bot-dialog";
import { UnlinkBotDialog } from "@/components/wallet/dialogs/unlink-bot-dialog";
import { CreditCardActionBar } from "@/components/wallet/credit-card-action-bar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import { useWalletActions } from "@/components/wallet/hooks/use-wallet-actions";
import { useBotLinking } from "@/components/wallet/hooks/use-bot-linking";
import {
  type Rail5CardInfo,
  CARD_COLORS,
  BRAND_LABELS,
  formatCentsToUsd,
} from "@/components/wallet/types";

export default function SubAgentCardsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [cards, setCards] = useState<Rail5CardInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [freezeTarget, setFreezeTarget] = useState<Rail5CardInfo | null>(null);
  const [freezeLoading, setFreezeLoading] = useState(false);

  const fetchCards = useCallback(async () => {
    try {
      const res = await authFetch("/api/v1/rail5/cards");
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
    railPrefix: "rail5",
    entityType: "card",
    entityIdField: "card_id",
    onUpdate: fetchCards,
  });

  const botLinking = useBotLinking({
    railPrefix: "rail5",
    entityType: "card",
    onUpdate: fetchCards,
  });

  useEffect(() => {
    if (user) {
      fetchCards();
      botLinking.fetchBots();
    } else {
      setLoading(false);
    }
  }, [user, fetchCards, botLinking.fetchBots]);

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

  return (
    <div className="flex flex-col gap-8 animate-fade-in-up">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-1" data-testid="text-sub-agent-cards-title">Sub-Agent Cards</h1>
          <p className="text-neutral-500">
            Encrypted cards for autonomous bot purchases. CreditClaw never sees your card — only the decryption key.
          </p>
        </div>
        <Button
          onClick={() => setWizardOpen(true)}
          className="rounded-full bg-primary hover:bg-primary/90 gap-2"
          data-testid="button-add-sub-agent-card"
        >
          <Plus className="w-4 h-4" />
          Add New Card
        </Button>
      </div>

      <Rail5SetupWizard
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

      <LinkBotDialog
        open={!!botLinking.linkTarget}
        onOpenChange={(open) => { if (!open) botLinking.closeLinkDialog(); }}
        itemName={botLinking.linkTarget?.name || ""}
        bots={botLinking.bots}
        selectedBotId={botLinking.linkBotId}
        onBotIdChange={botLinking.setLinkBotId}
        loading={botLinking.linkLoading}
        onConfirm={botLinking.handleLinkBot}
        onCancel={botLinking.closeLinkDialog}
        itemType="card"
        testIdPrefix="r5-"
      />

      <UnlinkBotDialog
        open={!!botLinking.unlinkTarget}
        onOpenChange={(open) => { if (!open) botLinking.closeUnlinkDialog(); }}
        botName={botLinking.unlinkTarget?.bot_name || ""}
        loading={botLinking.unlinkLoading}
        onConfirm={botLinking.handleUnlinkBot}
        onCancel={botLinking.closeUnlinkDialog}
        itemType="card"
        testIdPrefix="r5-"
      />

      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl border border-purple-100 p-6" data-testid="card-rail5-explainer">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
            <Lock className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-bold text-neutral-900 mb-1">How Sub-Agent Cards Work</h3>
            <p className="text-sm text-neutral-600 leading-relaxed">
              Your card details are encrypted in your browser and saved as a file. CreditClaw only stores the decryption key.
              At checkout, a disposable sub-agent gets the key, decrypts the file, completes the purchase, and is immediately deleted —
              so no agent ever retains your card details.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24" data-testid="loading-sub-agent-cards">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
        </div>
      ) : cards.length === 0 ? (
        <div className="text-center py-24" data-testid="text-no-r5-cards">
          <CreditCard className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
          <p className="text-lg text-neutral-400 font-medium">No sub-agent cards yet.</p>
          <p className="text-sm text-neutral-400 mt-2">Click "Add New Card" above to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {cards.map((card, index) => (
            <div className="flex flex-col gap-4 min-w-[320px]" key={card.card_id} data-testid={`card-r5-${card.card_id}`}>
              <CardVisual
                color={CARD_COLORS[index % CARD_COLORS.length]}
                balance={formatCentsToUsd(card.spending_limit_cents)}
                balanceLabel="Spending Limit"
                last4={card.card_last4}
                holder={card.card_name.toUpperCase()}
                frozen={card.status === "frozen"}
                expiry="••/••"
                allowanceLabel={`Daily: ${formatCentsToUsd(card.daily_limit_cents)}`}
                resetsLabel={`Monthly: ${formatCentsToUsd(card.monthly_limit_cents)}`}
                status={card.status}
                brand={card.card_brand}
                variant="credit-card"
              />
              <CreditCardActionBar
                cardId={card.card_id}
                status={card.status}
                botId={card.bot_id}
                botName={card.bot_name}
                onManage={() => router.push(`/app/sub-agent-cards/${card.card_id}`)}
                onFreeze={() => setFreezeTarget(card)}
                onAddAgent={() => botLinking.openLinkDialog({ id: card.card_id, name: card.card_name, bot_id: card.bot_id, bot_name: card.bot_name })}
                onLinkAgent={() => botLinking.openLinkDialog({ id: card.card_id, name: card.card_name, bot_id: card.bot_id, bot_name: card.bot_name })}
                onUnlinkBot={() => botLinking.openUnlinkDialog({ id: card.card_id, name: card.card_name, bot_id: card.bot_id, bot_name: card.bot_name })}
                onCopyCardId={() => walletActions.copyCardId(card.card_id)}
                onViewDetails={() => router.push(`/app/sub-agent-cards/${card.card_id}`)}
                testIdPrefix="r5"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
