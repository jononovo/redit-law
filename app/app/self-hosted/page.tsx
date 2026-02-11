"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Shield, Plus, CreditCard, Eye, Copy, Bot, MoreHorizontal } from "lucide-react";
import { Rail4SetupWizard } from "@/components/dashboard/rail4-setup-wizard";
import { CardVisual } from "@/components/dashboard/card-visual";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth/auth-context";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";

interface AllowanceInfo {
  value: number;
  currency: string;
  duration: string;
  spent_cents: number;
  remaining_cents: number;
  resets_at: string;
}

interface CardInfo {
  card_id: string;
  card_name: string;
  use_case: string | null;
  status: string;
  bot_id: string | null;
  created_at: string;
  allowance: AllowanceInfo | null;
}

const CARD_COLORS: ("primary" | "blue" | "purple" | "dark")[] = ["purple", "dark", "blue", "primary"];

export default function SelfHostedPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [cards, setCards] = useState<CardInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);

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

  function formatBalance(card: CardInfo) {
    if (!card.allowance) {
      if (card.status === "active") return "Active";
      if (card.status === "pending_setup") return "Pending Setup";
      return card.status;
    }
    const remaining = card.allowance.remaining_cents / 100;
    const sign = remaining < 0 ? "-" : "";
    return `${sign}$${Math.abs(remaining).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function formatAllowanceLabel(a: AllowanceInfo) {
    const durationMap: Record<string, string> = { day: "Daily", week: "Weekly", month: "Monthly" };
    const durLabel = durationMap[a.duration] || a.duration;
    return `Allowance: $${a.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${a.currency} | ${durLabel}`;
  }

  function formatResetsLabel(a: AllowanceInfo) {
    const d = new Date(a.resets_at);
    return `Resets: ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
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
                last4={card.card_id.slice(-4)}
                holder={card.card_name.toUpperCase()}
                frozen={card.status !== "active"}
                expiry="••/••"
                allowanceLabel={card.allowance ? formatAllowanceLabel(card.allowance) : undefined}
                resetsLabel={card.allowance ? formatResetsLabel(card.allowance) : undefined}
              />
              <div className="bg-white rounded-xl border border-neutral-100 p-2 flex justify-between">
                <Button
                  variant="ghost"
                  className="flex-1 text-xs gap-2 text-neutral-600"
                  onClick={() => router.push(`/app/self-hosted/${card.card_id}`)}
                  data-testid={`button-manage-${card.card_id}`}
                >
                  <Eye className="w-4 h-4" /> Manage
                </Button>
                <div className="w-px bg-neutral-100 my-1" />
                {card.bot_id && (
                  <>
                    <div
                      className="flex-1 flex items-center justify-center gap-2 text-xs text-blue-600 font-medium"
                      data-testid={`badge-bot-link-${card.card_id}`}
                    >
                      <Bot className="w-4 h-4" /> Linked
                    </div>
                    <div className="w-px bg-neutral-100 my-1" />
                  </>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex-1 text-xs gap-2 text-neutral-600" data-testid={`button-more-${card.card_id}`}>
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleCopyCardId(card.card_id)} data-testid={`menu-copy-cardid-${card.card_id}`}>
                      <Copy className="w-4 h-4 mr-2" /> Copy Card ID
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push(`/app/self-hosted/${card.card_id}`)} data-testid={`menu-view-details-${card.card_id}`}>
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
