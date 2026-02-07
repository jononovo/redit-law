"use client";

import { CardVisual } from "@/components/dashboard/card-visual";
import { Button } from "@/components/ui/button";
import { Plus, Shield, MoreHorizontal, Snowflake, Play, Eye, Copy, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface SpendingLimits {
  bot_id: string;
  approval_mode: string;
  per_transaction_usd: number;
  daily_usd: number;
  monthly_usd: number;
  blocked_categories: string[];
}

const CARD_COLORS: ("primary" | "blue" | "purple" | "dark")[] = ["primary", "blue", "purple", "dark"];

export default function CardsPage() {
  const { toast } = useToast();
  const [cards, setCards] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [freezingIds, setFreezingIds] = useState<Set<number>>(new Set());
  const [limitsModal, setLimitsModal] = useState<{ open: boolean; botId: string; botName: string }>({ open: false, botId: "", botName: "" });
  const [limits, setLimits] = useState<SpendingLimits | null>(null);
  const [limitsLoading, setLimitsLoading] = useState(false);

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

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

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

  async function handleOpenLimits(botId: string, botName: string) {
    setLimitsModal({ open: true, botId, botName });
    setLimitsLoading(true);
    setLimits(null);
    try {
      const res = await fetch(`/api/v1/bots/spending?bot_id=${botId}`);
      if (res.ok) {
        setLimits(await res.json());
      }
    } catch {
    } finally {
      setLimitsLoading(false);
    }
  }

  function handleCopyBotId(botId: string) {
    navigator.clipboard.writeText(botId);
    toast({ title: "Copied", description: "Bot ID copied to clipboard." });
  }

  function formatUsd(cents: number) {
    return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  return (
    <div className="flex flex-col gap-8 animate-fade-in-up">
      
      <div className="flex justify-between items-center">
          <p className="text-neutral-500">Manage your virtual and physical cards.</p>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="rounded-full bg-primary hover:bg-primary/90 gap-2" data-testid="button-create-card">
                  <Plus className="w-4 h-4" />
                  Create New Card
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Issue New Card</DialogTitle>
                <DialogDescription>
                  Create a new virtual card for an agent or specific purpose.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Card Name
                  </Label>
                  <Input id="name" placeholder="e.g. AWS Billing" className="col-span-3" data-testid="input-card-name" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="limit" className="text-right">
                    Limit ($)
                  </Label>
                  <Input id="limit" placeholder="1000" className="col-span-3" data-testid="input-card-limit" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" data-testid="button-submit-card">Create Card</Button>
              </div>
            </DialogContent>
          </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24" data-testid="loading-cards">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
        </div>
      ) : cards.length === 0 ? (
        <div className="text-center py-24" data-testid="text-no-cards">
          <p className="text-lg text-neutral-400 font-medium">No wallets yet.</p>
          <p className="text-sm text-neutral-400 mt-2">Connect a bot and fund its wallet to see it here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
                <Button
                  variant="ghost"
                  className="flex-1 text-xs gap-2 text-neutral-600"
                  onClick={() => handleOpenLimits(card.botId, card.botName)}
                  data-testid={`button-limits-${card.id}`}
                >
                  <Shield className="w-4 h-4" /> Limits
                </Button>
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

      <Dialog open={limitsModal.open} onOpenChange={(open) => setLimitsModal((s) => ({ ...s, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Spending Limits — {limitsModal.botName}</DialogTitle>
            <DialogDescription>
              Current spending rules for this bot. Edit them from the dashboard overview.
            </DialogDescription>
          </DialogHeader>
          {limitsLoading ? (
            <div className="flex justify-center py-8" data-testid="loading-limits">
              <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
            </div>
          ) : limits ? (
            <div className="space-y-4 py-2" data-testid="limits-details">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-neutral-50 rounded-xl p-4">
                  <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">Per Transaction</p>
                  <p className="text-lg font-bold text-neutral-900" data-testid="text-limit-per-tx">${limits.per_transaction_usd.toFixed(2)}</p>
                </div>
                <div className="bg-neutral-50 rounded-xl p-4">
                  <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">Daily Limit</p>
                  <p className="text-lg font-bold text-neutral-900" data-testid="text-limit-daily">${limits.daily_usd.toFixed(2)}</p>
                </div>
                <div className="bg-neutral-50 rounded-xl p-4">
                  <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">Monthly Limit</p>
                  <p className="text-lg font-bold text-neutral-900" data-testid="text-limit-monthly">${limits.monthly_usd.toFixed(2)}</p>
                </div>
                <div className="bg-neutral-50 rounded-xl p-4">
                  <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">Approval Mode</p>
                  <p className="text-sm font-semibold text-neutral-900" data-testid="text-approval-mode">
                    {limits.approval_mode === "ask_for_everything" ? "Ask every time" :
                     limits.approval_mode === "auto_approve_under_threshold" ? "Auto under threshold" :
                     "Auto by category"}
                  </p>
                </div>
              </div>
              {limits.blocked_categories.length > 0 && (
                <div>
                  <p className="text-xs text-neutral-400 uppercase tracking-wider mb-2">Blocked Categories</p>
                  <div className="flex flex-wrap gap-2">
                    {limits.blocked_categories.map((cat) => (
                      <span key={cat} className="bg-red-50 text-red-600 text-xs font-medium px-3 py-1 rounded-full" data-testid={`badge-blocked-${cat}`}>
                        {cat.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-neutral-400 text-sm py-4" data-testid="text-limits-error">Could not load spending limits.</p>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
