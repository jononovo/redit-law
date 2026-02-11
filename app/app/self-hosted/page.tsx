"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Shield, Plus } from "lucide-react";
import { Rail4CardManager } from "@/components/dashboard/rail4-card-manager";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface BotInfo {
  bot_id: string;
  bot_name: string;
}

export default function SelfHostedPage() {
  const { toast } = useToast();
  const [bots, setBots] = useState<BotInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBots = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/bots/mine");
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
    fetchBots();
  }, [fetchBots]);

  return (
    <div className="flex flex-col gap-8 animate-fade-in-up">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-1" data-testid="text-self-hosted-title">Self-Hosted Cards</h1>
          <p className="text-neutral-500">
            Use your own card with split-knowledge security. Neither your bot nor CreditClaw ever holds the full card number.
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-primary/5 to-purple-50 rounded-2xl border border-primary/10 p-6" data-testid="card-rail4-explainer">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-neutral-900 mb-1">How Split-Knowledge Works</h3>
            <p className="text-sm text-neutral-600 leading-relaxed">
              Your card number is split across a decoy file with fake profiles. Only you know which profile is real, 
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
        <div className="text-center py-24" data-testid="text-no-bots">
          <p className="text-lg text-neutral-400 font-medium">No bots registered yet.</p>
          <p className="text-sm text-neutral-400 mt-2">Register a bot first, then come back to set up a self-hosted card.</p>
          <Button
            className="mt-6 rounded-full bg-primary hover:bg-primary/90 gap-2"
            onClick={() => window.location.href = "/app"}
            data-testid="button-go-to-overview"
          >
            <Plus className="w-4 h-4" />
            Go to Overview
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8">
          {bots.map((bot) => (
            <div key={bot.bot_id} data-testid={`section-bot-${bot.bot_id}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <h2 className="text-base font-bold text-neutral-900">{bot.bot_name}</h2>
                <span className="text-xs text-neutral-400 font-mono">{bot.bot_id.slice(0, 8)}...</span>
              </div>
              <Rail4CardManager botId={bot.bot_id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
