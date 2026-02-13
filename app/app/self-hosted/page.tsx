"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Shield, Plus, CreditCard, ChevronRight } from "lucide-react";
import { Rail4CardManager } from "@/components/dashboard/rail4-card-manager";
import { Rail4SetupWizard } from "@/components/dashboard/rail4-setup-wizard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import { authFetch } from "@/lib/auth-fetch";

interface BotInfo {
  bot_id: string;
  bot_name: string;
}

export default function SelfHostedPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [bots, setBots] = useState<BotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);

  const fetchBots = useCallback(async () => {
    try {
      const res = await authFetch("/api/v1/bots/mine");
      if (res.ok) {
        const data = await res.json();
        setBots(data.bots || []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchBots();
    } else {
      setLoading(false);
    }
  }, [user, fetchBots]);

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
        onComplete={fetchBots}
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
      ) : bots.length === 0 ? (
        <div className="text-center py-24" data-testid="text-no-cards">
          <CreditCard className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
          <p className="text-lg text-neutral-400 font-medium">No self-hosted cards yet.</p>
          <p className="text-sm text-neutral-400 mt-2">Click "Add New Card" above to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8">
          {bots.map((bot) => (
            <div key={bot.bot_id} data-testid={`section-bot-${bot.bot_id}`}>
              <div
                className="flex items-center gap-2 mb-3 cursor-pointer hover:opacity-80 transition-opacity group"
                onClick={() => router.push(`/app/self-hosted/${bot.bot_id}`)}
                data-testid={`link-card-detail-${bot.bot_id}`}
              >
                <div className="w-2 h-2 rounded-full bg-primary" />
                <h2 className="text-base font-bold text-neutral-900">{bot.bot_name}</h2>
                <span className="text-xs text-neutral-400 font-mono">{bot.bot_id.slice(0, 8)}...</span>
                <ChevronRight className="w-4 h-4 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
              </div>
              <Rail4CardManager botId={bot.bot_id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
