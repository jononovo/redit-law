"use client";

import { CardVisual } from "@/components/dashboard/card-visual";
import { CardTypePicker } from "@/components/dashboard/card-type-picker";
import { Rail4SetupWizard } from "@/components/dashboard/rail4-setup-wizard";
import { Button } from "@/components/ui/button";
import { Plus, Shield, MoreHorizontal, Snowflake, Play, Eye, Copy, Loader2, ShieldCheck, Trash2, Download, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback } from "react";

interface CardData {
  id: number;
  botId: string;
  botName: string;
  balanceCents: number;
  currency: string;
  isFrozen: boolean;
  createdAt: string;
}

interface SelfHostedCard {
  botId: string;
  botName: string;
  status: string;
  decoyFilename: string;
  realProfileIndex: number;
  missingDigitPositions: number[];
  createdAt: string;
}

interface SpendingLimits {
  bot_id: string;
  approval_mode: string;
  per_transaction_usd: number;
  daily_usd: number;
  monthly_usd: number;
  blocked_categories: string[];
}

const CARD_COLORS: ("primary" | "blue" | "purple" | "dark")[] = ["primary", "blue", "purple", "dark"];

function LimitsPopover({ botId, cardId }: { botId: string; cardId: number }) {
  const [limits, setLimits] = useState<SpendingLimits | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  async function loadLimits() {
    if (fetched) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/bots/spending?bot_id=${botId}`);
      if (res.ok) {
        setLimits(await res.json());
      }
    } catch {
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="flex-1 text-xs gap-2 text-neutral-600"
          onClick={loadLimits}
          data-testid={`button-limits-${cardId}`}
        >
          <Shield className="w-4 h-4" /> Limits
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" side="top" align="start">
        {loading ? (
          <div className="flex justify-center py-6" data-testid="loading-limits">
            <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
          </div>
        ) : limits ? (
          <div className="p-4 space-y-3" data-testid="limits-details">
            <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Spending Limits</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-neutral-500">Per transaction</span>
                <span className="text-sm font-bold text-neutral-900" data-testid="text-limit-per-tx">${limits.per_transaction_usd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-neutral-500">Daily</span>
                <span className="text-sm font-bold text-neutral-900" data-testid="text-limit-daily">${limits.daily_usd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-neutral-500">Monthly</span>
                <span className="text-sm font-bold text-neutral-900" data-testid="text-limit-monthly">${limits.monthly_usd.toFixed(2)}</span>
              </div>
              <div className="border-t border-neutral-100 pt-2 flex justify-between items-center">
                <span className="text-xs text-neutral-500">Approval</span>
                <span className="text-xs font-semibold text-neutral-700" data-testid="text-approval-mode">
                  {limits.approval_mode === "ask_for_everything" ? "Ask every time" :
                   limits.approval_mode === "auto_approve_under_threshold" ? "Auto under threshold" :
                   "Auto by category"}
                </span>
              </div>
            </div>
            {limits.blocked_categories.length > 0 && (
              <div className="border-t border-neutral-100 pt-2">
                <p className="text-xs text-neutral-400 mb-1.5">Blocked</p>
                <div className="flex flex-wrap gap-1">
                  {limits.blocked_categories.map((cat) => (
                    <span key={cat} className="bg-red-50 text-red-600 text-[10px] font-medium px-2 py-0.5 rounded-full" data-testid={`badge-blocked-${cat}`}>
                      {cat.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-neutral-400 text-xs p-4" data-testid="text-limits-error">Could not load limits.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default function CardsPage() {
  const { toast } = useToast();
  const [cards, setCards] = useState<CardData[]>([]);
  const [selfHostedCards, setSelfHostedCards] = useState<SelfHostedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [freezingIds, setFreezingIds] = useState<Set<number>>(new Set());
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [deleteConfirmBotId, setDeleteConfirmBotId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCards = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/wallets");
      if (res.ok) {
        const data = await res.json();
        setCards(data.cards || []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSelfHostedCards = useCallback(async () => {
    try {
      const botsRes = await fetch("/api/v1/bots/mine");
      if (!botsRes.ok) return;
      const botsData = await botsRes.json();
      const botsList = botsData.bots || [];

      const rail4Cards: SelfHostedCard[] = [];

      await Promise.all(
        botsList.map(async (bot: any) => {
          try {
            const statusRes = await fetch(`/api/v1/rail4/status?bot_id=${bot.bot_id}`);
            if (statusRes.ok) {
              const data = await statusRes.json();
              if (data.configured) {
                rail4Cards.push({
                  botId: bot.bot_id,
                  botName: bot.bot_name,
                  status: data.status,
                  decoyFilename: data.decoy_filename,
                  realProfileIndex: data.real_profile_index,
                  missingDigitPositions: data.missing_digit_positions,
                  createdAt: data.created_at,
                });
              }
            }
          } catch {}
        })
      );

      setSelfHostedCards(rail4Cards);
    } catch {}
  }, []);

  useEffect(() => {
    fetchCards();
    fetchSelfHostedCards();
  }, [fetchCards, fetchSelfHostedCards]);

  async function handleFreeze(card: CardData) {
    const newFrozen = !card.isFrozen;
    setFreezingIds((s) => new Set(s).add(card.id));
    setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, isFrozen: newFrozen } : c)));

    try {
      const res = await fetch(`/api/v1/wallets/${card.id}/freeze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frozen: newFrozen }),
      });

      if (!res.ok) {
        setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, isFrozen: !newFrozen } : c)));
        toast({ title: "Failed to update", description: "Please try again.", variant: "destructive" });
      } else {
        toast({
          title: newFrozen ? "Wallet frozen" : "Wallet unfrozen",
          description: newFrozen ? "All spending is paused." : "Spending is resumed.",
        });
      }
    } catch {
      setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, isFrozen: !newFrozen } : c)));
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    } finally {
      setFreezingIds((s) => {
        const next = new Set(s);
        next.delete(card.id);
        return next;
      });
    }
  }

  function handleCopyBotId(botId: string) {
    navigator.clipboard.writeText(botId);
    toast({ title: "Copied", description: "Bot ID copied to clipboard." });
  }

  async function handleDeleteRail4(botId: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/rail4?bot_id=${botId}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Card removed", description: "Self-hosted card configuration has been deleted." });
        setSelfHostedCards((prev) => prev.filter((c) => c.botId !== botId));
      } else {
        const err = await res.json();
        toast({ title: "Failed to delete", description: err.message || "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteConfirmBotId(null);
    }
  }

  function formatUsd(cents: number) {
    return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const hasAnyCards = cards.length > 0 || selfHostedCards.length > 0;

  return (
    <div className="flex flex-col gap-8 animate-fade-in-up">
      
      <div className="flex justify-between items-center">
          <p className="text-neutral-500">Manage your virtual and physical cards.</p>
          <Button
            className="rounded-full bg-primary hover:bg-primary/90 gap-2"
            onClick={() => setTypePickerOpen(true)}
            data-testid="button-create-card"
          >
            <Plus className="w-4 h-4" />
            Create New Card
          </Button>
      </div>

      <CardTypePicker
        open={typePickerOpen}
        onOpenChange={setTypePickerOpen}
        onSelectSelfHosted={() => setWizardOpen(true)}
      />

      <Rail4SetupWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onComplete={() => {
          fetchCards();
          fetchSelfHostedCards();
        }}
      />

      <Dialog open={!!deleteConfirmBotId} onOpenChange={(open) => !open && setDeleteConfirmBotId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Self-Hosted Card</DialogTitle>
            <DialogDescription>
              This will permanently delete the Rail 4 configuration for this bot. The decoy file on your bot's filesystem will remain, but it will no longer work. You can set up a new one at any time.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmBotId(null)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmBotId && handleDeleteRail4(deleteConfirmBotId)}
              disabled={deleting}
              data-testid="button-confirm-delete"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex items-center justify-center py-24" data-testid="loading-cards">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
        </div>
      ) : !hasAnyCards ? (
        <div className="text-center py-24" data-testid="text-no-cards">
          <p className="text-lg text-neutral-400 font-medium">No cards yet.</p>
          <p className="text-sm text-neutral-400 mt-2">Create a card to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {selfHostedCards.map((shCard, index) => (
            <div className="flex flex-col gap-4" key={`sh-${shCard.botId}`} data-testid={`card-self-hosted-${shCard.botId}`}>
              <div className="relative">
                <CardVisual
                  color="dark"
                  balance={shCard.status === "active" ? "ACTIVE" : "PENDING"}
                  last4={shCard.botId.slice(-4)}
                  holder={shCard.botName.toUpperCase()}
                  expiry="XX/XX"
                />
                <div className="absolute top-3 right-3 z-30">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-500 text-white shadow-lg">
                    <ShieldCheck className="w-3 h-3" />
                    Self-Hosted
                  </span>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-neutral-100 p-2 flex justify-between">
                <Button
                  variant="ghost"
                  className="flex-1 text-xs gap-2 text-neutral-600"
                  onClick={() => handleCopyBotId(shCard.botId)}
                  data-testid={`button-copy-sh-${shCard.botId}`}
                >
                  <Copy className="w-4 h-4" /> Copy ID
                </Button>
                <div className="w-px bg-neutral-100 my-1" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex-1 text-xs gap-2 text-neutral-600" data-testid={`button-more-sh-${shCard.botId}`}>
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleCopyBotId(shCard.botId)} data-testid={`menu-copy-sh-${shCard.botId}`}>
                      <Copy className="w-4 h-4 mr-2" /> Copy Bot ID
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setDeleteConfirmBotId(shCard.botId)}
                      className="text-red-600 focus:text-red-600"
                      data-testid={`menu-delete-sh-${shCard.botId}`}
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Remove Card
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}

          {cards.map((card, index) => (
            <div className="flex flex-col gap-4" key={card.id} data-testid={`card-wallet-${card.id}`}>
              <CardVisual
                color={CARD_COLORS[index % CARD_COLORS.length]}
                balance={formatUsd(card.balanceCents)}
                last4={card.botId.slice(-4)}
                holder={card.botName.toUpperCase()}
                frozen={card.isFrozen}
              />
              <div className="bg-white rounded-xl border border-neutral-100 p-2 flex justify-between">
                <LimitsPopover botId={card.botId} cardId={card.id} />
                <div className="w-px bg-neutral-100 my-1" />
                <Button
                  variant="ghost"
                  className={`flex-1 text-xs gap-2 ${card.isFrozen ? "text-blue-600" : "text-neutral-600"}`}
                  onClick={() => handleFreeze(card)}
                  disabled={freezingIds.has(card.id)}
                  data-testid={`button-freeze-${card.id}`}
                >
                  {card.isFrozen ? (
                    <><Play className="w-4 h-4" /> Unfreeze</>
                  ) : (
                    <><Snowflake className="w-4 h-4" /> Freeze</>
                  )}
                </Button>
                <div className="w-px bg-neutral-100 my-1" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex-1 text-xs gap-2 text-neutral-600" data-testid={`button-more-${card.id}`}>
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => window.location.href = "/app/transactions"} data-testid={`menu-transactions-${card.id}`}>
                      <Eye className="w-4 h-4 mr-2" /> View Transactions
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleCopyBotId(card.botId)} data-testid={`menu-copy-botid-${card.id}`}>
                      <Copy className="w-4 h-4 mr-2" /> Copy Bot ID
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
