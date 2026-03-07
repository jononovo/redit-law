"use client";

import { useEffect, useState } from "react";
import { BotCard } from "@/components/dashboard/bot-card";
import { FundModal } from "@/components/dashboard/fund-modal";
import { ActivityLog } from "@/components/dashboard/activity-log";
import { WebhookLog } from "@/components/dashboard/webhook-log";
import { OpsHealth } from "@/components/dashboard/ops-health";
import { PaymentLinksPanel } from "@/components/dashboard/payment-links";
import { Bot as BotIcon, Plus, Loader2, Wallet } from "lucide-react";
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

interface BalanceData {
  balance_cents: number;
  balance: string;
  has_wallet: boolean;
}

export default function DashboardOverview() {
  const [bots, setBots] = useState<BotData[]>([]);
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fundOpen, setFundOpen] = useState(false);

  async function fetchData() {
    try {
      const [botsRes, balanceRes] = await Promise.all([
        fetch("/api/v1/bots/mine"),
        fetch("/api/v1/wallet/balance"),
      ]);
      if (botsRes.ok) {
        const data = await botsRes.json();
        setBots(data.bots || []);
      }
      if (balanceRes.ok) {
        const data = await balanceRes.json();
        setBalance(data);
      }
    } catch {} finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
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
        <div className="bg-white p-6 rounded-xl border border-neutral-100 shadow-sm" data-testid="stat-wallet-balance">
          <span className="text-sm font-medium text-neutral-500">Wallet Balance</span>
          <h3 className="text-2xl font-bold text-green-600 tracking-tight mt-2">
            {loading ? "—" : balance?.balance || "$0.00"}
          </h3>
        </div>
        <div className="bg-white p-6 rounded-xl border border-neutral-100 shadow-sm" data-testid="stat-pending-bots">
          <span className="text-sm font-medium text-neutral-500">Pending Claim</span>
          <h3 className="text-2xl font-bold text-amber-600 tracking-tight mt-2">
            {loading ? "—" : pendingBots.length}
          </h3>
        </div>
      </div>

      {balance?.has_wallet && (
        <div
          onClick={() => setFundOpen(true)}
          className="bg-neutral-900 text-white p-6 rounded-2xl flex items-center justify-between relative overflow-hidden group cursor-pointer"
          data-testid="card-add-funds"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative z-10">
            <h4 className="font-bold">Add Funds</h4>
            <p className="text-sm text-neutral-400">Top up your bot&apos;s wallet instantly</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center relative z-10 group-hover:bg-white/20 transition-colors">
            <Wallet className="w-5 h-5 text-white" />
          </div>
        </div>
      )}

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
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <BotIcon className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-bold text-neutral-900 text-lg mb-2">Set up your first bot</h3>
            <p className="text-sm text-neutral-500 mb-6 max-w-sm mx-auto">
              Get started with our guided setup wizard, or claim a bot if you already have a token.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/onboarding">
                <Button className="rounded-xl gap-2" data-testid="button-start-onboarding">
                  <Plus className="w-4 h-4" />
                  Get Started
                </Button>
              </Link>
              <Link href="/claim">
                <Button variant="outline" className="rounded-xl gap-2" data-testid="button-claim-bot-empty">
                  Claim a Bot
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

      <PaymentLinksPanel />

      <OpsHealth />

      <ActivityLog />

      <WebhookLog />

      <FundModal
        open={fundOpen}
        onOpenChange={setFundOpen}
        onSuccess={() => fetchData()}
      />
    </div>
  );
}
