"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Shield, Plus, CreditCard, Eye, Copy, Bot, MoreHorizontal, Snowflake, Play, Lock } from "lucide-react";
import { Rail5SetupWizard } from "@/components/dashboard/rail5-setup-wizard";
import { CardVisual } from "@/components/dashboard/card-visual";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth/auth-context";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";

interface Rail5CardInfo {
  card_id: string;
  card_name: string;
  card_brand: string;
  card_last4: string;
  status: string;
  bot_id: string | null;
  spending_limit_cents: number;
  daily_limit_cents: number;
  monthly_limit_cents: number;
  human_approval_above_cents: number;
  created_at: string;
}

const CARD_COLORS: ("primary" | "blue" | "purple" | "dark")[] = ["purple", "dark", "blue", "primary"];

const BRAND_LABELS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
  discover: "Discover",
};

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

  useEffect(() => {
    if (user) {
      fetchCards();
    } else {
      setLoading(false);
    }
  }, [user, fetchCards]);

  function handleCopyCardId(cardId: string) {
    navigator.clipboard.writeText(cardId);
    toast({ title: "Copied", description: "Card ID copied to clipboard." });
  }

  async function handleFreezeConfirm() {
    if (!freezeTarget) return;
    const isFrozen = freezeTarget.status === "frozen";
    const newStatus = isFrozen ? "active" : "frozen";

    setFreezeLoading(true);
    setCards((prev) => prev.map((c) => c.card_id === freezeTarget.card_id ? { ...c, status: newStatus } : c));

    try {
      const res = await authFetch(`/api/v1/rail5/cards/${freezeTarget.card_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        setCards((prev) => prev.map((c) => c.card_id === freezeTarget.card_id ? { ...c, status: freezeTarget.status } : c));
        toast({ title: "Error", description: "Failed to update card status.", variant: "destructive" });
      } else {
        toast({
          title: newStatus === "frozen" ? "Card frozen" : "Card unfrozen",
          description: newStatus === "frozen" ? "All transactions on this card are paused." : "Transactions on this card are resumed.",
        });
      }
    } catch {
      setCards((prev) => prev.map((c) => c.card_id === freezeTarget.card_id ? { ...c, status: freezeTarget.status } : c));
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setFreezeLoading(false);
      setFreezeTarget(null);
    }
  }

  function formatLimit(cents: number) {
    return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

      <Dialog open={!!freezeTarget} onOpenChange={(open) => !open && setFreezeTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle className="flex items-center gap-2">
            {freezeTarget?.status === "frozen" ? (
              <><Play className="w-5 h-5 text-emerald-600" /> Unfreeze Card</>
            ) : (
              <><Snowflake className="w-5 h-5 text-blue-500" /> Freeze Card</>
            )}
          </DialogTitle>
          <DialogDescription className="text-neutral-600">
            {freezeTarget?.status === "frozen"
              ? `Are you sure you want to unfreeze "${freezeTarget?.card_name}"? Transactions will be allowed again.`
              : `Are you sure you want to freeze "${freezeTarget?.card_name}"? All transactions will be blocked until you unfreeze it.`
            }
          </DialogDescription>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setFreezeTarget(null)} disabled={freezeLoading} data-testid="button-r5-freeze-cancel">
              Cancel
            </Button>
            <Button
              onClick={handleFreezeConfirm}
              disabled={freezeLoading}
              className={freezeTarget?.status === "frozen" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700"}
              data-testid="button-r5-freeze-confirm"
            >
              {freezeLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {freezeTarget?.status === "frozen" ? "Unfreeze" : "Freeze"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
                balance={formatLimit(card.spending_limit_cents)}
                last4={card.card_last4}
                holder={card.card_name.toUpperCase()}
                frozen={card.status === "frozen"}
                expiry="••/••"
                allowanceLabel={`${BRAND_LABELS[card.card_brand] || card.card_brand} | Daily: ${formatLimit(card.daily_limit_cents)}`}
                resetsLabel={`Monthly: ${formatLimit(card.monthly_limit_cents)}`}
                status={card.status}
              />
              <div className="bg-white rounded-xl border border-neutral-100 p-2 flex justify-between">
                <Button
                  variant="ghost"
                  className="flex-1 text-xs gap-2 text-neutral-600 cursor-pointer hover:bg-neutral-100 rounded-lg transition-colors"
                  onClick={() => router.push(`/app/sub-agent-cards/${card.card_id}`)}
                  data-testid={`button-r5-manage-${card.card_id}`}
                >
                  <Eye className="w-4 h-4" /> Manage
                </Button>
                <div className="w-px bg-neutral-100 my-1" />
                {card.status !== "pending_setup" && (
                  <>
                    <Button
                      variant="ghost"
                      className={`flex-1 text-xs gap-2 cursor-pointer hover:bg-neutral-100 rounded-lg transition-colors ${card.status === "frozen" ? "text-blue-600" : "text-neutral-600"}`}
                      onClick={() => setFreezeTarget(card)}
                      data-testid={`button-r5-freeze-${card.card_id}`}
                    >
                      {card.status === "frozen" ? (
                        <><Play className="w-4 h-4" /> Unfreeze</>
                      ) : (
                        <><Snowflake className="w-4 h-4" /> Freeze</>
                      )}
                    </Button>
                    <div className="w-px bg-neutral-100 my-1" />
                  </>
                )}
                {card.bot_id && (
                  <>
                    <div
                      className="flex-1 flex items-center justify-center gap-2 text-xs text-blue-600 font-medium"
                      data-testid={`badge-r5-bot-link-${card.card_id}`}
                    >
                      <Bot className="w-4 h-4" /> Linked
                    </div>
                    <div className="w-px bg-neutral-100 my-1" />
                  </>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex-1 text-xs gap-2 text-neutral-600 cursor-pointer hover:bg-neutral-100 rounded-lg transition-colors" data-testid={`button-r5-more-${card.card_id}`}>
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleCopyCardId(card.card_id)} data-testid={`menu-r5-copy-${card.card_id}`}>
                      <Copy className="w-4 h-4 mr-2" /> Copy Card ID
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push(`/app/sub-agent-cards/${card.card_id}`)} data-testid={`menu-r5-details-${card.card_id}`}>
                      <Eye className="w-4 h-4 mr-2" /> View Details
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
