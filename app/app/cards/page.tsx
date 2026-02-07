"use client";

import { CardVisual } from "@/components/dashboard/card-visual";
import { Button } from "@/components/ui/button";
import { Plus, Shield, MoreHorizontal, Snowflake, Play, Eye, Copy, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  const [loading, setLoading] = useState(true);
  const [freezingIds, setFreezingIds] = useState<Set<number>>(new Set());

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
