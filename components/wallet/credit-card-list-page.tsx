"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { Loader2, CreditCard, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import { authFetch } from "@/lib/auth-fetch";
import { useWalletActions } from "./hooks/use-wallet-actions";
import { useBotLinking } from "./hooks/use-bot-linking";
import { FreezeDialog } from "./dialogs/freeze-dialog";
import { LinkBotDialog } from "./dialogs/link-bot-dialog";
import { UnlinkBotDialog } from "./dialogs/unlink-bot-dialog";
import { CreditCardItem } from "./credit-card-item";
import type { NormalizedCard } from "./types";

export interface CreditCardListPageConfig {
  title: string;
  subtitle: string;
  addButtonLabel: string;
  emptyTitle: string;
  emptySubtitle: string;
  apiEndpoint: string;
  railPrefix: string;
  basePath: string;
  normalizeCards: (data: any) => NormalizedCard[];
  explainer: ReactNode;
  setupWizard: (props: { open: boolean; onOpenChange: (v: boolean) => void; onComplete: () => void }) => ReactNode;
  supportsBotLinking?: boolean;
}

export function CreditCardListPage({ config }: { config: CreditCardListPageConfig }) {
  const { user } = useAuth();
  const [cards, setCards] = useState<NormalizedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [freezeTarget, setFreezeTarget] = useState<NormalizedCard | null>(null);
  const [freezeLoading, setFreezeLoading] = useState(false);

  const fetchCards = useCallback(async () => {
    try {
      const res = await authFetch(config.apiEndpoint);
      if (res.ok) {
        const data = await res.json();
        setCards(config.normalizeCards(data));
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [config]);

  const walletActions = useWalletActions({
    railPrefix: config.railPrefix,
    entityType: "card",
    entityIdField: "card_id",
    onUpdate: fetchCards,
  });

  const botLinking = useBotLinking({
    railPrefix: config.railPrefix,
    entityType: "card",
    onUpdate: fetchCards,
  });

  useEffect(() => {
    if (user) {
      fetchCards();
      if (config.supportsBotLinking !== false) {
        botLinking.fetchBots();
      }
    } else {
      setLoading(false);
    }
  }, [user, fetchCards, botLinking.fetchBots, config.supportsBotLinking]);

  async function handleFreezeConfirm() {
    if (!freezeTarget) return;
    setFreezeLoading(true);
    const isFrozen = freezeTarget.status === "frozen";
    const newStatus = isFrozen ? "active" : "frozen";

    setCards((prev) => prev.map((c) => c.card_id === freezeTarget.card_id ? { ...c, status: newStatus } : c));

    try {
      const body = config.railPrefix === "rail5"
        ? { status: newStatus }
        : { card_id: freezeTarget.card_id, frozen: !isFrozen };
      const url = config.railPrefix === "rail5"
        ? `/api/v1/rail5/cards/${freezeTarget.card_id}`
        : `/api/v1/${config.railPrefix}/freeze`;
      const method = config.railPrefix === "rail5" ? "PATCH" : "POST";

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setCards((prev) => prev.map((c) => c.card_id === freezeTarget.card_id ? { ...c, status: freezeTarget.status } : c));
      }
    } catch {
      setCards((prev) => prev.map((c) => c.card_id === freezeTarget.card_id ? { ...c, status: freezeTarget.status } : c));
    } finally {
      setFreezeLoading(false);
      setFreezeTarget(null);
    }
  }

  const supportsBotLinking = config.supportsBotLinking !== false;

  return (
    <div className="flex flex-col gap-8 animate-fade-in-up">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-1" data-testid="text-page-title">{config.title}</h1>
          <p className="text-neutral-500">{config.subtitle}</p>
        </div>
        <Button
          onClick={() => setWizardOpen(true)}
          className="rounded-full bg-primary hover:bg-primary/90 gap-2"
          data-testid="button-add-card"
        >
          <Plus className="w-4 h-4" />
          {config.addButtonLabel}
        </Button>
      </div>

      {config.setupWizard({ open: wizardOpen, onOpenChange: setWizardOpen, onComplete: fetchCards })}

      <FreezeDialog
        open={!!freezeTarget}
        onOpenChange={(open) => !open && setFreezeTarget(null)}
        itemName={freezeTarget?.card_name || ""}
        isFrozen={freezeTarget?.status === "frozen"}
        loading={freezeLoading}
        onConfirm={handleFreezeConfirm}
        itemType="card"
      />

      {supportsBotLinking && (
        <>
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
          />
          <UnlinkBotDialog
            open={!!botLinking.unlinkTarget}
            onOpenChange={(open) => { if (!open) botLinking.closeUnlinkDialog(); }}
            botName={botLinking.unlinkTarget?.bot_name || ""}
            loading={botLinking.unlinkLoading}
            onConfirm={botLinking.handleUnlinkBot}
            onCancel={botLinking.closeUnlinkDialog}
            itemType="card"
          />
        </>
      )}

      {config.explainer}

      {loading ? (
        <div className="flex items-center justify-center py-24" data-testid="loading-cards">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
        </div>
      ) : cards.length === 0 ? (
        <div className="text-center py-24" data-testid="text-no-cards">
          <CreditCard className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
          <p className="text-lg text-neutral-400 font-medium">{config.emptyTitle}</p>
          <p className="text-sm text-neutral-400 mt-2">{config.emptySubtitle}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {cards.map((card, index) => (
            <CreditCardItem
              key={card.card_id}
              card={card}
              index={index}
              onFreeze={() => setFreezeTarget(card)}
              onAddAgent={supportsBotLinking ? () => botLinking.openLinkDialog({
                id: card.card_id,
                name: card.card_name,
                bot_id: card.bot_id,
                bot_name: card.bot_name,
              }) : undefined}
              onUnlinkBot={supportsBotLinking ? () => botLinking.openUnlinkDialog({
                id: card.card_id,
                name: card.card_name,
                bot_id: card.bot_id,
                bot_name: card.bot_name,
              }) : undefined}
              onCopyCardId={() => walletActions.copyCardId(card.card_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
