"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Shield, Plus, CreditCard, ChevronRight, Bot } from "lucide-react";
import { Rail4SetupWizard } from "@/components/dashboard/rail4-setup-wizard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth/auth-context";
import { authFetch } from "@/lib/auth-fetch";

interface CardInfo {
  card_id: string;
  card_name: string;
  use_case: string | null;
  status: string;
  bot_id: string | null;
  created_at: string;
}

export default function SelfHostedPage() {
  const { user } = useAuth();
  const router = useRouter();
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => (
            <div
              key={card.card_id}
              onClick={() => router.push(`/app/self-hosted/${card.card_id}`)}
              className="group relative bg-white rounded-2xl border border-neutral-100 shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer p-5"
              data-testid={`card-self-hosted-${card.card_id}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/10 to-purple-50 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-primary" />
                </div>
                <Badge
                  className={`border-0 text-xs ${
                    card.status === "active"
                      ? "bg-green-100 text-green-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                  data-testid={`badge-card-status-${card.card_id}`}
                >
                  {card.status === "active" ? "Active" : card.status === "pending_setup" ? "Pending" : card.status}
                </Badge>
              </div>
              <h3 className="text-base font-bold text-neutral-900 mb-1">{card.card_name}</h3>
              <p className="text-xs text-neutral-400 font-mono mb-2">{card.card_id.slice(0, 16)}...</p>
              {card.bot_id && (
                <div className="flex items-center gap-1.5 text-xs text-blue-600 mb-2">
                  <Bot className="w-3.5 h-3.5" />
                  <span>Linked to bot</span>
                </div>
              )}
              <p className="text-xs text-neutral-400">
                Created {new Date(card.created_at).toLocaleDateString()}
              </p>
              <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
