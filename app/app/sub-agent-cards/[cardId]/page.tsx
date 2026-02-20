"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, CreditCard, Shield, Bot, Snowflake, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardVisual } from "@/components/dashboard/card-visual";
import { useAuth } from "@/lib/auth/auth-context";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";

interface Rail5CardDetail {
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

const BRAND_LABELS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
  discover: "Discover",
};

export default function Rail5CardDetailPage() {
  const { user } = useAuth();
  const { cardId } = useParams<{ cardId: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [card, setCard] = useState<Rail5CardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [freezeLoading, setFreezeLoading] = useState(false);

  useEffect(() => {
    if (user && cardId) {
      authFetch(`/api/v1/rail5/cards/${cardId}`)
        .then(async (res) => {
          if (res.ok) {
            setCard(await res.json());
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user, cardId]);

  async function handleFreeze() {
    if (!card) return;
    const newStatus = card.status === "frozen" ? "active" : "frozen";
    setFreezeLoading(true);
    try {
      const res = await authFetch(`/api/v1/rail5/cards/${card.card_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCard(updated);
        toast({ title: newStatus === "frozen" ? "Card frozen" : "Card unfrozen" });
      } else {
        toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setFreezeLoading(false);
    }
  }

  function formatLimit(cents: number) {
    return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!card) {
    return (
      <div className="text-center py-24">
        <CreditCard className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
        <p className="text-lg text-neutral-400 font-medium">Card not found.</p>
        <Button variant="outline" onClick={() => router.push("/app/sub-agent-cards")} className="mt-4">
          Back to Cards
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 animate-fade-in-up max-w-2xl">
      <Button
        variant="ghost"
        onClick={() => router.push("/app/sub-agent-cards")}
        className="self-start gap-2 text-neutral-500"
        data-testid="button-r5-back"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Sub-Agent Cards
      </Button>

      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold text-neutral-900" data-testid="text-r5-card-name">{card.card_name}</h1>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
          card.status === "active" ? "bg-green-100 text-green-700" :
          card.status === "frozen" ? "bg-blue-100 text-blue-700" :
          "bg-amber-100 text-amber-700"
        }`} data-testid="badge-r5-status">
          {card.status}
        </span>
      </div>

      <CardVisual
        color="purple"
        balance={formatLimit(card.spending_limit_cents)}
        last4={card.card_last4}
        holder={card.card_name.toUpperCase()}
        frozen={card.status === "frozen"}
        expiry="••/••"
        allowanceLabel={`${BRAND_LABELS[card.card_brand] || card.card_brand} | Daily: ${formatLimit(card.daily_limit_cents)}`}
        resetsLabel={`Monthly: ${formatLimit(card.monthly_limit_cents)}`}
        status={card.status}
      />

      <div className="bg-white rounded-2xl border border-neutral-100 p-6 space-y-4">
        <h3 className="font-bold text-neutral-900 flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" /> Spending Controls
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-neutral-50 rounded-xl p-4">
            <p className="text-neutral-500">Per-Checkout</p>
            <p className="font-bold text-neutral-900 text-lg" data-testid="text-r5-per-checkout">{formatLimit(card.spending_limit_cents)}</p>
          </div>
          <div className="bg-neutral-50 rounded-xl p-4">
            <p className="text-neutral-500">Daily Limit</p>
            <p className="font-bold text-neutral-900 text-lg" data-testid="text-r5-daily">{formatLimit(card.daily_limit_cents)}</p>
          </div>
          <div className="bg-neutral-50 rounded-xl p-4">
            <p className="text-neutral-500">Monthly Limit</p>
            <p className="font-bold text-neutral-900 text-lg" data-testid="text-r5-monthly">{formatLimit(card.monthly_limit_cents)}</p>
          </div>
          <div className="bg-neutral-50 rounded-xl p-4">
            <p className="text-neutral-500">Approval Above</p>
            <p className="font-bold text-neutral-900 text-lg" data-testid="text-r5-approval">{formatLimit(card.human_approval_above_cents)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-100 p-6 space-y-4">
        <h3 className="font-bold text-neutral-900 flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-600" /> Linked Bot
        </h3>
        {card.bot_id ? (
          <p className="text-sm text-neutral-700 font-mono bg-neutral-50 rounded-xl p-3" data-testid="text-r5-bot-id">{card.bot_id}</p>
        ) : (
          <p className="text-sm text-neutral-400" data-testid="text-r5-no-bot">No bot linked yet.</p>
        )}
      </div>

      {card.status !== "pending_setup" && (
        <Button
          variant="outline"
          onClick={handleFreeze}
          disabled={freezeLoading}
          className={`gap-2 ${card.status === "frozen" ? "text-emerald-600 border-emerald-200" : "text-blue-600 border-blue-200"}`}
          data-testid="button-r5-toggle-freeze"
        >
          {freezeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : card.status === "frozen" ? <Play className="w-4 h-4" /> : <Snowflake className="w-4 h-4" />}
          {card.status === "frozen" ? "Unfreeze Card" : "Freeze Card"}
        </Button>
      )}

      <p className="text-xs text-neutral-400">Created: {new Date(card.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
    </div>
  );
}
