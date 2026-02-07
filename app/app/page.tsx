"use client";

import { useEffect, useState } from "react";
import { BotCard } from "@/components/dashboard/bot-card";
import { Bot as BotIcon, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface BotData {
  bot_id: string;
  bot_name: string;
  description: string | null;
  wallet_status: string;
  created_at: string;
  claimed_at: string | null;
}

export default function DashboardOverview() {
  const [bots, setBots] = useState<BotData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBots() {
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
    }
    fetchBots();
  }, []);

  const activeBots = bots.filter((b) => b.wallet_status === "active");
  const pendingBots = bots.filter((b) => b.wallet_status === "pending");

  return (
    <div className="flex flex-col gap-8 animate-fade-in-up">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-neutral-100 shadow-sm" data-testid="stat-total-bots">
          <span className="text-sm font-medium text-neutral-500">Total Bots</span>
          <h3 className="text-2xl font-bold text-neutral-900 tracking-tight mt-2">
            {loading ? "—" : bots.length}
          </h3>
        </div>
        <div className="bg-white p-6 rounded-xl border border-neutral-100 shadow-sm" data-testid="stat-active-bots">
          <span className="text-sm font-medium text-neutral-500">Active Wallets</span>
          <h3 className="text-2xl font-bold text-green-600 tracking-tight mt-2">
            {loading ? "—" : activeBots.length}
          </h3>
        </div>
        <div className="bg-white p-6 rounded-xl border border-neutral-100 shadow-sm" data-testid="stat-pending-bots">
          <span className="text-sm font-medium text-neutral-500">Pending Claim</span>
          <h3 className="text-2xl font-bold text-amber-600 tracking-tight mt-2">
            {loading ? "—" : pendingBots.length}
          </h3>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-neutral-900">My Bots</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
          </div>
        ) : bots.length === 0 ? (
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-12 text-center" data-testid="empty-bots">
            <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
              <BotIcon className="w-8 h-8 text-neutral-400" />
            </div>
            <h3 className="font-bold text-neutral-900 text-lg mb-2">No bots yet</h3>
            <p className="text-sm text-neutral-500 mb-6 max-w-sm mx-auto">
              When your bots register via the API, you&apos;ll receive a claim token by email. Use it to link the bot to your account.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/claim">
                <Button variant="outline" className="rounded-xl gap-2" data-testid="button-claim-bot-empty">
                  <Plus className="w-4 h-4" />
                  Claim a Bot
                </Button>
              </Link>
              <Link href="/skill.md" target="_blank">
                <Button variant="ghost" className="rounded-xl text-neutral-500" data-testid="link-api-docs">
                  View API Docs
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bots.map((bot) => (
              <BotCard
                key={bot.bot_id}
                botName={bot.bot_name}
                botId={bot.bot_id}
                description={bot.description}
                walletStatus={bot.wallet_status}
                createdAt={bot.created_at}
                claimedAt={bot.claimed_at}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
