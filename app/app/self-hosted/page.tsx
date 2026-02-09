"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Rail4SetupWizard } from "@/components/dashboard/rail4-setup-wizard";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck, Plus, Loader2, Trash2, Copy, FileText,
  CheckCircle, Clock, AlertTriangle, Hash, Key
} from "lucide-react";

interface Rail4BotStatus {
  botId: string;
  botName: string;
  configured: boolean;
  status: string;
  decoyFilename?: string;
  realProfileIndex?: number;
  missingDigitPositions?: number[];
  createdAt?: string;
}

export default function SelfHostedPage() {
  const { toast } = useToast();
  const [botStatuses, setBotStatuses] = useState<Rail4BotStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [deleteConfirmBotId, setDeleteConfirmBotId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchStatuses = useCallback(async () => {
    try {
      const botsRes = await fetch("/api/v1/bots/mine");
      if (!botsRes.ok) return;
      const botsData = await botsRes.json();
      const botsList = botsData.bots || [];

      const statuses: Rail4BotStatus[] = await Promise.all(
        botsList.map(async (bot: any) => {
          try {
            const statusRes = await fetch(`/api/v1/rail4/status?bot_id=${bot.bot_id}`);
            if (statusRes.ok) {
              const data = await statusRes.json();
              return {
                botId: bot.bot_id,
                botName: bot.bot_name,
                configured: data.configured,
                status: data.status,
                decoyFilename: data.decoy_filename,
                realProfileIndex: data.real_profile_index,
                missingDigitPositions: data.missing_digit_positions,
                createdAt: data.created_at,
              };
            }
          } catch {}
          return {
            botId: bot.bot_id,
            botName: bot.bot_name,
            configured: false,
            status: "not_configured",
          };
        })
      );

      setBotStatuses(statuses);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  async function handleDelete(botId: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/rail4?bot_id=${botId}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Card removed", description: "Self-hosted card configuration deleted." });
        fetchStatuses();
      } else {
        const err = await res.json();
        toast({ title: "Failed to delete", description: err.message || "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteConfirmBotId(null);
    }
  }

  function handleCopy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard.` });
  }

  const activeCount = botStatuses.filter((b) => b.status === "active").length;
  const pendingCount = botStatuses.filter((b) => b.status === "pending_setup").length;
  const notConfiguredCount = botStatuses.filter((b) => b.status === "not_configured").length;

  return (
    <div className="flex flex-col gap-8 animate-fade-in-up">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            Self-Hosted Cards
          </h2>
          <p className="text-neutral-500 text-sm mt-1 max-w-lg">
            Bring your own credit card. Your bot holds partial card data, CreditClaw holds the rest. Neither party can complete a purchase alone.
          </p>
        </div>
        <Button
          className="rounded-full bg-emerald-600 hover:bg-emerald-700 gap-2"
          onClick={() => setWizardOpen(true)}
          data-testid="button-setup-new"
        >
          <Plus className="w-4 h-4" />
          Set Up New Bot
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-neutral-100 p-4" data-testid="stat-active">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Active</span>
          </div>
          <p className="text-2xl font-bold text-neutral-900">{loading ? "—" : activeCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-100 p-4" data-testid="stat-pending">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Pending Setup</span>
          </div>
          <p className="text-2xl font-bold text-neutral-900">{loading ? "—" : pendingCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-100 p-4" data-testid="stat-not-configured">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-neutral-400" />
            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Not Configured</span>
          </div>
          <p className="text-2xl font-bold text-neutral-900">{loading ? "—" : notConfiguredCount}</p>
        </div>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
        <h3 className="font-semibold text-emerald-900 mb-2">How it works</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-emerald-800">
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-200 flex items-center justify-center shrink-0 font-bold text-emerald-700 text-xs">1</div>
            <p>CreditClaw generates a decoy file with 6 payment profiles — 5 fake, 1 for you to fill in.</p>
          </div>
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-200 flex items-center justify-center shrink-0 font-bold text-emerald-700 text-xs">2</div>
            <p>You enter your card details but leave 3 digits as XXX. Save the file to your bot.</p>
          </div>
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-200 flex items-center justify-center shrink-0 font-bold text-emerald-700 text-xs">3</div>
            <p>Tell CreditClaw only the 3 missing digits and expiry. Nobody has the full picture.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
        </div>
      ) : botStatuses.length === 0 ? (
        <div className="text-center py-16" data-testid="text-no-bots">
          <p className="text-lg text-neutral-400 font-medium">No bots connected yet.</p>
          <p className="text-sm text-neutral-400 mt-2">Register a bot first to set up a self-hosted card.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Your Bots</h3>
          {botStatuses.map((bot) => (
            <div
              key={bot.botId}
              className="bg-white rounded-xl border border-neutral-100 p-5 flex items-start justify-between gap-4"
              data-testid={`row-bot-${bot.botId}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="font-bold text-neutral-900" data-testid={`text-bot-name-${bot.botId}`}>{bot.botName}</h4>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      bot.status === "active"
                        ? "bg-emerald-50 text-emerald-700"
                        : bot.status === "pending_setup"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-neutral-100 text-neutral-500"
                    }`}
                    data-testid={`badge-status-${bot.botId}`}
                  >
                    {bot.status === "active" ? (
                      <><CheckCircle className="w-3 h-3" /> Active</>
                    ) : bot.status === "pending_setup" ? (
                      <><Clock className="w-3 h-3" /> Pending</>
                    ) : (
                      "Not Configured"
                    )}
                  </span>
                </div>

                <p className="text-xs text-neutral-400 font-mono mb-3">{bot.botId}</p>

                {bot.configured && (
                  <div className="flex flex-wrap gap-4 text-xs text-neutral-500">
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-neutral-400" />
                      <span className="font-mono" data-testid={`text-filename-${bot.botId}`}>{bot.decoyFilename}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-neutral-400" />
                      <span data-testid={`text-profile-${bot.botId}`}>Profile #{bot.realProfileIndex}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-neutral-400" />
                      <span data-testid={`text-positions-${bot.botId}`}>Positions {bot.missingDigitPositions?.join(", ")}</span>
                    </div>
                    {bot.createdAt && (
                      <span className="text-neutral-400">
                        Set up {new Date(bot.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {bot.status === "not_configured" && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                    onClick={() => setWizardOpen(true)}
                    data-testid={`button-configure-${bot.botId}`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" /> Configure
                  </Button>
                )}
                {bot.status === "pending_setup" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
                    onClick={() => setWizardOpen(true)}
                    data-testid={`button-continue-${bot.botId}`}
                  >
                    <Clock className="w-3.5 h-3.5" /> Continue Setup
                  </Button>
                )}
                {bot.configured && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-neutral-500"
                      onClick={() => handleCopy(bot.botId, "Bot ID")}
                      data-testid={`button-copy-${bot.botId}`}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setDeleteConfirmBotId(bot.botId)}
                      data-testid={`button-delete-${bot.botId}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Rail4SetupWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onComplete={fetchStatuses}
      />

      <Dialog open={!!deleteConfirmBotId} onOpenChange={(open) => !open && setDeleteConfirmBotId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Self-Hosted Card</DialogTitle>
            <DialogDescription>
              This will permanently delete the Rail 4 configuration for this bot. The decoy file on your bot's filesystem will remain, but it will no longer work. You can set up a new one at any time.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmBotId(null)} data-testid="button-cancel-delete-sh">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmBotId && handleDelete(deleteConfirmBotId)}
              disabled={deleting}
              data-testid="button-confirm-delete-sh"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
